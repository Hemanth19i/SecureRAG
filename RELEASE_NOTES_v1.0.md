# SecureRAG v1.0 — Release Notes

**Release type:** Major (v1.0) — first production release candidate.
**Status:** Feature complete · production-hardened · deployment-ready.

SecureRAG is an AI-powered threat-intelligence & SIEM platform that turns raw
security logs into structured, analyst-ready intelligence: RAG retrieval, IOC
extraction & correlation, MITRE ATT&CK mapping, attack timelines and graphs,
case management, threat-intel enrichment, and real-time alerting.

---

## Features

**Investigation & analysis**
- Upload pipeline: chunking → embeddings → ChromaDB + SQLite, with SHA-256 dedup.
- RAG retrieval over ingested logs (SentenceTransformers `all-MiniLM-L6-v2`).
- AI investigation via Google Gemini with an automatic **rule-based fallback**.
- IOC extraction (IPs, hashes, CVEs, domains, emails, URLs, IPv6) and cross-log
  correlation with risk scoring and analyst insights.
- MITRE ATT&CK technique/tactic mapping and kill-chain assembly.
- Timeline reconstruction and an interactive attack graph.
- Incident report generation.

**Operations**
- Case management: create/list/update, lifecycle status, threaded notes.
- Threat-intelligence enrichment (AbuseIPDB) with cache-first TTL.
- Real-time monitoring: alert generation, alert acknowledgement lifecycle,
  live dashboard polling, and live ingestion (`POST /monitor/feed`).

**Evaluation (new in v1.0)**
- Retrieval Evaluation Dashboard: ranked chunks, similarity + distance scores,
  source evidence, and per-stage latency (embed / search / total).

**Platform**
- JWT auth (access + refresh) with ADMIN / ANALYST roles and login rate limiting.
- React (Vite) SOC console; Flask REST API.

---

## Architecture

```
React SPA (Vite)  --JWT-->  Flask API  -->  intelligence/ pipeline  -->  SQLite (WAL)
                                        -->  rag/ (chunk, embed)      -->  ChromaDB
                                        -->  Gemini (LLM, fallback)
                                        -->  AbuseIPDB (threat intel)
```

Ingestion is centralized in `intelligence/ingest.ingest_text()` and shared by
`/upload` and `/monitor/feed`:

```
text -> chunk -> embed -> ChromaDB -> SQLite{IOCs, MITRE, timeline} -> correlate -> alerts
```

See [demo/ARCHITECTURE.md](demo/ARCHITECTURE.md) for full diagrams.

---

## Security Improvements

- **Fail-closed JWT secret:** the app refuses to start without a strong
  `JWT_SECRET_KEY` (≥32 chars, no known placeholders).
- **No weak admin defaults:** a weak `DEFAULT_ADMIN_PASSWORD` is ignored and a
  strong random password is generated and printed once.
- **Secret hygiene:** real keys removed from `.env.example`; secrets live only in
  the gitignored `server/.env`.
- **Generic error responses:** internal exceptions are no longer leaked to
  clients (logged server-side only).
- **Input validation limits:** bounds on query length, `top_k`, and feed payload
  size; role checks on every endpoint.
- **Login rate limiting** per client IP.
- **Deployment-ready CORS:** comma-separated allow-list of front-end origins.

---

## RC1 Hardening Work

- Sanitized `.env.example` (removed leaked API key).
- Fixed `requirements.txt` encoding (UTF-16 → UTF-8) and corrected the Google
  SDK dependency (`google-genai`); pinned all versions.
- Strong JWT secret enforcement and strong admin-credential defaults.
- SQLite `busy_timeout` / connection timeout to handle concurrent writers.
- Generic 500 responses; query/`top_k`/feed validation limits.
- Comprehensive README, demo package, and architecture documentation.
- Retrieval Evaluation Dashboard (endpoint + UI).

## RC2 Production Readiness

- Production WSGI server (Waitress, cross-platform; gunicorn for Linux) with
  `wsgi.py` and `run_production.py` entrypoints.
- Docker deployment: backend + frontend images, `docker-compose.yml` with a
  persistent volume for SQLite + Chroma.
- Verified production frontend build (root-relative assets, configurable API URL).
- **Release test sweep — 29/29 checks passed** against the live Waitress server:
  - Auth (register, login, refresh), full investigation pipeline, operations
    (threat intel, alerts + ack, monitor feed, cases, notes, reports), and
    evaluation (retrieval, similarity, latency).
  - Failure paths: invalid/expired JWT, empty & oversized & malformed payloads,
    missing auth, threat-intel + Gemini graceful degradation, SQLite lock wait.

---

## Known Limitations

- **Single-node SQLite.** WAL + `busy_timeout` handle modest concurrency; very
  high-throughput multi-writer workloads should migrate to Postgres.
- **Correlation recompute.** Global IOC correlation is recomputed per ingest
  (O(n) in total IOCs); fine at demo/SOC scale, not yet windowed.
- **Real-time delivery is polling** (~10s); SSE/WebSocket is on the roadmap.
- **Frontend is a single-file SPA** (`App.jsx`); the JS bundle exceeds 500 kB
  (no code-splitting yet).
- **In-memory rate limiter** (per process); multi-worker needs a shared store.
- **`VIEWER` role is reserved** but not yet granted endpoints; ADMIN/ANALYST are
  the functional roles.
- **No CI pipeline yet** — the test sweep is run manually (documented).
- **History note:** the initial commit contained a Gemini API key; it must be
  rotated/revoked (sanitized going forward, but present in git history).

---

## Future Roadmap

- Push delivery via SSE (cursor maps to `Last-Event-ID`) / WebSocket.
- Frontend component split + route-level code-splitting.
- Redis-backed rate limiting and multi-worker deployment.
- Ground-truth **Recall@K** evaluation (response hook already present).
- CI pipeline with an automated pytest/integration suite.
- Wire the read-only `VIEWER` role.
- Optional Postgres backend for higher concurrency.

---

## Upgrade / Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for local, production (Waitress/gunicorn), and
Docker instructions, the full environment-variable reference, and troubleshooting.
