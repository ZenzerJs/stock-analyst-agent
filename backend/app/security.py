"""Shared security helpers."""

from __future__ import annotations

import os
import re

from fastapi import HTTPException

IS_PRODUCTION = os.getenv("ENV", "development").lower() == "production"

TICKER_PATTERN = re.compile(r"^[A-Z0-9][A-Z0-9.\-]{0,11}$")

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin.strip()
]

ALLOWED_CORS_HEADERS = [
    "Content-Type",
    "X-Groq-Api-Key",
    "X-Finnhub-Api-Key",
    "X-Gemini-Api-Key",
]


def validate_ticker(raw: str) -> str:
    ticker = raw.strip().upper()
    if not ticker or not TICKER_PATTERN.match(ticker):
        raise HTTPException(status_code=400, detail="Invalid ticker symbol.")
    return ticker

