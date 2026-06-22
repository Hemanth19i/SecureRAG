# SecureRAG v1.0 — Release Notes

**Release type:** Major (v1.0) — first complete release.
**Status:** Feature complete · production-hardened · CI on every PR · deployment-ready.

SecureRAG is an AI-powered threat-intelligence & SIEM platform that turns raw
security logs into structured, analyst-ready intelligence: RAG retrieval, IOC
extraction & correlation, MITRE ATT&CK mapping, attack timelines and graphs, case
management with an audit trail, threat-intel enrichment, retrieval-quality
measurement, dashboard analytics, and real-time alerting.

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
- Case management: create/list/update, lifecycle status, threaded notes, and an
  **append-only audit trail** (created / status / assignment / note / evidence).
- Threat-intelligence enrichment (AbuseIPDB) with cache-first TTL.
- Real-time monitoring: alert generation, acknowledge lifecycle, cursor-based
  delta polling with severity/acked filters, and live ingestion (`POST /monitor/feed`).

**Measurement & analytics**
- **RAG Evaluation page** — a retrieval-only path (`POST /retrieval/eval`) showing
  per-stage latency (embed / search / total) and ranked chunks with similarity and
  distance, alongside the offline Recall@K / MRR benchmark (clearly labeled, not live).
- **Dashboard analytics** — KPI readouts plus real-data distribution charts (IOC
  type donut, alert type bar) and command-center drill-ins.

**Platform**
- JWT auth (access + refresh) with ADMIN / ANALYST roles and login rate limiting.
- React 19 + TypeScript (Vite) SOC console; Flask REST API.

---

## Architecture

```
React 19 + TS SPA (Vite)  --JWT-->  Flask API  -->  intelligence/ pipeline  -->  SQLite (WAL)
                                                -->  rag/ (chunk, embed)      -->  ChromaDB
                                                -->  Gemini (LLM, fallback)
                                                -->  AbuseIPDB (threat intel)
```

Ingestion is centralized in `intelligence/ingest.ingest_text()` and shared by
`/upload` and `/monitor/feed`:

```
text -> chunk -> embed -> ChromaDB -> SQLite{IOCs, MITRE, timeline} -> correlate -> alerts
```

See [docs/ARCHITECTURE_DIAGRAMS.md](docs/ARCHITECTURE_DIAGRAMS.md) for the full
Mermaid diagram set.

---

## Development Phases (what shipped)

**Backend hardening**
- Fail-closed JWT secret (≥32 chars, no placeholders); weak `DEFAULT_ADMIN_PASSWORD`
  ignored and replaced by a printed-once random password.
- Secret hygiene (removed a leaked key from `.env.example`); generic 500 responses;
  input-size limits (query / `top_k` / feed); per-IP login rate limiting.
- SQLite WAL + busy-timeout for write contention; correct `google-genai` dependency
  and UTF-8 `requirements.txt`.
- Production WSGI (Waitress/gunicorn) with `wsgi.py` / `run_production.py`; Docker +
  Docker Compose with a persistent volume for SQLite + Chroma.
- **CI** (GitHub Actions): ruff + pytest on every push and PR (Python 3.11).

**Phase A — Case actions & audit trail**
- Case lifecycle actions (status/assignment), threaded notes, and an append-only
  `case_audit` history surfaced in the case detail view.

**Phase B — Honesty pass**
- Removed dead/placeholder UI; fixed misleading readouts (e.g. Critical Cases now
  counts real critical-severity cases); real external links.

**Phase C — Real Attack Graph**
- Attack graph rendered from persisted relationships for a selected upload
  (`GET /attack-graph`), with themed React Flow nodes/edges and a legend.

**Phase D1 — Live Monitoring UX**
- "next refresh in Ns" countdown, "updated Ns ago" ticker, new-alert row flash,
  and connection state (Connected / Connection lost).

**Phase D2 — RAG Evaluation page**
- Surfaces `POST /retrieval/eval` as instrumentation: live latency + ranked chunks,
  with the offline Recall@K / MRR benchmark shown separately and clearly labeled.

**Phase D3 — Dashboard analytics & command-center UX**
- Hero shrink + KPI cards lifted into normal flow as clickable drill-ins; real-data
  IOC-type donut and alert-type bar; "Dashboard updated Ns ago"; Live Monitoring
  severity/acked filters. Deliberately no time-series (bursty demo data would look
  fabricated).

---

## Security Improvements

- **Fail-closed JWT secret**, **no weak admin defaults**, **secret hygiene**
  (real keys only in gitignored `server/.env`).
- **Generic error responses** (internals logged server-side only).
- **Input validation limits** and **role checks on every endpoint**.
- **Login rate limiting** per client IP; **deployment-ready CORS** allow-list.

---

## Known Limitations

- **Desktop-first UI** — fixed max-width with a sidebar; not mobile-optimized.
- **Demo-scale data** — distributions are real but small.
- **ADMIN-provisioned users** — no self-service registration; no password reset.
- **Recall@K / MRR are offline-only** (`server/eval/recall_eval.py`); the live
  `/retrieval/eval` returns latency + ranked chunks, and its `recall_at_k` field is
  always `null` (forward hook).
- **No time-series analytics** — bursty ingest data would render misleadingly sparse.
- **No per-upload MITRE/timeline read endpoint**; **no upload management** (list/delete).
- **Single-node SQLite** (WAL + busy-timeout); global IOC correlation recomputed per
  ingest (O(n), not yet windowed).
- **Polling real-time delivery** (~10s); **in-memory rate limiter** (per process).
- **JS bundle >500 kB** (no route-level code-splitting yet).
- **`VIEWER` role reserved** but not yet granted endpoints.
- **History note:** the initial commit contained a Gemini API key; it must be
  rotated/revoked (sanitized going forward, but present in git history).

---

## Future Roadmap

- Upload management (view/delete uploads).
- A Dashboard "RAG Health" summary card (latency-based).
- Ground-truth **live Recall@K** scoring (response hook already present).
- Per-upload MITRE/timeline read endpoints; richer report exports.
- Push delivery via SSE (cursor → `Last-Event-ID`) / WebSocket.
- Wire the read-only `VIEWER` role; Redis-backed rate limiting; route-level
  code-splitting; optional Postgres backend for higher concurrency.

---

## Upgrade / Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for local, production (Waitress/gunicorn), and
Docker instructions, the full environment-variable reference, and troubleshooting.
