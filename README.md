# Stock Analyst Agent

Local AI stock research desk — chat analyst, live charts, trusted source links, and 8-quarter fundamentals cache.

## Quick start

**Prerequisites:** Python 3.10+, Node.js 18+

```powershell
# 1. Clone and enter the repo
cd stock-analyst-agent

# 2. Python environment (one time)
python -m venv venv
.\venv\Scripts\pip install -r backend\requirements.txt

# 3. API keys — see below
copy backend\.env.example backend\.env
# Edit backend\.env with your keys

# 4. Optional: seed fundamentals cache
.\venv\Scripts\python.exe backend\scripts\ingest_financials.py

# 5. Run (two terminals)
.\start-backend.ps1
.\start-frontend.ps1
```

Open **http://localhost:5173**

---

## API keys (required for AI chat)

This repo does **not** ship with API keys. After cloning, you need your own free keys:

| Key | Get it | Used for |
|-----|--------|----------|
| **Groq** | [console.groq.com/keys](https://console.groq.com/keys) | AI analyst chat (primary) |
| **Gemini** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Fallback when Groq rate-limits *(optional)* |
| **Finnhub** | [finnhub.io/register](https://finnhub.io/register) | Live quotes, ratings, earnings *(optional)* |

Charts and price history work without Finnhub (yfinance). Chat requires Groq **or** Gemini on the server.

See [SECURITY.md](SECURITY.md) before exposing the backend beyond localhost.

**Deploy to production:** see [DEPLOY.md](DEPLOY.md) (Vercel + Railway recommended).

### Option A — `backend/.env` (recommended for local dev)

```powershell
copy backend\.env.example backend\.env
```

Edit `backend/.env`:

```env
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=llama-3.3-70b-versatile
FINNHUB_API_KEY=your_finnhub_key_here
```

`backend/.env` is gitignored — never commit it.

### Option B — In-app Settings (browser)

Click **API keys** in the header and paste keys there. Stored in your browser only (`localStorage`). Useful if you deploy the frontend without putting secrets on the server.

You can use both: `.env` is the server fallback; Settings overrides per browser session.

---

## What you get

- **Research desk** — sidebar charts + AI chat
- **Markets** — full-screen charts, ticker switcher, metrics
- **Chat** — persistent history, agent reasoning steps, source links
- **Backend** — FastAPI + LangGraph agent, 4 tools (fundamentals, price, sentiment, earnings)

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Swagger docs | http://localhost:8000/docs |

---

## Project layout

```
stock-analyst-agent/
├── backend/          # FastAPI + LangGraph + SQLite cache
├── frontend/         # Vite + React UI
├── start-backend.ps1
├── start-frontend.ps1
└── backend/.env.example   # template only — copy to .env
```

---

## Supported tickers

Fundamentals cache: `AAPL`, `MSFT`, `NVDA`, `TSLA`, `AMZN`, `META`, `GOOGL`, `NFLX`, `JPM`, `V`, `WYFI`

Any ticker works for live price/sentiment/earnings when Finnhub is configured.

---

## Disclaimer

Not financial advice. Data from third-party APIs and cached filings. Verify on linked sources (Yahoo Finance, SEC EDGAR, etc.) before making decisions.
