import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import init_db
from app.ingest import ingest_ticker_data, extrapolate_ticker_to_8_quarters

TICKERS = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "WYFI", "XDIV", "META", "GOOGL", "NFLX", "JPM", "V"]


def extrapolate_to_8_quarters():
    """Ensure all batch tickers have 8 quarters."""
    print("Checking database for missing quarters and extrapolating to 8 quarters...")
    for ticker in TICKERS:
        extrapolate_ticker_to_8_quarters(ticker)


def main():
    print("Initializing Database...")
    init_db()
    print("Database Initialized.")

    for ticker in TICKERS:
        try:
            ingest_ticker_data(ticker)
            print(f"  Ingested {ticker}")
        except Exception as e:
            print(f"Failed to ingest data for {ticker}: {e}")

    extrapolate_to_8_quarters()
    print("Data ingestion and extrapolation complete.")


if __name__ == "__main__":
    main()
