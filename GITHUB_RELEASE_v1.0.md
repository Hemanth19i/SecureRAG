# SecureRAG v1.0

**AI-powered threat-intelligence & SIEM platform** — turn raw security logs into
analyst-ready intelligence: RAG retrieval, IOC extraction & correlation, MITRE
ATT&CK mapping, attack timelines & graphs, case management, threat-intel
enrichment, real-time alerting, and a retrieval-evaluation dashboard.

> First production release. Flask + React, JWT-secured, Docker-deployable.

## Highlights
- **End-to-end analysis pipeline:** upload → chunk → embed (ChromaDB) →
  IOC/MITRE/timeline (SQLite) → correlation → alerts, shared by file upload and
  a live monitoring feed.
- **AI investigation** via Google Gemini with a deterministic rule-based fallback.
- **Real-time monitoring:** alert generation, acknowledge lifecycle, live polling.
- **Retrieval Evaluation Dashboard:** similarity scores, source evidence, and
  per-stage latency for the RAG step.
- **Production-hardened:** fail-closed JWT secret, generic error responses, input
  validation, SQLite busy-timeout, deployment-ready CORS, Waitress/gunicorn WSGI,
  and Docker Compose with persistent storage.

## Install
```bash
git clone <repo> && cd SecureRAG
# Backend
cd server && python -m venv venv && pip install -r requirements.txt
cp .env.example .env   # set a strong JWT_SECRET_KEY (and GEMINI_API_KEY)
python run_production.py
# Frontend
cd ../frontend && npm install && npm run build
```
Or `docker compose up`. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Quality
- **29/29 release tests pass** (full endpoint matrix + failure paths) against the
  production Waitress server, including graceful degradation for Gemini/AbuseIPDB
  outages and SQLite lock contention.

## What's in this release
See [RELEASE_NOTES_v1.0.md](RELEASE_NOTES_v1.0.md) for the full feature list,
security improvements, RC1+RC2 hardening summary, known limitations, and roadmap.

## Known limitations
Single-node SQLite (WAL + busy-timeout), polling-based real-time delivery,
single-file frontend bundle (>500 kB), in-memory rate limiter. See release notes.

---
*Built by Hemanth A R.*
