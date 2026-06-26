# Security

This app is designed for **local development**. Treat any internet-facing deployment as requiring extra hardening.

## API keys

- Never commit `backend/.env` — it is gitignored.
- Rotate keys immediately if they appear in chat logs, screenshots, or git history.
- Browser-stored keys (Settings) live in `localStorage` and are visible to any script on the same origin. Prefer server-side keys in `.env` when possible.
- Keys sent via request headers appear in browser DevTools network tabs.

## Backend exposure

- Default scripts bind the API to **localhost** only.
- Do not expose port `8000` to the public internet without authentication and rate limits.
- Set `ENV=production` in production to disable Swagger UI and generic error messages.
- Configure `ALLOWED_ORIGINS` to your frontend URL(s) — never use `*` in production.

## Rate limits (built-in)

| Endpoint | Limit |
|----------|-------|
| `POST /api/chat` | 20 / minute / IP |
| `POST /api/fundamentals/{ticker}/fetch` | 10 / hour / IP |
| `GET /api/tickers/search` | 60 / minute / IP |

## Reporting issues

If you find a vulnerability, avoid opening a public issue with exploit details. Contact the repository owner privately.
