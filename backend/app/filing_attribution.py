"""Latest quarterly filing attribution — SEC filings via Yahoo Finance / yfinance."""

from __future__ import annotations

from datetime import date, datetime

import yfinance as yf

from app.database import get_ticker_metadata
from app.sources import _build_source


def _format_date(value: date | datetime | str | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value).split("T")[0]


def _latest_sec_quarterly_filing(ticker: str) -> dict | None:
    try:
        filings = yf.Ticker(ticker.strip().upper()).get_sec_filings() or []
    except Exception:
        return None

    quarterly = [f for f in filings if f.get("type") in ("10-Q", "10-K")]
    if not quarterly:
        return None

    quarterly.sort(key=lambda f: f.get("epochDate") or 0, reverse=True)
    latest = quarterly[0]
    return {
        "filing_type": latest.get("type"),
        "filing_date": _format_date(latest.get("date")),
        "filing_title": latest.get("title"),
        "filing_url": latest.get("edgarUrl"),
    }


def build_latest_filing_attribution(ticker: str, period_ending: str | None = None) -> dict:
    """
    Attribution for the most recent cached quarter.
    Company filings are with the SEC; Yahoo Finance aggregates them (not a broker).
    """
    ticker_clean = ticker.strip().upper()
    company_name = get_ticker_metadata(ticker_clean)
    exchange = None
    exchange_full = None

    try:
        info = yf.Ticker(ticker_clean).info or {}
        company_name = company_name or info.get("shortName") or info.get("longName")
        exchange_full = info.get("fullExchangeName") or info.get("exchange")
        exchange = info.get("exchange")
    except Exception:
        pass

    sec_filing = _latest_sec_quarterly_filing(ticker_clean)
    yahoo_fin = _build_source("yahoo_financials", ticker_clean)
    sec_edgar = _build_source("sec_edgar", ticker_clean)

    filing_type = sec_filing.get("filing_type") if sec_filing else "10-Q"
    filing_date = sec_filing.get("filing_date") if sec_filing else None
    filing_url = sec_filing.get("filing_url") if sec_filing else sec_edgar["url"]

    return {
        "company_name": company_name,
        "exchange": exchange_full or exchange,
        "period_ending": period_ending,
        "filing_type": filing_type,
        "filing_date": filing_date,
        "filed_with": "U.S. Securities and Exchange Commission (SEC)",
        "filed_by": company_name or ticker_clean,
        "data_provider": "Yahoo Finance",
        "data_provider_detail": (
            "Quarterly figures are company-reported SEC filings aggregated by Yahoo Finance. "
            "They are not quotes, recommendations, or trade confirmations from a broker-dealer."
        ),
        "filing_url": filing_url,
        "financials_url": yahoo_fin["url"],
        "sec_edgar_url": sec_edgar["url"],
    }
