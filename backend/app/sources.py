"""Trusted external sources mapped to data tools and tickers."""

from __future__ import annotations

SOURCE_CATALOG: dict[str, dict[str, str]] = {
    "yahoo_finance": {
        "label": "Yahoo Finance",
        "description": "Live quotes, charts, and market data",
        "url_template": "https://finance.yahoo.com/quote/{ticker}",
    },
    "google_finance": {
        "label": "Google Finance",
        "description": "Price history and market overview",
        "url_template": "https://www.google.com/finance/quote/{ticker}",
    },
    "nasdaq": {
        "label": "Nasdaq",
        "description": "Official exchange quote page",
        "url_template": "https://www.nasdaq.com/market-activity/stocks/{ticker_lower}",
    },
    "sec_edgar": {
        "label": "SEC EDGAR",
        "description": "Official SEC filings (10-Q, 10-K)",
        "url_template": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&search_text={ticker}&type=10-&dateb=&owner=include&count=40",
    },
    "yahoo_financials": {
        "label": "Yahoo Finance — Financials",
        "description": "Income statement, balance sheet, cash flow",
        "url_template": "https://finance.yahoo.com/quote/{ticker}/financials",
    },
    "yahoo_analysis": {
        "label": "Yahoo Finance — Analysis",
        "description": "Analyst ratings and price targets",
        "url_template": "https://finance.yahoo.com/quote/{ticker}/analysis",
    },
    "nasdaq_earnings": {
        "label": "Nasdaq — Earnings",
        "description": "Upcoming earnings calendar",
        "url_template": "https://www.nasdaq.com/market-activity/stocks/{ticker_lower}/earnings",
    },
    "finnhub": {
        "label": "Finnhub",
        "description": "Market data API used for live quotes",
        "url_template": "https://finnhub.io/",
    },
}

TOOL_SOURCE_IDS: dict[str, list[str]] = {
    "get_stock_price": ["yahoo_finance", "google_finance", "nasdaq", "finnhub"],
    "get_quarterly_financials": ["sec_edgar", "yahoo_financials"],
    "get_analyst_sentiment": ["yahoo_analysis", "yahoo_finance"],
    "get_earnings_calendar": ["nasdaq_earnings", "yahoo_finance"],
}

DASHBOARD_SOURCE_IDS = [
    "yahoo_finance",
    "google_finance",
    "sec_edgar",
    "yahoo_financials",
    "yahoo_analysis",
    "nasdaq_earnings",
]


def _build_source(source_id: str, ticker: str) -> dict[str, str]:
    meta = SOURCE_CATALOG[source_id]
    ticker_clean = ticker.strip().upper()
    ticker_lower = ticker_clean.lower()
    return {
        "id": source_id,
        "label": meta["label"],
        "description": meta["description"],
        "url": meta["url_template"].format(ticker=ticker_clean, ticker_lower=ticker_lower),
    }


def get_trusted_sources(ticker: str, tools_used: list[str] | None = None) -> list[dict[str, str]]:
    """Return verified external links for a ticker, optionally filtered by tools invoked."""
    ticker_clean = ticker.strip().upper()
    if not ticker_clean:
        return []

    if tools_used:
        source_ids: list[str] = []
        seen: set[str] = set()
        for tool in tools_used:
            for source_id in TOOL_SOURCE_IDS.get(tool, []):
                if source_id not in seen:
                    seen.add(source_id)
                    source_ids.append(source_id)
        if not source_ids:
            source_ids = ["yahoo_finance"]
    else:
        source_ids = DASHBOARD_SOURCE_IDS

    return [_build_source(source_id, ticker_clean) for source_id in source_ids if source_id in SOURCE_CATALOG]


def extract_ticker_from_steps(steps: list[dict], fallback_message: str = "") -> str | None:
    """Infer ticker from tool calls or the user message."""
    for step in steps:
        if step.get("type") != "tool_call":
            continue
        args = step.get("args") or {}
        ticker = args.get("ticker")
        if ticker:
            return str(ticker).strip().upper()

    upper = fallback_message.upper()
    known = [
        "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL",
        "NFLX", "JPM", "V", "WYFI", "XDIV",
    ]
    for ticker in known:
        if ticker in upper:
            return ticker
    return None
