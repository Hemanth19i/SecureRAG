# SecureRAG v1.0

> Paste-ready text for the GitHub Release. The full, maintained notes (features,
> security, per-phase changelog, limitations, roadmap) live in
> **[RELEASE_NOTES_v1.0.md](RELEASE_NOTES_v1.0.md)**.

**AI-powered threat-intelligence & SIEM platform** — turn raw security logs into
analyst-ready intelligence: RAG retrieval, IOC extraction & correlation, MITRE
ATT&CK mapping, attack timelines & graphs, case management with an audit trail,
threat-intel enrichment, a RAG-evaluation page, real-data dashboard analytics, and
real-time alerting.

> First complete release. Flask + React (TypeScript), JWT-secured, CI on every PR,
> Docker-deployable.

## Highlights
- **End-to-end analysis pipeline:** upload → chunk → embed (ChromaDB) →
  IOC/MITRE/timeline (SQLite) → correlation → alerts, shared by file upload and a
  live monitoring feed.
- **AI investigation** via Google Gemini with a deterministic rule-based fallback.
- **Case management** with an append-only audit trail.
- **Real-time monitoring:** alert generation, acknowledge lifecycle, severity/acked
  filters, cursor-based polling.
- **RAG Evaluation page:** live per-stage latency + ranked chunks, plus the offline
  Recall@K / MRR benchmark (clearly labeled, not live).
- **Dashboard analytics:** real-data IOC-type and alert-type distributions with
  command-center drill-ins.
- **Hardened:** fail-closed JWT secret, generic errors, input validation, SQLite
  busy-timeout, deployment-ready CORS, Waitress/gunicorn WSGI, Docker Compose, CI.

## Install
```bash
git clone <repo> && cd SecureRAG
# Backend
cd server && python -m venv venv && pip install -r requirements.txt
cp .env.example .env   # set a strong JWT_SECRET_KEY (and optionally GEMINI_API_KEY)
python run_production.py
# Frontend
cd ../frontend && npm install && npm run build
```
Or `docker compose up`. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Known limitations
Desktop-first UI, demo-scale data, ADMIN-provisioned users (no self-service
registration / password reset), offline-only Recall@K, single-node SQLite,
polling-based delivery. See [RELEASE_NOTES_v1.0.md](RELEASE_NOTES_v1.0.md).

---
*Built by Hemanth A R.*
