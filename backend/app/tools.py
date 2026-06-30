from langchain_core.tools import tool
from app.database import get_quarterly_reports
from app.config import get_finnhub_key
import json
import os
import pandas as pd
import requests
import yfinance as yf
from datetime import datetime, timedelta

# Core financial metrics we want to highlight if present
CORE_METRICS = {
    "income_statement": [
        "Total Revenue", "Revenue", "Gross Profit", "Operating Income", 
        "Net Income", "Diluted EPS", "Basic EPS", "Operating Expense"
    ],
    "balance_sheet": [
        "Total Assets", "Total Liabilities Net Minor Interest", "Total Liabilities", 
        "Stockholders Equity", "Total Stockholders Equity", 
        "Cash Cash Equivalents And Short Term Investments", "Cash And Cash Equivalents"
    ],
    "cash_flow": [
        "Operating Cash Flow", "Cash Flow From Operating Activities", 
        "Capital Expenditure", "Free Cash Flow", "Repayment Of Debt"
    ]
}

# Agent tool output stays small: recent quarters + headline metrics only.
MAX_QUARTERLY_PERIODS = 4

@tool
def get_quarterly_financials(ticker: str) -> str:
    """Retrieves the last 4 quarters of core financial metrics (revenue, net income, EPS, cash flow, etc.) for a ticker from the local database cache."""
    ticker_clean = ticker.strip().upper()
    
    # Fetch all reports for this ticker
    reports = get_quarterly_reports(ticker_clean)
    
    if not reports:
        return (
            f"No cached quarterly financial reports found for ticker '{ticker_clean}'. "
            f"Please verify if the ticker is correct and is one of the supported tickers in our demo database: "
            f"AAPL, MSFT, NVDA, TSLA, AMZN, WYFI, META, GOOGL, NFLX, JPM, V. "
            f"Note: ETFs like XDIV do not have corporate fundamental statements."
        )

    # Group reports by type
    by_type = {}
    for r in reports:
        rtype = r["report_type"]
        if rtype not in by_type:
            by_type[rtype] = []
        by_type[rtype].append(r)
        
    output_parts = [f"# Quarterly Financials for {ticker_clean} (last {MAX_QUARTERLY_PERIODS} quarters, core metrics)\n"]
    
    for rtype in ["income_statement", "balance_sheet", "cash_flow"]:
        if rtype not in by_type:
            output_parts.append(f"## {rtype.replace('_', ' ').title()}\nNo data available.\n")
            continue
            
        # Most recent quarters only
        statement_reports = sorted(by_type[rtype], key=lambda x: x["period_ending"])[-MAX_QUARTERLY_PERIODS:]
        
        # Core headline metrics only — avoids flooding the agent context
        ordered_metrics = [
            k for k in CORE_METRICS.get(rtype, [])
            if any(k in r["data"] for r in statement_reports)
        ]
        if not ordered_metrics:
            output_parts.append(f"## {rtype.replace('_', ' ').title()}\nNo core metrics available.\n")
            continue
        
        # Build headers (dates)
        dates = [r["period_ending"] for r in statement_reports]
        headers = ["Metric"] + dates
        
        # Build rows
        rows = []
        for metric in ordered_metrics:
            row = [metric]
            for r in statement_reports:
                val = r["data"].get(metric)
                if val is None:
                    row.append("-")
                elif isinstance(val, (int, float)):
                    # Format large numbers to readable string (e.g. billions or millions)
                    if abs(val) >= 1_000_000_000:
                        row.append(f"{val / 1_000_000_000:.2f}B")
                    elif abs(val) >= 1_000_000:
                        row.append(f"{val / 1_000_000:.2f}M")
                    else:
                        row.append(f"{val:,.2f}")
                else:
                    row.append(str(val))
            rows.append(row)
            
        # Convert to markdown table
        title = rtype.replace("_", " ").title()
        table_str = f"## {title}\n\n"
        table_str += "| " + " | ".join(headers) + " |\n"
        table_str += "| " + " | ".join(["---"] * len(headers)) + " |\n"
        for row in rows:
            table_str += "| " + " | ".join(row) + " |\n"
        table_str += "\n"
        
        output_parts.append(table_str)
        
    return "\n".join(output_parts)

def fetch_quote_snapshot(ticker: str) -> dict | None:
    """Returns structured quote data for dashboard/API use."""
    ticker_clean = ticker.strip().upper()
    api_key = get_finnhub_key()
    if not api_key:
        return None

    url = f"https://finnhub.io/api/v1/quote?symbol={ticker_clean}&token={api_key}"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()

        if data.get("c") == 0 and data.get("o") == 0:
            return None

        return {
            "ticker": ticker_clean,
            "price": data.get("c"),
            "change": data.get("d"),
            "change_pct": data.get("dp"),
            "high": data.get("h"),
            "low": data.get("l"),
            "open": data.get("o"),
            "prev_close": data.get("pc"),
        }
    except Exception:
        return None


VALID_HISTORY_PERIODS = {"1mo", "3mo", "6mo", "1y", "2y"}


def _split_volume(volume, high, low, close) -> tuple[int | None, int | None]:
    """Estimate buy vs sell volume from daily OHLC (common candle-based split)."""
    if volume is None or pd.isna(volume):
        return None, None

    vol = int(volume)
    if high is None or low is None or close is None:
        return vol // 2, vol - vol // 2
    if pd.isna(high) or pd.isna(low) or pd.isna(close):
        return vol // 2, vol - vol // 2

    h, l, c = float(high), float(low), float(close)
    if h <= l:
        return vol // 2, vol - vol // 2

    buy = int(vol * (c - l) / (h - l))
    sell = vol - buy
    return buy, sell


def fetch_price_history(ticker: str, period: str = "6mo") -> dict:
    """Returns daily close prices for charting via yfinance."""
    ticker_clean = ticker.strip().upper()
    range_key = period if period in VALID_HISTORY_PERIODS else "6mo"

    try:
        hist = yf.Ticker(ticker_clean).history(period=range_key, auto_adjust=True)
        if hist.empty:
            return {
                "ticker": ticker_clean,
                "period": range_key,
                "points": [],
                "change_pct": None,
            }

        points = []
        for idx, row in hist.iterrows():
            close = row.get("Close")
            if close is None or pd.isna(close):
                continue
            open_val = row.get("Open")
            high_val = row.get("High")
            low_val = row.get("Low")
            volume = row.get("Volume")
            buy_vol, sell_vol = _split_volume(volume, high_val, low_val, close)
            point = {
                "date": idx.strftime("%Y-%m-%d"),
                "close": round(float(close), 2),
            }
            if open_val is not None and not pd.isna(open_val):
                point["open"] = round(float(open_val), 2)
            if high_val is not None and not pd.isna(high_val):
                point["high"] = round(float(high_val), 2)
            if low_val is not None and not pd.isna(low_val):
                point["low"] = round(float(low_val), 2)
            if volume is not None and not pd.isna(volume):
                point["volume"] = int(volume)
            if buy_vol is not None:
                point["buy_volume"] = buy_vol
            if sell_vol is not None:
                point["sell_volume"] = sell_vol
            points.append(point)

        change_pct = None
        if len(points) >= 2:
            start = points[0]["close"]
            end = points[-1]["close"]
            if start:
                change_pct = round(((end - start) / start) * 100, 2)

        return {
            "ticker": ticker_clean,
            "period": range_key,
            "points": points,
            "change_pct": change_pct,
        }
    except Exception:
        return {
            "ticker": ticker_clean,
            "period": range_key,
            "points": [],
            "change_pct": None,
        }


def fetch_sentiment_snapshot(ticker: str) -> dict:
    """Returns structured analyst sentiment for dashboard/API use."""
    ticker_clean = ticker.strip().upper()
    api_key = get_finnhub_key()
    result = {
        "rating": None,
        "target_mean": None,
        "strong_buy": 0,
        "buy": 0,
        "hold": 0,
        "sell": 0,
        "strong_sell": 0,
        "total_analysts": 0,
        "score": None,
        "score_pct": None,
        "sufficient_sample": False,
        "source": None,
        "period": None,
        "analysis_url": None,
        "recent_ratings": [],
    }

    if not api_key:
        merged = {**result, **_fetch_yahoo_sentiment_fallback(ticker_clean)}
        merged["analysis_url"] = f"https://finance.yahoo.com/quote/{ticker_clean}/analysis"
        merged["recent_ratings"] = fetch_recent_analyst_ratings(ticker_clean)
        return merged

    rec_url = f"https://finnhub.io/api/v1/stock/recommendation?symbol={ticker_clean}&token={api_key}"
    target_url = f"https://finnhub.io/api/v1/stock/price-target?symbol={ticker_clean}&token={api_key}"

    try:
        target_res = requests.get(target_url, timeout=10)
        if target_res.status_code == 200:
            target_data = target_res.json()
            if target_data and target_data.get("targetMean"):
                result["target_mean"] = target_data.get("targetMean")
    except Exception:
        pass

    if result["target_mean"] is None:
        try:
            info = yf.Ticker(ticker_clean).info
            result["target_mean"] = info.get("targetMeanPrice")
        except Exception:
            pass

    try:
        rec_res = requests.get(rec_url, timeout=10)
        rec_res.raise_for_status()
        rec_data = rec_res.json()
        if rec_data:
            latest = rec_data[0]
            breakdown = build_sentiment_breakdown(
                latest.get("strongBuy", 0),
                latest.get("buy", 0),
                latest.get("hold", 0),
                latest.get("sell", 0),
                latest.get("strongSell", 0),
            )
            if breakdown:
                result.update(breakdown)
                result["source"] = "finnhub"
                result["period"] = latest.get("period")
    except Exception:
        pass

    if not result.get("total_analysts"):
        fallback = _fetch_yahoo_sentiment_fallback(ticker_clean)
        for key, value in fallback.items():
            if result.get(key) in (None, 0, False) and value not in (None, 0, False):
                result[key] = value

    result["analysis_url"] = f"https://finance.yahoo.com/quote/{ticker_clean}/analysis"
    result["recent_ratings"] = fetch_recent_analyst_ratings(ticker_clean)
    return result


def fetch_earnings_snapshot(ticker: str) -> dict:
    """Returns next upcoming earnings event for dashboard/API use."""
    ticker_clean = ticker.strip().upper()
    api_key = get_finnhub_key()
    result = {"date": None, "eps_estimate": None, "hour": None}

    if not api_key:
        return result

    today = datetime.now()
    future_90 = today + timedelta(days=90)
    url = (
        f"https://finnhub.io/api/v1/calendar/earnings"
        f"?from={today.strftime('%Y-%m-%d')}&to={future_90.strftime('%Y-%m-%d')}"
        f"&symbol={ticker_clean}&token={api_key}"
    )

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        earnings = response.json().get("earningsCalendar", [])
        if earnings:
            event = earnings[0]
            result["date"] = event.get("date")
            result["eps_estimate"] = event.get("epsEstimate")
            result["hour"] = event.get("hour")
    except Exception:
        pass

    return result


def fetch_eps_snapshot(ticker: str) -> dict:
    """Trailing, forward, reported, and upcoming EPS estimates."""
    ticker_clean = ticker.strip().upper()
    result = {
        "trailing_eps": None,
        "forward_eps": None,
        "reported_eps": None,
        "reported_eps_quarter": None,
        "eps_estimate": None,
        "earnings_date": None,
    }

    try:
        info = yf.Ticker(ticker_clean).info or {}
        trailing = info.get("trailingEps")
        forward = info.get("forwardEps")
        if trailing is not None:
            result["trailing_eps"] = round(float(trailing), 2)
        if forward is not None:
            result["forward_eps"] = round(float(forward), 2)
    except Exception:
        pass

    reports = get_quarterly_reports(ticker_clean, "income_statement")
    if reports:
        latest = max(reports, key=lambda x: x["period_ending"])
        for key in ("Diluted EPS", "Basic EPS"):
            val = latest["data"].get(key)
            if val is not None and isinstance(val, (int, float)):
                result["reported_eps"] = round(float(val), 2)
                result["reported_eps_quarter"] = latest["period_ending"]
                break

    earnings = fetch_earnings_snapshot(ticker_clean)
    if earnings.get("eps_estimate") is not None:
        result["eps_estimate"] = round(float(earnings["eps_estimate"]), 2)
    result["earnings_date"] = earnings.get("date")

    return result


def fetch_volume_flow(history: dict) -> dict | None:
    """Aggregate buy/sell volume estimates from price history points."""
    points = history.get("points") or []
    if not points:
        return None

    latest = points[-1]
    period_buy = sum(p.get("buy_volume") or 0 for p in points)
    period_sell = sum(p.get("sell_volume") or 0 for p in points)
    total = period_buy + period_sell

    return {
        "latest_date": latest.get("date"),
        "latest_volume": latest.get("volume"),
        "latest_buy_volume": latest.get("buy_volume"),
        "latest_sell_volume": latest.get("sell_volume"),
        "period_buy_volume": period_buy,
        "period_sell_volume": period_sell,
        "buy_pct": round(100 * period_buy / total, 1) if total else None,
        "sell_pct": round(100 * period_sell / total, 1) if total else None,
    }


@tool
def get_stock_price(ticker: str) -> str:
    """Retrieves the real-time stock price and quote details for a ticker from Finnhub."""
    ticker_clean = ticker.strip().upper()
    snapshot = fetch_quote_snapshot(ticker_clean)
    if not snapshot:
        if not get_finnhub_key():
            return "Error: FINNHUB_API_KEY is not configured on the server."
        return f"Error: No real-time stock quote found for symbol '{ticker_clean}'."

    current = snapshot["price"]
    change = snapshot["change"]
    pct_change = snapshot["change_pct"]
    high = snapshot["high"]
    low = snapshot["low"]
    opened = snapshot["open"]
    prev_close = snapshot["prev_close"]

    return (
        f"### Real-time Quote for {ticker_clean}\n"
        f"- **Current Price**: ${current:,.2f}\n"
        f"- **Change**: ${change:+,.2f} ({pct_change:+.2f}%)\n"
        f"- **Open**: ${opened:,.2f} | **High**: ${high:,.2f} | **Low**: ${low:,.2f}\n"
        f"- **Previous Close**: ${prev_close:,.2f}\n"
    )

def get_consensus_label(sb, b, h, s, ss):
    total = sb + b + h + s + ss
    if total == 0:
        return "Unknown"
    score = (sb * 5 + b * 4 + h * 3 + s * 2 + ss * 1) / total
    if score >= 4.5:
        return "Strong Buy"
    elif score >= 3.5:
        return "Buy"
    elif score >= 2.5:
        return "Hold"
    elif score >= 1.5:
        return "Sell"
    return "Strong Sell"


def _normalize_grade(grade: str | None) -> str | None:
    if not grade:
        return None
    normalized = grade.strip().lower()
    mapping = {
        "strong buy": "Strong Buy",
        "buy": "Buy",
        "outperform": "Buy",
        "overweight": "Buy",
        "hold": "Hold",
        "neutral": "Hold",
        "equal-weight": "Hold",
        "market perform": "Hold",
        "sector perform": "Hold",
        "sell": "Sell",
        "underperform": "Sell",
        "underweight": "Sell",
        "strong sell": "Strong Sell",
    }
    for key, label in mapping.items():
        if key in normalized:
            return label
    return grade.strip().title()


# Bulge-bracket banks and widely cited research shops, highest recognition first.
# Each tuple holds lowercase substrings matched against Yahoo Finance firm names.
RECOGNIZED_FIRMS: tuple[tuple[str, ...], ...] = (
    ("goldman sachs", "goldman"),
    ("morgan stanley",),
    ("jpmorgan", "jp morgan", "j.p. morgan"),
    ("bank of america", "bofa", "merrill lynch", "merrill"),
    ("citigroup", "citi "),
    ("barclays",),
    ("ubs",),
    ("deutsche bank",),
    ("wells fargo",),
    ("credit suisse",),
    ("hsbc",),
    ("rbc capital", "royal bank of canada"),
    ("bmo capital",),
    ("jefferies",),
    ("evercore",),
    ("bernstein",),
    ("wolfe research",),
    ("mizuho",),
    ("nomura",),
    ("macquarie",),
    ("truist",),
    ("pnc",),
    ("scotiabank",),
    ("td securities", "td cowen", "cowen"),
    ("raymond james",),
    ("stifel",),
    ("piper sandler", "piper jaffray"),
    ("wedbush",),
    ("needham",),
    ("oppenheimer",),
    ("cantor fitzgerald", "cantor"),
    ("benchmark",),
    ("rosenblatt",),
    ("loop capital",),
    ("keybanc", "key banc"),
    ("william blair",),
    ("baird",),
    ("stephens",),
    ("b. riley", "b riley"),
    ("da davidson",),
    ("cfra",),
    ("argus research",),
    ("morningstar",),
    ("tigress financial",),
)

# Ignore firm notes older than this — stale change events mislead vs live consensus.
MAX_FIRM_RATING_AGE_DAYS = 540


def _is_recent_firm_rating(date_str: str | None) -> bool:
    if not date_str:
        return False
    try:
        rated = datetime.strptime(str(date_str)[:10], "%Y-%m-%d").date()
        return (datetime.now().date() - rated).days <= MAX_FIRM_RATING_AGE_DAYS
    except Exception:
        return False


def _firm_recognition_rank(firm: str) -> int:
    """Lower rank = more widely recognized. Unknown firms sort last."""
    normalized = firm.strip().lower()
    for rank, aliases in enumerate(RECOGNIZED_FIRMS):
        if any(alias in normalized for alias in aliases):
            return rank
    return len(RECOGNIZED_FIRMS)


def _firm_rating_summary(
    rating: str | None,
    action: str | None,
    price_target_action: str | None,
    price_target: float | None,
) -> str:
    parts: list[str] = []
    action_key = (action or "").lower()
    pt_action = (price_target_action or "").lower()

    if action_key == "upgrade":
        parts.append("Upgrade")
    elif action_key == "downgrade":
        parts.append("Downgrade")
    elif action_key == "init":
        parts.append("Initiated coverage")
    elif pt_action == "raises":
        parts.append("Raises target")
    elif pt_action == "lowers":
        parts.append("Lowers target")
    elif action_key in {"main", "reit"} or pt_action == "maintains":
        parts.append("Maintains")

    if rating:
        parts.append(rating)
    if price_target and price_target > 0:
        parts.append(f"${price_target:,.0f} target")

    return " · ".join(parts) if parts else (rating or "Rating update")


def fetch_recent_analyst_ratings(ticker: str, limit: int = 5) -> list[dict]:
    """Recent rating changes from notable firms (Yahoo Finance upgrade/downgrade feed)."""
    ticker_clean = ticker.strip().upper()
    analysis_url = f"https://finance.yahoo.com/quote/{ticker_clean}/analysis"

    try:
        df = yf.Ticker(ticker_clean).get_upgrades_downgrades()
        if df is None or df.empty:
            return []

        df = df.sort_index(ascending=False)
        latest_by_firm: dict[str, dict] = {}

        for grade_date, row in df.iterrows():
            firm = str(row.get("Firm") or "").strip()
            if not firm or firm in latest_by_firm:
                continue

            rating = _normalize_grade(str(row.get("ToGrade") or ""))
            previous = _normalize_grade(str(row.get("FromGrade") or "")) if row.get("FromGrade") else None
            action = str(row.get("Action") or "").strip().lower()
            pt_action = str(row.get("priceTargetAction") or "").strip()
            price_target = row.get("currentPriceTarget")
            pt_value = float(price_target) if price_target and float(price_target) > 0 else None
            date_str = grade_date.strftime("%Y-%m-%d") if hasattr(grade_date, "strftime") else str(grade_date)[:10]

            if not _is_recent_firm_rating(date_str):
                continue

            latest_by_firm[firm] = {
                "firm": firm,
                "rating": rating or "—",
                "previous_rating": previous,
                "action": action or None,
                "price_target_action": pt_action or None,
                "price_target": pt_value,
                "date": date_str,
                "summary": _firm_rating_summary(rating, action, pt_action, pt_value),
                "url": analysis_url,
                "recognition_rank": _firm_recognition_rank(firm),
            }

        candidates = list(latest_by_firm.values())
        if not candidates:
            return []

        recognized = [c for c in candidates if c["recognition_rank"] < len(RECOGNIZED_FIRMS)]
        unknown = [c for c in candidates if c["recognition_rank"] >= len(RECOGNIZED_FIRMS)]

        recognized.sort(key=lambda c: c["date"], reverse=True)
        recognized.sort(key=lambda c: c["recognition_rank"])
        unknown.sort(key=lambda c: c["date"], reverse=True)

        results = (recognized + unknown)[:limit]
        for item in results:
            item.pop("recognition_rank", None)
        return results
    except Exception:
        return []


def build_sentiment_breakdown(sb: int, b: int, h: int, s: int, ss: int) -> dict | None:
    total = int(sb or 0) + int(b or 0) + int(h or 0) + int(s or 0) + int(ss or 0)
    if total == 0:
        return None

    score = (sb * 5 + b * 4 + h * 3 + s * 2 + ss * 1) / total
    score_pct = max(0.0, min(100.0, ((score - 1) / 4) * 100))
    rating = get_consensus_label(sb, b, h, s, ss)

    return {
        "rating": rating,
        "strong_buy": int(sb or 0),
        "buy": int(b or 0),
        "hold": int(h or 0),
        "sell": int(s or 0),
        "strong_sell": int(ss or 0),
        "total_analysts": total,
        "score": round(score, 2),
        "score_pct": round(score_pct, 1),
        "sufficient_sample": total >= 10,
    }


def _fetch_yahoo_sentiment_fallback(ticker: str) -> dict:
    """Best-effort analyst snapshot when Finnhub recommendation breakdown is unavailable."""
    result = {"rating": None, "target_mean": None}
    try:
        ticker_obj = yf.Ticker(ticker)
        info = ticker_obj.info or {}
        result["target_mean"] = info.get("targetMeanPrice")

        rec_df = ticker_obj.get_recommendations()
        if rec_df is not None and not rec_df.empty:
            latest = rec_df.iloc[0]
            breakdown = build_sentiment_breakdown(
                latest.get("strongBuy", 0),
                latest.get("buy", 0),
                latest.get("hold", 0),
                latest.get("sell", 0),
                latest.get("strongSell", 0),
            )
            if breakdown:
                breakdown["source"] = "yahoo_trends"
                result.update(breakdown)
                return result

        opinions = int(info.get("numberOfAnalystOpinions") or 0)
        yahoo_mean = info.get("recommendationMean")
        if opinions > 0 and yahoo_mean is not None:
            # Yahoo: 1 = Strong Buy … 5 = Strong Sell → invert to our 1–5 scale
            score = max(1.0, min(5.0, 6.0 - float(yahoo_mean)))
            sb = b = h = s = ss = 0
            if score >= 4.5:
                sb = opinions
            elif score >= 3.5:
                b = opinions
            elif score >= 2.5:
                h = opinions
            elif score >= 1.5:
                s = opinions
            else:
                ss = opinions
            breakdown = build_sentiment_breakdown(sb, b, h, s, ss)
            if breakdown:
                breakdown["source"] = "yahoo_summary"
                result.update(breakdown)
    except Exception:
        pass
    return result

@tool
def get_analyst_sentiment(ticker: str) -> str:
    """Retrieves the analyst recommendation consensus trends and consensus target prices for a ticker from Finnhub (with free Yahoo Finance fallback for target prices)."""
    ticker_clean = ticker.strip().upper()
    api_key = get_finnhub_key()
    if not api_key:
        return "Error: FINNHUB_API_KEY is not configured on the server."
        
    rec_url = f"https://finnhub.io/api/v1/stock/recommendation?symbol={ticker_clean}&token={api_key}"
    target_url = f"https://finnhub.io/api/v1/stock/price-target?symbol={ticker_clean}&token={api_key}"
    
    output = [f"### Analyst Sentiment & Consensus for {ticker_clean}\n"]
    
    # 1. Fetch Target Prices (with yfinance fallback if forbidden/403 or empty)
    use_yfinance_fallback = False
    try:
        target_res = requests.get(target_url)
        if target_res.status_code == 200:
            target_data = target_res.json()
            if target_data and target_data.get("targetMean"):
                mean = target_data.get("targetMean")
                high = target_data.get("targetHigh")
                low = target_data.get("targetLow")
                median = target_data.get("targetMedian")
                output.append(
                    f"**Consensus Price Targets (Finnhub)**:\n"
                    f"- **Mean Target**: ${mean:,.2f}\n"
                    f"- **Median Target**: ${median:,.2f}\n"
                    f"- **High Target**: ${high:,.2f} | **Low Target**: ${low:,.2f}\n"
                )
            else:
                use_yfinance_fallback = True
        else:
            use_yfinance_fallback = True
    except Exception:
        use_yfinance_fallback = True

    if use_yfinance_fallback:
        try:
            stock = yf.Ticker(ticker_clean)
            info = stock.info
            mean = info.get("targetMeanPrice")
            high = info.get("targetHighPrice")
            low = info.get("targetLowPrice")
            median = info.get("targetMedianPrice")
            if mean:
                median_val = f"${median:,.2f}" if median else "N/A"
                output.append(
                    f"**Consensus Price Targets (Yahoo Finance Fallback)**:\n"
                    f"- **Mean Target**: ${mean:,.2f}\n"
                    f"- **Median Target**: {median_val}\n"
                    f"- **High Target**: ${high:,.2f} | **Low Target**: ${low:,.2f}\n"
                )
            else:
                output.append("No consensus price targets available.\n")
        except Exception as e:
            output.append(f"Error fetching analyst price targets via fallback: {str(e)}\n")
        
    # 2. Fetch Recommendation Trends
    try:
        rec_res = requests.get(rec_url)
        rec_res.raise_for_status()
        rec_data = rec_res.json()
        
        if rec_data:
            latest = rec_data[0]
            period = latest.get("period")
            strong_buy = latest.get("strongBuy", 0)
            buy = latest.get("buy", 0)
            hold = latest.get("hold", 0)
            sell = latest.get("sell", 0)
            strong_sell = latest.get("strongSell", 0)
            
            output.append(
                f"**Recommendation Trends (As of {period})**:\n"
                f"- **Strong Buy**: {strong_buy}\n"
                f"- **Buy**: {buy}\n"
                f"- **Hold**: {hold}\n"
                f"- **Sell**: {sell}\n"
                f"- **Strong Sell**: {strong_sell}\n"
                f"- **Consensus Rating**: {get_consensus_label(strong_buy, buy, hold, sell, strong_sell)}\n"
            )
        else:
            output.append("No recommendation trend data available.\n")
    except Exception as e:
        output.append(f"Error fetching recommendation trends: {str(e)}\n")
        
    return "\n".join(output)

@tool
def get_earnings_calendar(ticker: str) -> str:
    """Retrieves upcoming earnings dates and EPS estimates for a ticker from Finnhub within a 90-day window."""
    ticker_clean = ticker.strip().upper()
    api_key = get_finnhub_key()
    if not api_key:
        return "Error: FINNHUB_API_KEY is not configured on the server."
        
    today = datetime.now()
    future_90 = today + timedelta(days=90)
    
    from_date = today.strftime("%Y-%m-%d")
    to_date = future_90.strftime("%Y-%m-%d")
    
    url = f"https://finnhub.io/api/v1/calendar/earnings?from={from_date}&to={to_date}&symbol={ticker_clean}&token={api_key}"
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        earnings = data.get("earningsCalendar", [])
        if not earnings:
            return f"No upcoming earnings events scheduled for '{ticker_clean}' in the next 90 days."
            
        output = [f"### Upcoming Earnings for {ticker_clean}\n"]
        for event in earnings:
            date_str = event.get("date", "N/A")
            hour = event.get("hour", "N/A") # 'amc' (after market close), 'bmo' (before market open), etc.
            eps_est = event.get("epsEstimate")
            revenue_est = event.get("revenueEstimate")
            year = event.get("year", "N/A")
            quarter = event.get("quarter", "N/A")
            
            hour_label = "Before Market Open" if hour == "bmo" else "After Market Close" if hour == "amc" else hour
            eps_label = f"{eps_est:.2f}" if eps_est is not None else "N/A"
            rev_label = f"${revenue_est / 1_000_000_000:.2f}B" if revenue_est is not None else "N/A"
            
            output.append(
                f"- **Earnings Date**: {date_str} ({hour_label})\n"
                f"- **Fiscal Quarter/Year**: Q{quarter} {year}\n"
                f"- **Estimated EPS**: {eps_label}\n"
                f"- **Estimated Revenue**: {rev_label}\n"
            )
        return "\n".join(output)
    except Exception as e:
        return f"Error fetching earnings calendar for {ticker_clean}: {str(e)}"
