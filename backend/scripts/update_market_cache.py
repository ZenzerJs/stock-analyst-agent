#!/usr/bin/env python3
"""Refresh tracked demo tickers and write git-friendly market snapshots under data/market/."""

from __future__ import annotations

import json
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import yfinance as yf

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data" / "market"
LATEST_PATH = DATA_DIR / "latest.json"
COMMIT_MSG_PATH = DATA_DIR / ".commit-message.txt"
DAILY_DIR = DATA_DIR / "daily"

DEFAULT_TICKERS = [
    t.strip().upper()
    for t in os.getenv(
        "MARKET_UPDATE_TICKERS",
        "AAPL,MSFT,NVDA,TSLA,AMZN",
    ).split(",")
    if t.strip()
]

PRICE_EPS = 0.005  # ignore sub-penny noise when comparing to previous snapshot


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _parse_earnings_date(raw: Any) -> date | None:
    if raw is None:
        return None
    if isinstance(raw, list):
        candidates = [_parse_earnings_date(item) for item in raw]
        candidates = [d for d in candidates if d is not None]
        if not candidates:
            return None
        today = date.today()
        future = [d for d in candidates if d >= today]
        return min(future) if future else max(candidates)
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, date):
        return raw
    if isinstance(raw, str):
        try:
            return datetime.strptime(raw[:10], "%Y-%m-%d").date()
        except ValueError:
            return None
    return None


def _fetch_ticker_snapshot(symbol: str) -> dict[str, Any]:
    ticker = yf.Ticker(symbol)
    info = ticker.info or {}
    fast = getattr(ticker, "fast_info", None) or {}

    price = (
        fast.get("lastPrice")
        or fast.get("regularMarketPrice")
        or info.get("currentPrice")
        or info.get("regularMarketPrice")
    )
    prev_close = fast.get("previousClose") or info.get("previousClose")
    volume = fast.get("lastVolume") or info.get("volume") or info.get("regularMarketVolume")

    change_pct = None
    if price is not None and prev_close:
        change_pct = round(((float(price) - float(prev_close)) / float(prev_close)) * 100, 2)

    earnings_date = None
    calendar = ticker.calendar
    if isinstance(calendar, dict):
        earnings_date = _parse_earnings_date(calendar.get("Earnings Date"))

    days_to_earnings = None
    if earnings_date:
        days_to_earnings = (earnings_date - date.today()).days

    return {
        "price": round(float(price), 4) if price is not None else None,
        "prev_close": round(float(prev_close), 4) if prev_close is not None else None,
        "change_pct": change_pct,
        "volume": int(volume) if volume is not None else None,
        "next_earnings": earnings_date.isoformat() if earnings_date else None,
        "days_to_earnings": days_to_earnings,
        "name": info.get("shortName") or info.get("longName") or symbol,
    }


def _load_previous() -> dict[str, Any] | None:
    if not LATEST_PATH.exists():
        return None
    try:
        return json.loads(LATEST_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def _snapshot_changed(prev: dict[str, Any] | None, current: dict[str, Any]) -> bool:
    if prev is None:
        return True

    prev_tickers = prev.get("tickers") or {}
    curr_tickers = current.get("tickers") or {}

    if set(prev_tickers.keys()) != set(curr_tickers.keys()):
        return True

    for symbol, row in curr_tickers.items():
        old = prev_tickers.get(symbol) or {}
        for field in ("price", "change_pct", "volume", "next_earnings", "days_to_earnings"):
            new_val = row.get(field)
            old_val = old.get(field)
            if field == "price" and new_val is not None and old_val is not None:
                if abs(float(new_val) - float(old_val)) >= PRICE_EPS:
                    return True
                continue
            if new_val != old_val:
                return True
    return False


def _format_pct(value: float | None) -> str:
    if value is None:
        return "n/a"
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.2f}%"


def _build_commit_message(snapshot: dict[str, Any], previous: dict[str, Any] | None) -> str:
    today = date.today().isoformat()
    tickers = snapshot.get("tickers") or {}
    prev_tickers = (previous or {}).get("tickers") or {}

    move_bits: list[str] = []
    for symbol in DEFAULT_TICKERS:
        row = tickers.get(symbol) or {}
        prev = prev_tickers.get(symbol) or {}
        change = row.get("change_pct")
        if change is not None:
            move_bits.append(f"{symbol} {_format_pct(change)}")
        elif row.get("price") is not None and prev.get("price") is not None:
            old_p = float(prev["price"])
            new_p = float(row["price"])
            if old_p:
                delta = round(((new_p - old_p) / old_p) * 100, 2)
                move_bits.append(f"{symbol} {_format_pct(delta)} since last run")

    earnings_bits: list[str] = []
    for symbol in DEFAULT_TICKERS:
        row = tickers.get(symbol) or {}
        days = row.get("days_to_earnings")
        if days is not None and 0 <= days <= 7:
            label = "today" if days == 0 else f"in {days}d"
            earnings_bits.append(f"{symbol} earnings {label}")

    highlights = move_bits[:3]
    if earnings_bits:
        highlights.append(earnings_bits[0])

    summary = ", ".join(highlights) if highlights else "quotes refreshed"
    return f"market: {today} {summary}"


def build_snapshot() -> dict[str, Any]:
    tickers: dict[str, Any] = {}
    errors: list[str] = []

    for symbol in DEFAULT_TICKERS:
        try:
            tickers[symbol] = _fetch_ticker_snapshot(symbol)
        except Exception as exc:  # noqa: BLE001 — batch job should continue on single-ticker failure
            errors.append(f"{symbol}: {exc}")

    if not tickers:
        raise RuntimeError(f"No ticker data fetched. Errors: {'; '.join(errors)}")

    return {
        "updated_at": _utc_now_iso(),
        "market_date": date.today().isoformat(),
        "tickers": tickers,
        "errors": errors,
    }


def main() -> int:
    if date.today().weekday() >= 5 and os.getenv("MARKET_UPDATE_ALLOW_WEEKEND") != "1":
        print("Weekend — skipping market update (set MARKET_UPDATE_ALLOW_WEEKEND=1 to override).")
        return 0

    previous = _load_previous()
    snapshot = build_snapshot()

    if not _snapshot_changed(previous, snapshot):
        print("No meaningful market changes — skipping write.")
        return 0

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    DAILY_DIR.mkdir(parents=True, exist_ok=True)

    payload = json.dumps(snapshot, indent=2, sort_keys=True) + "\n"
    LATEST_PATH.write_text(payload, encoding="utf-8")

    daily_path = DAILY_DIR / f"{snapshot['market_date']}.json"
    daily_path.write_text(payload, encoding="utf-8")

    commit_message = _build_commit_message(snapshot, previous)
    COMMIT_MSG_PATH.write_text(commit_message + "\n", encoding="utf-8")

    print(commit_message)
    if snapshot.get("errors"):
        print("Partial errors:", "; ".join(snapshot["errors"]))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"Market update failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
