import logging
import os
from contextvars import ContextVar
from typing import TypedDict, Annotated, Sequence, Literal

from dotenv import load_dotenv

load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env")))

from langchain_core.messages import BaseMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from app.config import get_groq_key, get_gemini_key

from app.tools import (
    get_quarterly_financials,
    get_stock_price,
    get_analyst_sentiment,
    get_earnings_calendar,
)

logger = logging.getLogger(__name__)


class LLMRateLimitError(Exception):
    """Raised when all configured LLM providers are rate-limited."""


RATE_LIMIT_MESSAGE = "Rate limited — wait a moment or add your Groq key in Settings."


_active_provider: ContextVar[str | None] = ContextVar("active_provider", default=None)
_active_model: ContextVar[str | None] = ContextVar("active_model", default=None)
_active_routing: ContextVar[str | None] = ContextVar("active_routing", default=None)


def _set_llm_route(provider: str, model: str, routing: str) -> None:
    _active_provider.set(provider)
    _active_model.set(model)
    _active_routing.set(routing)


def get_active_provider() -> str | None:
    return _active_provider.get()


def get_llm_route() -> dict[str, str | None]:
    return {
        "provider": _active_provider.get(),
        "model": _active_model.get(),
        "routing": _active_routing.get(),
    }


def get_llm_routing_config() -> dict[str, str | None]:
    has_groq = bool(os.getenv("GROQ_API_KEY"))
    has_gemini = bool(os.getenv("GEMINI_API_KEY"))

    if has_groq:
        primary_provider, primary_model = "groq", GROQ_MODEL
    elif has_gemini:
        primary_provider, primary_model = "gemini", GEMINI_MODEL
    else:
        primary_provider, primary_model = None, None

    fallback_provider = "gemini" if has_groq and has_gemini else None
    fallback_model = GEMINI_MODEL if fallback_provider else None

    return {
        "primary_provider": primary_provider,
        "primary_model": primary_model,
        "fallback_provider": fallback_provider,
        "fallback_model": fallback_model,
    }


class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]


tools = [
    get_quarterly_financials,
    get_stock_price,
    get_analyst_sentiment,
    get_earnings_calendar,
]
tool_node = ToolNode(tools)

GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
GEMINI_FALLBACK_MODELS = os.getenv(
    "GEMINI_FALLBACK_MODELS",
    "gemini-2.5-flash,gemini-2.0-flash",
)
GEMINI_MAX_OUTPUT_TOKENS = int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "1200"))


def gemini_model_chain() -> list[str]:
    models: list[str] = []
    for name in (GEMINI_MODEL, *GEMINI_FALLBACK_MODELS.split(",")):
        candidate = name.strip()
        if candidate and candidate not in models:
            models.append(candidate)
    return models


def get_groq_llm(groq_api_key: str):
    llm = ChatGroq(
        model=GROQ_MODEL,
        temperature=0.1,
        groq_api_key=groq_api_key,
    )
    return llm.bind_tools(tools)


def get_gemini_llm(gemini_api_key: str, model: str | None = None):
    llm = ChatGoogleGenerativeAI(
        model=model or GEMINI_MODEL,
        temperature=0.2,
        top_p=0.9,
        max_output_tokens=GEMINI_MAX_OUTPUT_TOKENS,
        api_key=gemini_api_key,
    )
    return llm.bind_tools(tools)


def invoke_gemini(gemini_api_key: str, messages) -> tuple[BaseMessage, str]:
    """Try primary Gemini model, then fallbacks when a model is rate-limited."""
    last_rate_error: Exception | None = None
    for model in gemini_model_chain():
        try:
            response = get_gemini_llm(gemini_api_key, model=model).invoke(messages)
            return response, model
        except Exception as exc:
            if is_rate_limit_error(exc):
                logger.warning("Gemini model %s rate-limited — trying next model", model)
                last_rate_error = exc
                continue
            raise
    if last_rate_error:
        raise last_rate_error
    raise RuntimeError("No Gemini models configured")


def is_rate_limit_error(exc: Exception) -> bool:
    current: BaseException | None = exc
    while current is not None:
        text = str(current).lower()
        if any(
            term in text
            for term in (
                "429",
                "rate limit",
                "rate_limit",
                "too many requests",
                "quota",
                "resource_exhausted",
            )
        ):
            return True

        status = getattr(current, "status_code", None)
        if status == 429:
            return True

        response = getattr(current, "response", None)
        if response is not None and getattr(response, "status_code", None) == 429:
            return True

        current = current.__cause__
    return False


SYSTEM_PROMPT = SystemMessage(content=(
    "You are a senior equity research analyst on a fintech terminal. You help users understand "
    "individual stocks using live quotes, quarterly fundamentals, analyst sentiment, and earnings dates.\n\n"
    "## Voice and tone\n"
    "- Write like a Bloomberg or terminal desk analyst: direct, calm, and professional.\n"
    "- Lead with the answer. Use plain English. Short paragraphs; bullets only for numbers or comparisons.\n"
    "- Be concise. Most replies should be 3–8 sentences unless the user asks for a deep dive.\n"
    "- Never sound like API documentation, a tutorial, or a chatbot explaining its capabilities.\n\n"
    "## Hard rules (never break these)\n"
    "- NEVER describe, list, or name your internal tools/functions to the user "
    "(no 'get_stock_price', 'provided functions', 'the functions I have access to', etc.).\n"
    "- NEVER say phrases like 'based on the provided functions', 'I was unable to find using the tools', "
    "or 'you would need a different function'.\n"
    "- NEVER invent prices, targets, dates, or financial figures. Only cite numbers returned by tools.\n"
    "- If data is missing or a request is outside scope, say so in 1–3 sentences and offer a practical next step.\n\n"
    "## What you can do\n"
    "- Analyze ONE ticker at a time when the user names a symbol (e.g. AAPL, NVDA, SHOP.TO).\n"
    "- Pull: last 8 quarters of cached financials, live quote, analyst consensus/targets, upcoming earnings.\n"
    "- Cached fundamentals tickers: AAPL, MSFT, NVDA, TSLA, AMZN, WYFI, META, GOOGL, NFLX, JPM, V.\n"
    "- For other symbols you can still fetch live price, sentiment, and earnings when available.\n"
    "- Canadian listings often use a .TO suffix (e.g. SHOP.TO). Prices from Finnhub are typically in USD unless noted.\n\n"
    "## What you cannot do\n"
    "- No market-wide screeners: you cannot list 'trending stocks', filter by price (e.g. under $50 CAD), "
    "or rank the entire market.\n"
    "- If asked for a screener or vague list, reply briefly: this desk covers one symbol at a time, "
    "then suggest 2–3 well-known tickers the user could ask about, or ask them to name a symbol.\n"
    "- ETFs may lack corporate quarterly filings; price and sentiment may still be available.\n\n"
    "## How to use tools (internal — do not mention this section to the user)\n"
    "- Financials → get_quarterly_financials(ticker)\n"
    "- Live quote → get_stock_price(ticker)\n"
    "- Analyst views → get_analyst_sentiment(ticker)\n"
    "- Earnings → get_earnings_calendar(ticker)\n"
    "- Call tools proactively when the user names a ticker or asks about price, fundamentals, sentiment, or earnings.\n"
    "- Combine tool results into one cohesive answer with QoQ/YoY context where useful.\n"
    "- Attribute sources naturally in prose (e.g. 'Finnhub quote as of…', 'cached quarterly filings') — not as a tool inventory.\n"
))


def call_model(state: AgentState, config: RunnableConfig):
    configurable = config.get("configurable", {}) if config else {}
    groq_api_key = configurable.get("groq_api_key") or get_groq_key()
    gemini_api_key = configurable.get("gemini_api_key") or get_gemini_key()

    if not groq_api_key and not gemini_api_key:
        raise ValueError(
            "An LLM API key is required. Add a Groq key in Settings or configure GEMINI_API_KEY on the server."
        )

    messages = [SYSTEM_PROMPT] + list(state["messages"])
    rate_limit_error: Exception | None = None

    if groq_api_key:
        try:
            response = get_groq_llm(groq_api_key).invoke(messages)
            _set_llm_route("groq", GROQ_MODEL, "primary")
            return {"messages": [response]}
        except Exception as exc:
            if is_rate_limit_error(exc) and gemini_api_key:
                logger.warning("Groq rate limit hit — falling back to Gemini")
                rate_limit_error = exc
            elif is_rate_limit_error(exc):
                raise LLMRateLimitError(RATE_LIMIT_MESSAGE) from exc
            else:
                raise

    if gemini_api_key:
        try:
            response, model_used = invoke_gemini(gemini_api_key, messages)
            routing = "fallback" if rate_limit_error else "primary"
            _set_llm_route("gemini", model_used, routing)
            return {"messages": [response]}
        except Exception as exc:
            if is_rate_limit_error(exc):
                raise LLMRateLimitError(RATE_LIMIT_MESSAGE) from exc
            raise

    if rate_limit_error:
        raise LLMRateLimitError(RATE_LIMIT_MESSAGE) from rate_limit_error

    raise ValueError(
        "Groq rate limit reached and no Gemini fallback is configured. Add GEMINI_API_KEY to server .env."
    )


def should_continue(state: AgentState) -> Literal["tools", "__end__"]:
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tools"
    return "__end__"


workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.add_node("tools", tool_node)
workflow.add_edge(START, "agent")
workflow.add_conditional_edges(
    "agent",
    should_continue,
    {
        "tools": "tools",
        "__end__": END,
    },
)
workflow.add_edge("tools", "agent")

app = workflow.compile()
