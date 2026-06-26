# Deployment guide

This app is **two parts**:

| Part | Stack | Best hosts |
|------|--------|------------|
| **Frontend** | Vite + React (static) | Vercel, Netlify, Cloudflare Pages |
| **Backend** | FastAPI + LangGraph + SQLite | Railway, Render, Fly.io, VPS |

The backend is **not** a good fit for Vercel serverless (Python agent, long chat requests, SQLite file).

---

## Recommended: Vercel (UI) + Railway (API)

Good balance of free tier, HTTPS, and minimal ops.

### 1. Push code to GitHub

```powershell
cd stock-analyst-agent
git init
git add .
git commit -m "Initial commit"
# Create repo on GitHub, then:
git remote add origin https://github.com/YOU/stock-analyst-agent.git
git push -u origin main
```

### 2. Deploy the backend (Railway)

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
2. Set **Root Directory** to `backend`.
3. Railway detects `backend/Dockerfile` (or use `railway.toml`).
4. Add **Variables** (same as your local `.env`, never commit these):

   | Variable | Example |
   |----------|---------|
   | `GROQ_API_KEY` | `gsk_...` |
   | `GEMINI_API_KEY` | `AIza...` *(fallback)* |
   | `FINNHUB_API_KEY` | optional |
   | `ENV` | `production` |
   | `ALLOWED_ORIGINS` | `https://your-app.vercel.app` |
   | `DATABASE_PATH` | `/app/data/financials.db` |

5. Add a **Volume** mounted at `/app/data` (keeps SQLite cache across redeploys).
6. **Generate Domain** → note the URL, e.g. `https://stock-analyst-api.up.railway.app`.
7. Test: `https://YOUR-BACKEND.up.railway.app/api/health` → `{"status":"ok",...}`

### 3. Deploy the frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the same GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Framework preset: **Vite** (auto-detected).
4. Add **Environment Variable** (Production):

   | Name | Value |
   |------|--------|
   | `VITE_API_URL` | `https://YOUR-BACKEND.up.railway.app/api` |

5. Deploy → open `https://your-app.vercel.app`.

### 4. Lock CORS

After Vercel gives you the final URL, update Railway:

```env
ALLOWED_ORIGINS=https://your-app.vercel.app
```

Redeploy backend if needed.

### 5. Optional: seed fundamentals on Railway

Railway → backend service → **Shell** (or one-off job):

```bash
python scripts/ingest_financials.py
```

---

## Option B: One server with Docker (VPS or local)

Everything on one URL — simplest CORS, good for personal use.

**Requires:** Docker Desktop (or Docker on a Linux VPS).

```powershell
# 1. Ensure backend/.env exists with your keys
copy backend\.env.example backend\.env
# edit backend/.env

# 2. Build and run
docker compose build
docker compose up -d

# 3. Open
# http://localhost:8080
```

- UI + API on port **8080** (nginx proxies `/api` → backend).
- SQLite persisted in Docker volume `backend-data`.
- For a VPS: open port 8080 (or put Caddy/nginx + TLS in front).

---

## Option C: Render

**Backend:** [render.com](https://render.com) → Web Service → Docker → root `backend`, add env vars + persistent disk for `/app/data`.

**Frontend:** Static Site → root `frontend`, build `npm run build`, publish `dist`, env `VITE_API_URL=https://your-api.onrender.com/api`.

---

## Environment checklist (production)

```env
ENV=production
ALLOWED_ORIGINS=https://your-frontend-domain.com
GROQ_API_KEY=...
GEMINI_API_KEY=...          # recommended fallback
FINNHUB_API_KEY=...         # optional
DATABASE_PATH=/app/data/financials.db   # when using a volume
```

**Do not** rely on browser Settings keys in production unless you accept BYOK risk (see [SECURITY.md](SECURITY.md)).

---

## Custom domain (optional)

1. **Vercel:** Project → Domains → add `app.yourdomain.com`.
2. **Railway:** Service → Settings → Custom Domain → `api.yourdomain.com`.
3. Update `ALLOWED_ORIGINS` and `VITE_API_URL` to match.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Chat 401 | Backend missing `GROQ_API_KEY` / `GEMINI_API_KEY` |
| CORS error in browser | `ALLOWED_ORIGINS` must exactly match frontend URL (no trailing slash) |
| API calls go to wrong host | Rebuild frontend after setting `VITE_API_URL` |
| Empty fundamentals | Run ingest script or use **Fetch & cache** in Markets |
| Chat timeout | Platform request limit — Railway/Render usually allow 60–120s; increase proxy timeout if self-hosting |

---

## What not to do

- Don’t commit `backend/.env`.
- Don’t expose the API without `ENV=production` and rate limits on the public internet.
- Don’t deploy backend to pure static hosts (Vercel/Netlify static only) — it won’t run Python/FastAPI.
