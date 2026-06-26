import sqlite3
import json
import os
from datetime import datetime

_default_db = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "financials.db"))
DB_PATH = os.path.abspath(os.getenv("DATABASE_PATH", _default_db))


def get_db_connection():
    """Returns a connection to the SQLite database with row factory enabled."""
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the SQLite database and creates the necessary tables."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS financial_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                period_ending TEXT NOT NULL,
                report_type TEXT NOT NULL, -- 'income_statement', 'balance_sheet', 'cash_flow'
                data TEXT NOT NULL,         -- JSON string of normalized metric key-value pairs
                updated_at TEXT NOT NULL,
                UNIQUE(ticker, period_ending, report_type)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ticker_metadata (
                ticker TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.commit()

def save_quarterly_report(ticker: str, period_ending: str, report_type: str, data_dict: dict):
    """Saves or updates a quarterly financial report in the database."""
    now_str = datetime.utcnow().isoformat()
    data_json = json.dumps(data_dict)
    
    with get_db_connection() as conn:
        conn.execute("""
            INSERT INTO financial_reports (ticker, period_ending, report_type, data, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(ticker, period_ending, report_type) DO UPDATE SET
                data = excluded.data,
                updated_at = excluded.updated_at
        """, (ticker.upper(), period_ending, report_type, data_json, now_str))
        conn.commit()

def get_quarterly_reports(ticker: str, report_type: str = None) -> list:
    """Retrieves quarterly financial reports for a given ticker."""
    query = "SELECT ticker, period_ending, report_type, data, updated_at FROM financial_reports WHERE ticker = ?"
    params = [ticker.upper()]
    
    if report_type:
        query += " AND report_type = ?"
        params.append(report_type)
        
    query += " ORDER BY period_ending DESC"
    
    with get_db_connection() as conn:
        rows = conn.execute(query, params).fetchall()
        
    results = []
    for row in rows:
        results.append({
            "ticker": row["ticker"],
            "period_ending": row["period_ending"],
            "report_type": row["report_type"],
            "data": json.loads(row["data"]),
            "updated_at": row["updated_at"]
        })
    return results

def save_ticker_metadata(ticker: str, name: str) -> None:
    if not name:
        return
    now_str = datetime.utcnow().isoformat()
    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO ticker_metadata (ticker, name, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(ticker) DO UPDATE SET
                name = excluded.name,
                updated_at = excluded.updated_at
            """,
            (ticker.strip().upper(), name.strip(), now_str),
        )
        conn.commit()


def get_ticker_metadata(ticker: str) -> str | None:
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT name FROM ticker_metadata WHERE ticker = ?",
            (ticker.strip().upper(),),
        ).fetchone()
    return row["name"] if row else None


def search_ticker_metadata(query: str, limit: int = 12) -> list[dict]:
    q = query.strip()
    if not q:
        return []

    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT m.ticker, m.name,
                   COUNT(DISTINCT f.period_ending) AS quarters,
                   MAX(f.updated_at) AS updated_at
            FROM ticker_metadata m
            LEFT JOIN financial_reports f ON f.ticker = m.ticker
            WHERE m.ticker LIKE ? OR m.name LIKE ?
            GROUP BY m.ticker, m.name
            ORDER BY
                CASE WHEN m.ticker = ? THEN 0
                     WHEN m.ticker LIKE ? THEN 1
                     WHEN m.name LIKE ? THEN 2
                     ELSE 3 END,
                m.ticker
            LIMIT ?
            """,
            (
                f"%{q.upper()}%",
                f"%{q}%",
                q.upper(),
                f"{q.upper()}%",
                f"{q}%",
                limit,
            ),
        ).fetchall()

    return [
        {
            "ticker": row["ticker"],
            "name": row["name"],
            "quarters": row["quarters"] or 0,
            "has_fundamentals": (row["quarters"] or 0) > 0,
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]


def list_cached_tickers() -> list[dict]:
    """All tickers with fundamentals in the local SQLite cache."""
    with get_db_connection() as conn:
        rows = conn.execute("""
            SELECT ticker,
                   COUNT(DISTINCT period_ending) AS quarters,
                   MAX(updated_at) AS updated_at
            FROM financial_reports
            GROUP BY ticker
            ORDER BY ticker
        """).fetchall()

    return [
        {
            "ticker": row["ticker"],
            "quarters": row["quarters"],
            "has_fundamentals": True,
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]


def has_cached_fundamentals(ticker: str) -> bool:
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT 1 FROM financial_reports WHERE ticker = ? LIMIT 1",
            (ticker.strip().upper(),),
        ).fetchone()
    return row is not None


def search_cached_tickers(query: str, limit: int = 12) -> list[dict]:
    """Prefix/substring search over cached tickers."""
    q = query.strip().upper()
    if not q:
        return list_cached_tickers()[:limit]

    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT ticker,
                   COUNT(DISTINCT period_ending) AS quarters,
                   MAX(updated_at) AS updated_at
            FROM financial_reports
            WHERE ticker LIKE ?
            GROUP BY ticker
            ORDER BY
                CASE WHEN ticker = ? THEN 0
                     WHEN ticker LIKE ? THEN 1
                     ELSE 2 END,
                ticker
            LIMIT ?
            """,
            (f"%{q}%", q, f"{q}%", limit),
        ).fetchall()

    return [
        {
            "ticker": row["ticker"],
            "quarters": row["quarters"],
            "has_fundamentals": True,
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]
