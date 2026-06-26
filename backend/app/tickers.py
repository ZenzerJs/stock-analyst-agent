"""Ticker search — local fundamentals cache + yfinance symbol/name lookup."""

from __future__ import annotations

import time

import yfinance as yf

from app.database import (
    search_cached_tickers,
    search_ticker_metadata,
    has_cached_fundamentals,
    list_cached_tickers,
    get_ticker_metadata,
    save_ticker_metadata,
)


def _is_symbol_like(query: str) -> bool:
    cleaned = query.strip().replace(".", "").replace("-", "")
    return bool(cleaned) and cleaned.isalnum() and len(query.strip()) <= 8


def _resolve_ticker_name(symbol: str) -> str | None:
    sym = symbol.strip().upper()
    cached = get_ticker_metadata(sym)
    if cached:
        return cached

    try:
        info = yf.Ticker(sym).info or {}
        name = info.get("shortName") or info.get("longName")
        if name:
            save_ticker_metadata(sym, name)
        return name
    except Exception:
        return None


def _lookup_market_symbol(symbol: str) -> dict | None:
    sym = symbol.strip().upper()
    if not sym or len(sym) > 8 or not _is_symbol_like(sym):
        return None

    try:
        ticker = yf.Ticker(sym)
        info = ticker.info or {}
        price = info.get("regularMarketPrice") or info.get("currentPrice")
        name = info.get("shortName") or info.get("longName")
        if name:
            save_ticker_metadata(sym, name)
        if price is None and not info.get("symbol"):
            return None
        return {
            "ticker": sym,
            "name": name,
            "has_fundamentals": has_cached_fundamentals(sym),
            "quarters": 0,
            "source": "market",
        }
    except Exception:
        return None


def _search_market_by_name(query: str, limit: int) -> list[dict]:
    q = query.strip()
    if len(q) < 2:
        return []

    try:
        search = yf.Search(q, max_results=limit * 2, enable_fuzzy_query=True)
        quotes = search.quotes or []
    except Exception:
        return []

    results: list[dict] = []
    for item in quotes:
        if item.get("quoteType") != "EQUITY":
            continue

        sym = (item.get("symbol") or "").upper()
        if not sym:
            continue

        name = item.get("shortname") or item.get("longname")
        if name:
            save_ticker_metadata(sym, name)

        results.append(
            {
                "ticker": sym,
                "name": name,
                "has_fundamentals": has_cached_fundamentals(sym),
                "quarters": 0,
                "source": "search",
            }
        )
        if len(results) >= limit:
            break

    return results


def _enrich_cached_item(item: dict) -> dict:
    ticker = item["ticker"]
    name = item.get("name") or get_ticker_metadata(ticker) or _resolve_ticker_name(ticker)
    return {**item, "name": name, "source": item.get("source", "cache")}


def get_company_name(ticker: str) -> str | None:
    return get_ticker_metadata(ticker.strip().upper()) or _resolve_ticker_name(ticker.strip().upper())


def search_tickers(query: str, limit: int = 12) -> list[dict]:
    raw = query.strip()
    results: list[dict] = []
    seen: set[str] = set()

    if not raw:
        for item in list_cached_tickers()[:limit]:
            results.append(_enrich_cached_item(item))
        return results

    q_upper = raw.upper()
    symbol_like = _is_symbol_like(raw)

    for item in search_ticker_metadata(raw, limit=limit):
        ticker = item["ticker"]
        if ticker in seen:
            continue
        seen.add(ticker)
        results.append({**item, "source": "cache"})

    if symbol_like:
        for item in search_cached_tickers(q_upper, limit=limit):
            ticker = item["ticker"]
            if ticker in seen:
                continue
            seen.add(ticker)
            results.append(_enrich_cached_item(item))

        if q_upper not in seen:
            market = _lookup_market_symbol(q_upper)
            if market:
                results.insert(0, market)
                seen.add(q_upper)

    if " " in raw or not symbol_like or len(results) < limit:
        for item in _search_market_by_name(raw, limit=limit):
            ticker = item["ticker"]
            if ticker in seen:
                continue
            seen.add(ticker)
            results.append(item)

    return results[:limit]


def get_all_cached_tickers() -> list[dict]:
    return [_enrich_cached_item(item) for item in list_cached_tickers()]


_TAPE_CACHE: dict = {"items": [], "at": 0.0, "limit": 0}
_TAPE_TTL_SECONDS = 45


def get_ticker_tape(limit: int = 24) -> list[dict]:
    """Live quote strip for the header ticker tape."""
    now = time.time()
    if (
        _TAPE_CACHE["limit"] == limit
        and _TAPE_CACHE["items"]
        and now - _TAPE_CACHE["at"] < _TAPE_TTL_SECONDS
    ):
        return _TAPE_CACHE["items"]

    items = list_cached_tickers()[:limit]
    tape: list[dict] = []

    for item in items:
        sym = item["ticker"]
        name = item.get("name") or get_ticker_metadata(sym) or _resolve_ticker_name(sym)
        change_pct = None
        price = None

        try:
            fi = yf.Ticker(sym).fast_info
            price = fi.get("lastPrice")
            prev = fi.get("previousClose") or fi.get("regularMarketPreviousClose")
            if price is not None and prev:
                change_pct = round(((price - prev) / prev) * 100, 2)
        except Exception:
            pass

        tape.append(
            {
                "ticker": sym,
                "name": name,
                "price": price,
                "change_pct": change_pct,
                "has_fundamentals": True,
            }
        )

    _TAPE_CACHE.update({"items": tape, "at": now, "limit": limit})
    return tape
