# SecureRAG — Project Snapshot (for reviewers)

**What:** An AI-powered threat-intelligence & SIEM platform that converts raw
security logs into analyst-ready intelligence.

**Role:** Sole designer & developer (full-stack + AI + DevOps).

**Impact:** Automates the slowest part of incident response — triaging
unstructured logs to determine who attacked, how (MITRE ATT&CK), what was
touched, and whether the attack succeeded.

---

### Built with
Python · Flask · React · ChromaDB (vector search) · SentenceTransformers ·
Google Gemini (RAG) · SQLite · JWT auth · Docker.

### Highlights at a glance
- **Retrieval-Augmented Generation** that grounds LLM answers in retrieved log
  evidence, with a deterministic fallback so it never hard-fails.
- **Automated IOC extraction, correlation, and MITRE ATT&CK mapping** with attack
  timeline and graph reconstruction.
- **Real-time monitoring** (alerts + live ingestion) and a **retrieval-evaluation
  dashboard** measuring search quality and latency.
- **Production-grade:** JWT/RBAC, input validation, hardened secrets,
  WSGI server, and one-command Docker deployment.
- **Tested:** 29/29 endpoint and failure-path checks pass against the production
  server, including third-party-outage degradation.

### Skills demonstrated
Applied GenAI / RAG · vector databases · API & auth design · security-domain
modeling · data modeling · containerization · testing & release engineering ·
technical documentation.

### Try it
`docker compose up` — or see [DEPLOYMENT.md](../DEPLOYMENT.md). A 10-minute guided
walkthrough with sample attack logs is in [demo/DEMO_SCRIPT.md](../demo/DEMO_SCRIPT.md).

---
*Hemanth A R — SecureRAG v1.0*
