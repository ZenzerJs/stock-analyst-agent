import logging
import os
import sys
from typing import List, Dict, Any, Optional, Literal

from dotenv import load_dotenv

load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env")))

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.agent import (
    app as agent_graph,
    get_llm_route,
    LLMRateLimitError,
    RATE_LIMIT_MESSAGE,
    is_rate_limit_error,
)
from app.config import (
    set_request_keys,
    resolve_groq_key,
    resolve_finnhub_key,
    resolve_gemini_key,
    get_finnhub_key,
)
from app.security import IS_PRODUCTION, ALLOWED_ORIGINS, ALLOWED_CORS_HEADERS, validate_ticker
from app.tools import (
    fetch_quote_snapshot,
    fetch_sentiment_snapshot,
    fetch_earnings_snapshot,
    fetch_price_history,
    fetch_eps_snapshot,
    fetch_volume_flow,
)
from app.sources import get_trusted_sources, extract_ticker_from_steps
from app.tickers import search_tickers, get_all_cached_tickers, get_ticker_tape, get_company_name
from app.fundamentals import build_fundamentals_payload
from app.ingest import ingest_ticker_data
from app.database import has_cached_fundamentals, init_db, DB_PATH
from langchain_core.messages import HumanMessage, AIMessage

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

app_fastapi = FastAPI(
    title="Stock Analyst Agent API",
    description="BYOK stock research shell — pass API keys via headers or optional server .env",
    version="2.0.0",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None,
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

app_fastapi.state.limiter = limiter
app_fastapi.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app_fastapi.on_event("startup")
def on_startup():
    init_db()
    logger.info("SQLite initialized at %s", DB_PATH)


app_fastapi.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=ALLOWED_CORS_HEADERS,
)


@app_fastapi.middleware("http")
async def security_and_keys(request: Request, call_next):
    set_request_keys(
        groq_key=request.headers.get("x-groq-api-key"),
        finnhub_key=request.headers.get("x-finnhub-api-key"),
        gemini_key=request.headers.get("x-gemini-api-key"),
    )
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: List[ChatMessage] = Field(default_factory=list, max_length=20)


class ChatResponse(BaseModel):
    response: str
    steps: List[Dict[str, Any]]
    sources: List[Dict[str, str]] = []
    ticker: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    routing: Optional[str] = None


@app_fastapi.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "server_groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "server_gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
        "server_finnhub_configured": bool(os.getenv("FINNHUB_API_KEY")),
    }


@app_fastapi.get("/api/tickers")
def list_tickers():
    tickers = get_all_cached_tickers()
    return {"tickers": tickers, "count": len(tickers)}


@app_fastapi.get("/api/tickers/search")
@limiter.limit("60/minute")
def ticker_search(request: Request, q: str = "", limit: int = 12):
    safe_limit = min(max(limit, 1), 24)
    query = q.strip()[:80]
    return {"query": query, "results": search_tickers(query, limit=safe_limit)}


@app_fastapi.get("/api/tickers/tape")
def ticker_tape(limit: int = 24):
    safe_limit = min(max(limit, 4), 40)
    items = get_ticker_tape(limit=safe_limit)
    return {"items": items, "count": len(items)}


@app_fastapi.get("/api/dashboard/{ticker}")
def dashboard_snapshot(ticker: str, period: str = "6mo"):
    ticker_clean = validate_ticker(ticker)
    safe_period = period.strip()[:8] if period else "6mo"
    quote = fetch_quote_snapshot(ticker_clean)
    sentiment = fetch_sentiment_snapshot(ticker_clean)
    earnings = fetch_earnings_snapshot(ticker_clean)
    history = fetch_price_history(ticker_clean, safe_period)
    sources = get_trusted_sources(ticker_clean)

    return {
        "ticker": ticker_clean,
        "company_name": get_company_name(ticker_clean),
        "quote": quote,
        "sentiment": sentiment,
        "earnings": earnings,
        "eps": fetch_eps_snapshot(ticker_clean),
        "volume_flow": fetch_volume_flow(history),
        "history": history,
        "sources": sources,
        "finnhub_configured": bool(get_finnhub_key()),
        "has_fundamentals": build_fundamentals_payload(ticker_clean)["has_data"],
    }


@app_fastapi.get("/api/fundamentals/{ticker}")
def fundamentals_visual(ticker: str):
    ticker_clean = validate_ticker(ticker)
    return build_fundamentals_payload(ticker_clean)


@app_fastapi.post("/api/fundamentals/{ticker}/fetch")
@limiter.limit("10/hour")
def fetch_and_cache_fundamentals(request: Request, ticker: str):
    ticker_clean = validate_ticker(ticker)

    if has_cached_fundamentals(ticker_clean):
        payload = build_fundamentals_payload(ticker_clean)
        return {
            "status": "already_cached",
            "ticker": ticker_clean,
            "fundamentals": payload,
            "message": "Fundamentals already in local cache.",
        }

    result = ingest_ticker_data(ticker_clean)
    payload = build_fundamentals_payload(ticker_clean)

    if not payload.get("has_data"):
        raise HTTPException(
            status_code=404,
            detail=result.get("message")
            or f"No quarterly financial statements available for {ticker_clean}. ETFs and some symbols may not have corporate filings.",
        )

    return {
        "status": "fetched",
        "ticker": ticker_clean,
        "quarters": result.get("quarters"),
        "fundamentals": payload,
        "message": result.get("message"),
    }


@app_fastapi.get("/api/history/{ticker}")
def price_history(ticker: str, period: str = "6mo"):
    ticker_clean = validate_ticker(ticker)
    safe_period = period.strip()[:8] if period else "6mo"
    return fetch_price_history(ticker_clean, safe_period)


@app_fastapi.post("/api/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat_endpoint(request: Request, body: ChatRequest):
    groq_key = resolve_groq_key(request.headers.get("x-groq-api-key"))
    gemini_key = resolve_gemini_key(request.headers.get("x-gemini-api-key"))
    if not groq_key and not gemini_key:
        raise HTTPException(
            status_code=401,
            detail="LLM API key required. Add a Groq key in Settings, or configure GEMINI_API_KEY on the server.",
        )

    formatted_messages = []
    for msg in body.history[-20:]:
        if msg.role == "user":
            formatted_messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            formatted_messages.append(AIMessage(content=msg.content))

    formatted_messages.append(HumanMessage(content=body.message))

    steps = []
    final_response = ""
    run_config = {
        "configurable": {
            "groq_api_key": groq_key,
            "gemini_api_key": gemini_key,
        }
    }

    try:
        inputs = {"messages": formatted_messages}
        for output in agent_graph.stream(inputs, stream_mode="updates", config=run_config):
            for node_name, state_update in output.items():
                messages = state_update.get("messages", [])
                for msg in messages:
                    if hasattr(msg, "tool_calls") and msg.tool_calls:
                        for tc in msg.tool_calls:
                            steps.append({
                                "type": "tool_call",
                                "node": node_name,
                                "name": tc["name"],
                                "args": tc["args"],
                            })
                    elif msg.__class__.__name__ == "ToolMessage":
                        steps.append({
                            "type": "tool_response",
                            "node": node_name,
                            "name": msg.name,
                            "content": msg.content,
                        })
                    elif msg.__class__.__name__ == "AIMessage" and msg.content:
                        final_response = msg.content
                        steps.append({
                            "type": "ai_message",
                            "node": node_name,
                            "content": msg.content,
                        })

        if not final_response:
            raise HTTPException(
                status_code=503,
                detail="Couldn't finish — try again.",
            )

        tools_used = [
            step["name"]
            for step in steps
            if step.get("type") == "tool_call" and step.get("name")
        ]
        ticker = extract_ticker_from_steps(steps, body.message)
        sources = get_trusted_sources(ticker, tools_used) if ticker else []

        llm_route = get_llm_route()
        provider = llm_route.get("provider") or ("groq" if groq_key else "gemini")

        return ChatResponse(
            response=final_response,
            steps=steps,
            sources=sources,
            ticker=ticker,
            provider=provider,
            model=llm_route.get("model"),
            routing=llm_route.get("routing"),
        )

    except LLMRateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Chat agent failed")
        if is_rate_limit_error(e):
            raise HTTPException(status_code=429, detail=RATE_LIMIT_MESSAGE) from e
        detail = str(e) if not IS_PRODUCTION else "An internal error occurred."
        raise HTTPException(status_code=500, detail=detail) from e


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app_fastapi", host="127.0.0.1", port=port, reload=not IS_PRODUCTION)
