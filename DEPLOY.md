# Deployment guide

This app is **two parts**:

| Part | Stack | Best hosts |
|------|--------|------------|
| **Frontend** | Vite + React (static) | Vercel, Netlify, Cloudflare Pages |
| **Backend** | FastAPI + LangGraph + SQLite | Render, Railway, Fly.io, VPS |

The backend is **not** a good fit for Vercel serverless (Python agent, long chat requests, SQLite file).

---

## Already using Railway for something else?

If Railway’s free tier is tied up (e.g. **ML Stock Simulator** at `ml-stock-simulator.up.railway.app`), **don’t replace or delete that service** — that site will go down.

Use this split instead:

| App | Backend | Frontend |
|-----|---------|----------|
| Existing project (ML simulator, etc.) | **Keep on Railway** | As-is |
| **Stock Analyst** (this repo) | **Render** (free web service) | **Vercel** (free) |

→ Jump to **[Recommended: Vercel + Render](#recommended-vercel-ui--render-api)** below.

Railway is still fine for Stock Analyst if it’s your **only** backend on that account — see [Railway backend](#option-railway-backend-only).

---

## Recommended: Vercel (UI) + Render (API)

Best when Railway is unavailable or already in use. Render free tier allows a separate web service without touching Railway.

### 1. GitHub

Repo: [github.com/ZenzerJs/stock-analyst-agent](https://github.com/ZenzerJs/stock-analyst-agent) (`main` branch).

### 2. Deploy the backend (Render)

1. Go to [render.com](https://render.com) → sign in with GitHub.
2. **New +** → **Web Service**.
3. Connect **ZenzerJs/stock-analyst-agent**.
4. Configure:

   | Setting | Value |
   |---------|--------|
   | **Name** | `stock-analyst-api` *(or any name)* |
   | **Region** | Pick closest to you |
   | **Root Directory** | `backend` |
   | **Runtime** | **Docker** |
   | **Dockerfile Path** | `Dockerfile` *(relative to root directory — must be `backend/Dockerfile`)* |
   | **Instance type** | Free *(or paid if you need always-on)* |

   **If the build fails with `open Dockerfile: no such file or directory`:**

   - Confirm **Root Directory** is exactly `backend` (not blank), **or**
   - Leave Root Directory **blank** and use the repo-root `Dockerfile` instead (also valid).

   **Blueprint:** you can also use **New → Blueprint** and point at this repo — it reads `render.yaml`.

5. **Environment** → add variables *(never commit these)*:

   | Variable | Value |
   |----------|--------|
   | `ENV` | `production` |
   | `GROQ_API_KEY` | `gsk_...` |
   | `GEMINI_API_KEY` | `AIza...` *(fallback when Groq rate-limits)* |
   | `FINNHUB_API_KEY` | optional |
   | `DATABASE_PATH` | `/app/data/financials.db` |
   | `ALLOWED_ORIGINS` | `https://YOUR-APP.vercel.app` *(set after step 3)* |

6. **Advanced** → **Add disk**:
   - **Mount path:** `/app/data`
   - **Size:** 1 GB is enough for SQLite cache

7. **Create Web Service** → wait for deploy.
8. Note your URL, e.g. `https://stock-analyst-api.onrender.com`.
9. Test: `https://stock-analyst-api.onrender.com/api/health` → `{"status":"ok",...}`

**Free tier notes (Render):**

- Service **spins down after ~15 min idle** — first request may take 30–60s to wake.
- For a always-warm API, use a paid instance or a free cron ping *(optional)*.

**Seed fundamentals (optional):**

Render → your service → **Shell**:

```bash
python scripts/ingest_financials.py
```

Or use **Fetch & cache** in the Markets tab after deploy.

### 3. Deploy the frontend (Vercel)

1. [vercel.com](https://vercel.com) → **Add New Project** → import **ZenzerJs/stock-analyst-agent**.
2. **Root Directory:** `frontend`.
3. Framework: **Vite** (auto-detected).
4. **Environment Variables** (Production):

   | Name | Value |
   |------|--------|
   | `VITE_API_URL` | `https://stock-analyst-api.onrender.com/api` |

5. Deploy → copy your URL, e.g. `https://stock-analyst.vercel.app`.

### 4. Lock CORS

In Render → **Environment**, set:

```env
ALLOWED_ORIGINS=https://stock-analyst.vercel.app
```

Use your **exact** Vercel URL — no trailing slash. Save → Render redeploys.

### 5. Verify end-to-end

1. Open the Vercel URL → status should show **Live**.
2. Open **Chat** → send a message about a ticker (e.g. “What’s NVDA’s price?”).
3. If CORS fails, double-check `ALLOWED_ORIGINS` matches Vercel exactly.

---

## Option: Railway backend only

Use this only if Railway is **not** hosting another app you need to keep.

**Free tier caveats:**

- Often **one practical service** per project / limited credits.
- Deploys may be **blocked 8 AM–8 PM Eastern** on free tier — try after 8 PM or upgrade.
- Do **not** add Stock Analyst as a second service if ML Simulator must stay online.

### Railway steps

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**.
2. **Root Directory:** `backend`.
3. Uses `backend/Dockerfile` and `backend/railway.toml`.
4. **Variables** — same as Render table above.
5. **Volume** mounted at `/app/data`.
6. **Generate Domain** → e.g. `https://stock-analyst-api.up.railway.app`.
7. Test `/api/health`.

Frontend on Vercel with:

```env
VITE_API_URL=https://YOUR-BACKEND.up.railway.app/api
```

Update `ALLOWED_ORIGINS` on Railway to your Vercel URL.

---

## Option: One server with Docker (VPS or local)

Everything on one URL — simplest CORS, good for personal use.

```powershell
copy backend\.env.example backend\.env
# edit backend\.env

docker compose build
docker compose up -d
# → http://localhost:8080
```

- nginx serves the UI and proxies `/api` → backend.
- SQLite in Docker volume `backend-data`.

---

## Environment checklist (production)

```env
ENV=production
ALLOWED_ORIGINS=https://your-frontend-domain.com
GROQ_API_KEY=...
GEMINI_API_KEY=...          # recommended fallback
FINNHUB_API_KEY=...         # optional
DATABASE_PATH=/app/data/financials.db   # required with persistent disk/volume
```

**Do not** rely on browser Settings keys in production unless you accept BYOK risk (see [SECURITY.md](SECURITY.md)).

---

## Custom domain (optional)

| Piece | Where to configure |
|-------|-------------------|
| Frontend | Vercel → Domains |
| Backend | Render → Settings → Custom Domain, or Railway → Networking |
| CORS | Update `ALLOWED_ORIGINS` on the backend |
| Build | Rebuild Vercel with updated `VITE_API_URL` if API domain changes |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Chat 401 | Backend missing `GROQ_API_KEY` / `GEMINI_API_KEY` |
| CORS error | `ALLOWED_ORIGINS` must exactly match frontend URL (no trailing slash) |
| API calls wrong host | Rebuild Vercel after changing `VITE_API_URL` |
| First request very slow (Render free) | Cold start — wait or upgrade instance |
| Empty fundamentals | Run ingest script or **Fetch & cache** in Markets |
| Chat timeout | Render/Railway free tiers may limit long requests; retry or upgrade |
| Railway deploy blocked | Free tier peak hours (8 AM–8 PM ET) — deploy later or use Render |
| Render `Dockerfile: no such file` | Set **Root Directory** to `backend`, or clear it and use repo-root `Dockerfile` |

---

## What not to do

- Don’t commit `backend/.env`.
- Don’t delete a live Railway service unless you intend to retire that site.
- Don’t expose the API without `ENV=production` on the public internet.
- Don’t deploy the Python backend to static-only hosts (Vercel/Netlify static).
