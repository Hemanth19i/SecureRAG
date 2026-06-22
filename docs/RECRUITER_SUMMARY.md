# SecureRAG — Project Snapshot (for reviewers)

**What:** An AI-powered threat-intelligence & SIEM platform that converts raw
security logs into analyst-ready intelligence.

**Role:** Sole designer & developer (full-stack + AI + DevOps).

**Impact:** Automates the slowest part of incident response — triaging
unstructured logs to determine who attacked, how (MITRE ATT&CK), what was
touched, and whether the attack succeeded.

---

### Built with
Python · Flask · React 19 + TypeScript · ChromaDB (vector search) ·
SentenceTransformers · Google Gemini (RAG, rule-based fallback) · SQLite · JWT auth ·
Docker · GitHub Actions CI.

### Highlights at a glance
- **Retrieval-Augmented Generation** that grounds LLM answers in retrieved log
  evidence, with a deterministic fallback so it never hard-fails.
- **Automated IOC extraction, correlation, and MITRE ATT&CK mapping** with attack
  timeline and graph reconstruction.
- **Case management with an append-only audit trail** and **real-time monitoring**
  (alerts + live ingestion, severity/acked filters).
- **RAG Evaluation** — live per-stage latency + ranked chunks, plus an offline
  Recall@K / MRR benchmark — and **dashboard analytics** (real-data IOC/alert-type
  distributions).
- **Production-grade:** JWT/RBAC, input validation, hardened secrets, WSGI server,
  CI on every PR, and one-command Docker deployment.

### Skills demonstrated
Applied GenAI / RAG · vector databases · API & auth design · security-domain
modeling · data modeling · containerization · testing & release engineering ·
technical documentation.

### Try it
`docker compose up` — or see [DEPLOYMENT.md](../DEPLOYMENT.md). A 10-minute guided
walkthrough with sample attack logs is in [demo/DEMO_SCRIPT.md](../demo/DEMO_SCRIPT.md).

---
*Hemanth A R — SecureRAG v1.0*
