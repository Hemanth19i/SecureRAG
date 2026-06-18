# SecureRAG

**AI-powered threat-intelligence & SIEM platform.** Ingest security logs, retrieve
relevant evidence with RAG, and automatically extract IOCs, correlate them, map to
MITRE ATT&CK, build attack timelines and graphs, manage cases, enrich indicators
with threat intel, and surface real-time alerts.

> Status: **v1.0 RC1** — feature complete, production-hardening in progress.

---

## Overview

SecureRAG turns raw, unstructured security logs into structured, analyst-ready
intelligence. A Flask backend runs the ingestion/analysis pipeline over SQLite +
ChromaDB and exposes a JWT-secured REST API; a React (Vite) single-page app
provides the SOC console (dashboard, investigation, IOC explorer, MITRE view,
timeline, attack graph, cases, and a live alert stream).

LLM analysis is provided by Google Gemini with an automatic **rule-based fallback**
so the product degrades gracefully when no API key is configured.

---

## Architecture

```
                    React SPA (Vite, App.jsx)
        dashboard | investigate | IOC | MITRE | timeline
            attack graph | cases | live alerts (polling)
                              |
                     HTTPS + JWT (Bearer)
                              v
                      Flask API (api/)
          auth_bp (/auth) | api_bp | JWT | CORS | rate limit
                              |
        +---------------------+----------------------+
        v                     v                      v
  intelligence/            rag/                external APIs
  ingest pipeline     chunker | embedder       Gemini (LLM)
  IOC | MITRE |       (all-MiniLM-L6-v2)       AbuseIPDB (TI)
  timeline |          vectorstore (ChromaDB)
  correlator |
  alerts | cases
        |
        v
  SQLite (WAL) SIEM store
  log_chunks | extracted_iocs | mappings | mitre |
  timeline | cases | notes | enrichment | alerts
```

**Ingestion pipeline** (shared by `/upload` and `/monitor/feed` via `ingest_text`):

```
text -> chunk -> embed -> ChromaDB -> SQLite{IOCs, MITRE, timeline} -> correlate -> alerts
```

---

## Features

- **Authentication & RBAC** — JWT access/refresh tokens, ADMIN / ANALYST roles,
  login rate limiting, fail-closed secret validation.
- **Upload pipeline** — chunking, embeddings, ChromaDB + SQLite persistence,
  SHA-256 dedup.
- **RAG retrieval** — semantic search over ingested logs (SentenceTransformers).
- **IOC extraction & correlation** — IPs, hashes, CVEs, domains, emails, URLs,
  IPv6; cross-log correlation with risk scoring and analyst insights.
- **MITRE ATT&CK mapping** — technique/tactic mapping + kill-chain assembly.
- **Timeline generation** — chronological threat events with severity.
- **Attack graph** — node/edge graph of an investigation.
- **Reports** — incident report generation.
- **Case management** — create/list/update cases, lifecycle status, notes thread.
- **Threat intelligence** — AbuseIPDB IP reputation, cache-first with TTL.
- **Real-time monitoring** — alert generation, alert lifecycle (acknowledge),
  live dashboard polling, and live ingestion (`/monitor/feed`).

---

## Setup

### Prerequisites
- Python **3.10+** (developed on 3.11)
- Node **18+**

### Backend
```bash
cd server
python -m venv venv
# Windows: venv\Scripts\activate   |   macOS/Linux: source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env: set a STRONG JWT_SECRET_KEY (>=32 chars) and your GEMINI_API_KEY.
#   python -c "import secrets; print(secrets.token_urlsafe(48))"

python app.py            # serves http://localhost:5000
```
On first start an `admin` user is created. If `DEFAULT_ADMIN_PASSWORD` is unset (or
weak), a strong random password is generated and **printed once** in the logs —
save it.

### Frontend
```bash
cd frontend
npm install
# frontend/.env.local already points at the backend:
#   VITE_API_BASE_URL=http://127.0.0.1:5000
npm run dev              # serves http://localhost:5173
```

> **Host consistency matters for CORS.** Open the app at the exact origin listed in
> the backend's `CORS_ORIGINS` (default `http://localhost:5173`). Mixing
> `localhost` and `127.0.0.1` between the SPA origin and `CORS_ORIGINS` will cause
> preflight failures.

---

## Environment Variables

Backend (`server/.env`):

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET_KEY` | **Yes** | — | JWT signing key; must be >=32 chars and not a known placeholder (app refuses to start otherwise). |
| `GEMINI_API_KEY` | No | — | Google Gemini key. If unset, the rule-based analyzer is used. |
| `ABUSEIPDB_API_KEY` | No | — | Enables IP reputation enrichment; degrades gracefully if unset. |
| `DEFAULT_ADMIN_PASSWORD` | No | (random) | Bootstrap admin password. Weak values are ignored and replaced by a random one. |
| `CHROMA_DB_PATH` | No | `./chroma_store` | ChromaDB persistence directory. |
| `FLASK_PORT` | No | `5000` | Backend port. |
| `FLASK_DEBUG` | No | `false` | Enable Werkzeug debug (never in production). |
| `LOG_LEVEL` | No | `INFO` | Logging level. |
| `MAX_UPLOAD_MB` | No | `50` | Max request body size (MB). |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Comma-separated allowed frontend origins. |
| `SQLITE_TIMEOUT_SECONDS` | No | `30` | SQLite busy/lock wait. |
| `MAX_QUERY_CHARS` | No | `10000` | Max `/query` length. |
| `MAX_TOP_K` | No | `50` | Max retrieval `top_k`. |
| `MAX_FEED_CHARS` | No | `1000000` | Max `/monitor/feed` content length. |
| `MAX_SOURCE_CHARS` | No | `200` | Max `/monitor/feed` source length. |
| `ENRICH_TTL_SECONDS` | No | `86400` | Threat-intel cache TTL (success). |
| `ENRICH_NEG_TTL_SECONDS` | No | `3600` | Threat-intel negative cache TTL. |
| `LOGIN_RATE_LIMIT` | No | `10` | Max login attempts per window. |
| `LOGIN_RATE_WINDOW` | No | `60` | Login rate-limit window (seconds). |

Frontend (`frontend/.env.local`):

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | (empty) | Backend base URL, e.g. `http://127.0.0.1:5000`. |

---

## API Reference

All endpoints require `Authorization: Bearer <access_token>` except `POST /auth/login`.
Roles: **A** = ADMIN, **N** = ANALYST.

### Auth
| Method | Path | Role | Body -> Response |
|---|---|---|---|
| POST | `/auth/login` | public | `{username, password}` -> `{access_token, refresh_token, role}` |
| POST | `/auth/refresh` | refresh token | -> `{access_token}` |
| POST | `/auth/register` | A | `{username, password, role}` -> `201` |

### Core
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/upload` | A | multipart `file` -> `{message, chunks_stored}`; 409 on duplicate |
| POST | `/query` | A·N | `{query, top_k?}` -> analysis + iocs + correlation + mitre + timeline |
| GET | `/stats` | A·N | -> `{readouts, evidence}` |
| POST | `/report` | A·N | `{analysis}` -> `{report}` |
| GET | `/debug/chunks` | A | debug: list stored chunks |

### Intelligence
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/correlate` | A·N | -> correlation summary + analyst insights |
| GET | `/attack-graph?upload_id=` | A·N | -> `{nodes, edges}`; 404 if unknown upload |
| GET | `/enrich?value=` | A·N | -> threat-intel record (cache-first) |

### Cases
| Method | Path | Role |
|---|---|---|
| POST | `/cases` | A·N |
| GET | `/cases` | A·N |
| GET | `/cases/<id>` | A·N |
| PATCH | `/cases/<id>` | A·N |
| POST | `/cases/<id>/notes` | A·N |
| GET | `/cases/<id>/notes` | A·N |

### Alerts & Monitoring
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/alerts?since=&limit=` | A·N | cursor poll -> `{alerts, total, cursor}` |
| PATCH | `/alerts/<id>` | A·N | `{acknowledged: true}` |
| POST | `/monitor/feed` | A | `{source, content}` -> `{upload_id, chunks_stored, alerts_created}` |

---

## Demo Flow

A ready-to-run demo lives in [`demo/`](demo/) (sample logs + step-by-step script).

1. **Log in** as `admin` (password from first-start logs or `DEFAULT_ADMIN_PASSWORD`).
2. **Upload** a sample log from `demo/sample_logs/` (INGEST view).
3. **Dashboard** — watch readouts and the live alert stream populate.
4. **Investigate** — ask a question (e.g. *"was there a brute force attack?"*); review
   the AI analysis, IOCs, correlation, MITRE, and timeline.
5. **IOC Explorer** — inspect indicators; **enrich** a public IP via threat intel.
6. **MITRE / Timeline / Attack Graph** — explore techniques, sequence, relationships.
7. **Cases** — create a case from the investigation, set severity/status, add a note.
8. **Alerts** — acknowledge alerts; watch the unacked count update.
9. **Live ingestion** — `POST /monitor/feed` to simulate a streaming agent and see
   new alerts appear via polling.

---

## Screenshots

> Add screenshots to `docs/screenshots/` and reference them here.

| View | Screenshot |
|---|---|
| Dashboard | `docs/screenshots/dashboard.png` |
| Investigation | `docs/screenshots/investigation.png` |
| Attack Graph | `docs/screenshots/attack-graph.png` |
| Cases | `docs/screenshots/cases.png` |
| Alert Stream | `docs/screenshots/alerts.png` |

---

## Testing

Backend tests live in `server/tests/` (pytest). They run **offline** — the
embedding model and Gemini are stubbed/mocked, and tests use temporary SQLite +
Chroma stores, so your real `securerag.db` / `chroma_store` are never touched.

```bash
cd server
pip install -r requirements-dev.txt

pytest                 # unit + contract + API tests (integration excluded by default)
ruff check .           # lint (fails on real errors: syntax / undefined names)
pytest -m integration  # opt-in end-to-end: REAL embedder + Chroma + /query
                       # (downloads all-MiniLM-L6-v2 on first run)
```

From the repo root: `make test`, `make lint`, `make test-integration`.

- The **contract test** (`tests/test_contract_query.py`) locks the `/query`
  response shape — documented in [`server/tests/CONTRACT.md`](server/tests/CONTRACT.md).
- **CI** (`.github/workflows/ci.yml`) runs ruff + pytest (excluding integration)
  on every push and PR (Python 3.11), with pip caching.

## Retrieval Evaluation (RAG metrics)

Retrieval is measured with a labeled harness ([`server/eval/`](server/eval/)): a
**30-entry SOC-log corpus** with **10 query→target pairs**. Relevance is exact —
a query is a hit at rank *r* iff the retrieved chunk id at *r* is the labeled
target. Metrics are computed over the **real** stack (SentenceTransformer
`all-MiniLM-L6-v2` + ChromaDB).

```bash
cd server
python eval/recall_eval.py            # semantic baseline
```

**Results — semantic (baseline):**

| Metric | Semantic |
|---|---|
| Recall@1 | 0.80 |
| Recall@3 | 1.00 |
| Recall@5 | 1.00 |
| MRR | 0.90 |

*Methodology:* corpus = 30 entries, queries = 10, K ∈ {1, 3, 5}, relevance =
exact id match, measured on the real embedding + vector-store path. Recall@3/@5
saturate on a 30-entry corpus, so **Recall@1 and MRR are the discriminating
metrics**. Hybrid-retrieval + reranking comparison is added in the section update
once those land.

## Security Notes

- Secrets live only in `server/.env` (gitignored). Never commit real keys.
- The app fails closed without a strong `JWT_SECRET_KEY`.
- Default runtime is the Flask/Werkzeug dev server; for production, front it with a
  WSGI server (e.g. waitress/gunicorn) behind TLS.

## License

Proprietary — internal project (update as appropriate).
