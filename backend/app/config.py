"""Per-request API key resolution (BYOK shell — keys from headers or server .env)."""

from __future__ import annotations

import os
from contextvars import ContextVar
from typing import Optional

_groq_key: ContextVar[Optional[str]] = ContextVar("groq_api_key", default=None)
_finnhub_key: ContextVar[Optional[str]] = ContextVar("finnhub_api_key", default=None)
_gemini_key: ContextVar[Optional[str]] = ContextVar("gemini_api_key", default=None)


def set_request_keys(
    groq_key: Optional[str] = None,
    finnhub_key: Optional[str] = None,
    gemini_key: Optional[str] = None,
) -> None:
    _groq_key.set(groq_key or None)
    _finnhub_key.set(finnhub_key or None)
    _gemini_key.set(gemini_key or None)


def get_groq_key() -> Optional[str]:
    return _groq_key.get() or os.getenv("GROQ_API_KEY")


def get_finnhub_key() -> Optional[str]:
    return _finnhub_key.get() or os.getenv("FINNHUB_API_KEY")


def get_gemini_key() -> Optional[str]:
    return _gemini_key.get() or os.getenv("GEMINI_API_KEY")


def resolve_groq_key(header_key: Optional[str] = None) -> Optional[str]:
    if header_key and header_key.strip():
        return header_key.strip()
    return get_groq_key()


def resolve_finnhub_key(header_key: Optional[str] = None) -> Optional[str]:
    if header_key and header_key.strip():
        return header_key.strip()
    return get_finnhub_key()


def resolve_gemini_key(header_key: Optional[str] = None) -> Optional[str]:
    if header_key and header_key.strip():
        return header_key.strip()
    return get_gemini_key()
