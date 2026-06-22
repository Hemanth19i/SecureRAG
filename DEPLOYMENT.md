# SecureRAG — Deployment Guide

Covers local development, production (Waitress/gunicorn), and Docker, plus the
environment-variable reference and troubleshooting.

> **Before anything:** set a strong `JWT_SECRET_KEY`. The app refuses to start
> without one (≥32 random chars). Generate one with:
> ```
> python -c "import secrets; print(secrets.token_urlsafe(48))"
> ```

---

## 1. Local setup (development)

### Backend
```bash
cd server
python -m venv venv
# Windows: venv\Scripts\activate    |   macOS/Linux: source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env: set JWT_SECRET_KEY (strong) and GEMINI_API_KEY (optional).

python app.py            # Flask dev server on http://localhost:5000
```
First start creates an `admin` user. If `DEFAULT_ADMIN_PASSWORD` is unset or weak,
a strong random password is generated and printed once in the logs — save it.

### Frontend
```bash
cd frontend
npm install
npm run dev              # Vite dev server on http://localhost:3000
```
In development the Vite dev server proxies `/api` → `http://localhost:5000`, so the
SPA talks to the backend same-origin — `VITE_API_BASE_URL` is **not** needed and
CORS is not exercised. (`frontend/.env.local` is empty by default; set
`VITE_API_BASE_URL` only for production builds — see §2.)

---

## 2. Production setup (no Docker)

Do **not** use `python app.py` (Werkzeug dev server) in production. Use a
production WSGI server.

### Waitress (cross-platform — Windows & Linux)
```bash
cd server
# venv active, .env present with a strong JWT_SECRET_KEY
python run_production.py
# Honors HOST, FLASK_PORT, WAITRESS_THREADS
```
Or directly:
```bash
waitress-serve --listen=0.0.0.0:5000 wsgi:app
```

### Gunicorn (Linux alternative)
```bash
pip install gunicorn
gunicorn --workers 4 --bind 0.0.0.0:5000 wsgi:app
```

### Frontend (static build)
```bash
cd frontend
VITE_API_BASE_URL="https://api.your-domain.com" npm run build
# Serve dist/ behind nginx/Caddy with SPA fallback to index.html.
```
Set the backend `CORS_ORIGINS` to the exact deployed frontend origin(s). Run
behind TLS (reverse proxy) in production.

---

## 3. Docker setup

Requires `server/.env` (copy from `server/.env.example`, set `JWT_SECRET_KEY`).

```bash
# from repo root
docker compose build
docker compose up
#   frontend -> http://localhost:5173
#   backend  -> http://localhost:5000
```

- SQLite (`securerag.db`) and the Chroma store persist in the named volume
  `securerag-data` (mounted at `/data`).
- The frontend image bakes `VITE_API_BASE_URL` at build time (compose arg,
  default `http://localhost:5000`). Change it for a real deployment and rebuild.
- The backend image pre-caches the embedding model, so first request is fast.

Reset all data:
```bash
docker compose down -v        # -v removes the securerag-data volume
```

---

## 4. Environment variables

Backend (`server/.env`):

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET_KEY` | **Yes** | — | ≥32 random chars; app won't start otherwise. |
| `GEMINI_API_KEY` | No | — | LLM analysis; rule-based fallback if unset. |
| `ABUSEIPDB_API_KEY` | No | — | IP reputation enrichment. |
| `DEFAULT_ADMIN_PASSWORD` | No | (random) | Bootstrap admin pw; weak values ignored. |
| `CHROMA_DB_PATH` | No | `./chroma_store` | Vector store directory. |
| `HOST` | No | `0.0.0.0` | Bind address (run_production.py). |
| `FLASK_PORT` | No | `5000` | Port. |
| `WAITRESS_THREADS` | No | `8` | Waitress worker threads. |
| `FLASK_DEBUG` | No | `false` | Dev-server debug; never in production. |
| `LOG_LEVEL` | No | `INFO` | Logging level. |
| `MAX_UPLOAD_MB` | No | `50` | Max request body (MB). |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Comma-separated allowed origins. |
| `SQLITE_TIMEOUT_SECONDS` | No | `30` | SQLite busy/lock wait. |
| `MAX_QUERY_CHARS` | No | `10000` | Max `/query` length. |
| `MAX_TOP_K` | No | `50` | Max retrieval `top_k`. |
| `MAX_FEED_CHARS` | No | `1000000` | Max `/monitor/feed` content length. |
| `MAX_SOURCE_CHARS` | No | `200` | Max `/monitor/feed` source length. |
| `ENRICH_TTL_SECONDS` | No | `86400` | Threat-intel cache TTL (success). |
| `ENRICH_NEG_TTL_SECONDS` | No | `3600` | Threat-intel negative cache TTL. |
| `LOGIN_RATE_LIMIT` | No | `10` | Max login attempts per window. |
| `LOGIN_RATE_WINDOW` | No | `60` | Login window (seconds). |

Frontend: `VITE_API_BASE_URL` (build-time) — backend base URL.

---

## 5. Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| `RuntimeError: JWT_SECRET_KEY is not set / too weak` | Set a ≥32-char random `JWT_SECRET_KEY` in `server/.env`. |
| Can't log in as admin | On an existing DB the original admin password persists. Reset: delete `server/securerag.db*` and restart to get a fresh printed password, or set `DEFAULT_ADMIN_PASSWORD` before first run. |
| Browser console: CORS / preflight blocked | `CORS_ORIGINS` must exactly match the frontend origin (scheme/host/port). Don't mix `localhost` and `127.0.0.1`. |
| Frontend calls go to the wrong URL | `VITE_API_BASE_URL` is baked at build time — rebuild after changing it. |
| `pip install` fails parsing requirements | Ensure `requirements.txt` is UTF-8 (it is in v1.0). |
| AI analysis says "rule-based fallback" | `GEMINI_API_KEY` missing/invalid, or the provider failed — analysis still works via the rule-based analyzer. |
| Threat intel shows "unavailable" | `ABUSEIPDB_API_KEY` not set; enrichment degrades gracefully. |
| `database is locked` under heavy load | Increase `SQLITE_TIMEOUT_SECONDS`; for sustained high concurrency migrate to Postgres. |
| Docker: backend exits immediately | `server/.env` missing or no `JWT_SECRET_KEY`. Create it before `docker compose up`. |
| First request is slow | The embedding model loads on first use (local runs). The Docker image pre-caches it. |

---

## Pre-deployment checklist

- [ ] Strong `JWT_SECRET_KEY` set (not a placeholder).
- [ ] API keys rotated; no real secrets committed.
- [ ] `CORS_ORIGINS` set to the deployed frontend origin(s).
- [ ] Running under Waitress/gunicorn (not the dev server), behind TLS.
- [ ] `FLASK_DEBUG=false`.
- [ ] Data volume / backup strategy for `securerag.db` and the Chroma store.
- [ ] Frontend built with the correct `VITE_API_BASE_URL`.
