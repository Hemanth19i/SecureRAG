# SecureRAG — Portfolio Project Summary

## One-liner
An AI-powered threat-intelligence & SIEM platform that turns raw security logs
into analyst-ready intelligence using Retrieval-Augmented Generation, automated
IOC correlation, and MITRE ATT&CK mapping — with real-time alerting and a
retrieval-evaluation dashboard.

## The problem
Security analysts drown in unstructured log data. Finding the signal — *who
attacked, how, what they touched, and whether it succeeded* — is slow, manual,
and error-prone. SecureRAG automates that triage.

## The solution
Ingest logs once; SecureRAG chunks and embeds them for semantic search, extracts
and correlates indicators of compromise, maps activity to MITRE ATT&CK, rebuilds
the attack timeline and graph, enriches indicators with external threat intel,
and answers natural-language questions about the incident — grounding the LLM in
retrieved evidence rather than letting it hallucinate.

## Key features
- **RAG investigation** — ask "was there a brute-force attack and did it succeed?"
  and get an evidence-grounded answer with severity, threats, and recommendations.
- **Automated IOC extraction & correlation** — IPs, hashes, CVEs, domains, URLs;
  cross-log correlation with risk scoring (attacker vs. C2 vs. victim).
- **MITRE ATT&CK mapping** + kill-chain reconstruction.
- **Attack timeline & graph** — chronological and relationship views.
- **Case management** with lifecycle and notes.
- **Threat-intel enrichment** (AbuseIPDB) with cache-first TTL.
- **Real-time monitoring** — alert generation, acknowledge lifecycle, live feed.
- **Retrieval evaluation dashboard** — similarity scores, source evidence, and
  per-stage latency to measure RAG quality.

## Tech stack
- **Backend:** Python, Flask (blueprints), Flask-JWT-Extended, SQLite (WAL),
  ChromaDB, SentenceTransformers (`all-MiniLM-L6-v2`), Google Gemini.
- **Frontend:** React 19, Vite, React Flow (graph), Framer Motion.
- **Infra:** Waitress/gunicorn WSGI, Docker + Docker Compose, nginx.

## Engineering highlights
- **Grounded LLM design** — structured context with explicit untrusted-input
  boundaries and a prompt-injection detector; deterministic rule-based fallback so
  the product never hard-fails when the LLM is unavailable.
- **Single ingestion pipeline** reused by batch upload and live feed
  (`ingest_text`), with ChromaDB-first writes to avoid orphaned rows and atomic
  SQLite transactions.
- **Production hardening** — fail-closed JWT secret validation, generic error
  responses, input-size limits, SQLite busy-timeout for write contention,
  deployment-ready CORS, and RBAC on every endpoint.
- **Measurable RAG** — a dedicated retrieval-eval path that reports similarity and
  latency, with a forward hook for ground-truth Recall@K.
- **Verified release** — 29/29 endpoint + failure-path tests against the
  production WSGI server, including graceful third-party-outage handling.

## Scale of the work
15 production-hardening commits across security, reliability, deployment, and
documentation; 12 SQLite tables; ~20 REST endpoints; full Docker deployment.

## Screenshots
See `docs/screenshots/` (dashboard, investigation, attack graph, cases, alerts).

## What it demonstrates
Full-stack engineering, applied GenAI/RAG, security-domain modeling, API design,
auth/RBAC, data modeling, containerized deployment, testing discipline, and
technical writing.
