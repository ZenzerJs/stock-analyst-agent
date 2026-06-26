"""Structured quarterly fundamentals for visual dashboard charts."""

from __future__ import annotations

from app.database import get_quarterly_reports, has_cached_fundamentals
from app.filing_attribution import build_latest_filing_attribution

# Metric aliases — first match wins per quarter
HIGHLIGHT_METRICS = {
    "revenue": ["Total Revenue", "Revenue", "Total Revenues"],
    "net_income": ["Net Income", "Net Income Common Stockholders"],
    "eps": ["Diluted EPS", "Basic EPS"],
    "gross_profit": ["Gross Profit"],
    "operating_income": ["Operating Income"],
    "operating_cash_flow": [
        "Operating Cash Flow",
        "Cash Flow From Operating Activities",
    ],
    "free_cash_flow": ["Free Cash Flow"],
    "total_assets": ["Total Assets"],
    "stockholders_equity": [
        "Stockholders Equity",
        "Total Stockholders Equity",
    ],
}

SECTION_ORDER = ["income_statement", "balance_sheet", "cash_flow"]

SECTION_LABELS = {
    "income_statement": "Income Statement",
    "balance_sheet": "Balance Sheet",
    "cash_flow": "Cash Flow",
}

CORE_DISPLAY = {
    "income_statement": [
        "Total Revenue",
        "Revenue",
        "Gross Profit",
        "Operating Income",
        "Net Income",
        "Diluted EPS",
        "Basic EPS",
    ],
    "balance_sheet": [
        "Total Assets",
        "Total Liabilities Net Minor Interest",
        "Total Liabilities",
        "Stockholders Equity",
        "Total Stockholders Equity",
        "Cash And Cash Equivalents",
    ],
    "cash_flow": [
        "Operating Cash Flow",
        "Cash Flow From Operating Activities",
        "Capital Expenditure",
        "Free Cash Flow",
    ],
}


def _pick_metric(data: dict, aliases: list[str]) -> float | None:
    for key in aliases:
        val = data.get(key)
        if val is not None and isinstance(val, (int, float)):
            return float(val)
    return None


def _sorted_reports(reports: list[dict]) -> list[dict]:
    return sorted(reports, key=lambda r: r["period_ending"])


def _build_series(reports: list[dict], aliases: list[str]) -> list[float | None]:
    return [_pick_metric(r["data"], aliases) for r in reports]


def build_fundamentals_payload(ticker: str) -> dict:
    ticker_clean = ticker.strip().upper()
    if not has_cached_fundamentals(ticker_clean):
        return {
            "ticker": ticker_clean,
            "has_data": False,
            "quarters": [],
            "highlights": {},
            "sections": {},
        }

    all_reports = get_quarterly_reports(ticker_clean)
    by_type: dict[str, list[dict]] = {}
    for report in all_reports:
        by_type.setdefault(report["report_type"], []).append(report)

    for rtype in by_type:
        by_type[rtype] = _sorted_reports(by_type[rtype])

    income = by_type.get("income_statement", [])
    quarters = [r["period_ending"] for r in income] if income else []

    if not quarters:
        for reports in by_type.values():
            if reports:
                quarters = [r["period_ending"] for r in reports]
                break

    highlights = {}
    for key, aliases in HIGHLIGHT_METRICS.items():
        source_type = (
            "income_statement"
            if key in {"revenue", "net_income", "eps", "gross_profit", "operating_income"}
            else "balance_sheet"
            if key in {"total_assets", "stockholders_equity"}
            else "cash_flow"
        )
        reports = by_type.get(source_type, [])
        if reports:
            highlights[key] = {
                "label": key.replace("_", " ").title(),
                "quarters": [r["period_ending"] for r in reports],
                "values": _build_series(reports, aliases),
            }

    sections = {}
    for rtype in SECTION_ORDER:
        reports = by_type.get(rtype, [])
        if not reports:
            continue

        all_keys: set[str] = set()
        for r in reports:
            all_keys.update(r["data"].keys())

        core = [k for k in CORE_DISPLAY.get(rtype, []) if k in all_keys]
        other = sorted(k for k in all_keys if k not in core)
        ordered = core + other[:8]

        metrics = []
        for metric_key in ordered:
            values = []
            for r in reports:
                val = r["data"].get(metric_key)
                if val is not None and isinstance(val, (int, float)):
                    values.append(float(val))
                else:
                    values.append(None)
            metrics.append(
                {
                    "key": metric_key,
                    "label": metric_key,
                    "quarters": [r["period_ending"] for r in reports],
                    "values": values,
                    "is_eps": "EPS" in metric_key,
                }
            )

        sections[rtype] = {
            "label": SECTION_LABELS[rtype],
            "quarters": [r["period_ending"] for r in reports],
            "metrics": metrics,
        }

    latest_period = quarters[-1] if quarters else None

    return {
        "ticker": ticker_clean,
        "has_data": True,
        "quarters": quarters,
        "quarter_count": len(quarters),
        "highlights": highlights,
        "sections": sections,
        "latest_filing": build_latest_filing_attribution(ticker_clean, latest_period),
    }
