# SecureRAG — Technical Interview Q&A

A study guide for defending the design in interviews. Answers reflect the actual
implementation.

---

## RAG Architecture

**Q. Walk me through the RAG pipeline.**
On ingestion, log text is split by `chunk_text()`, embedded with
SentenceTransformers `all-MiniLM-L6-v2` (384-dim), and stored in ChromaDB. At
query time the question is embedded, ChromaDB returns the top-k nearest chunks,
and those chunks — plus structured intelligence (correlated IOCs, MITRE matches,
timeline) — are assembled into a prompt for Gemini, which returns a JSON-schema'd
analysis (answer, severity, threats, recommendations).

**Q. Why RAG instead of just prompting the LLM with the logs?**
Three reasons: (1) **grounding** — answers cite retrieved evidence, reducing
hallucination; (2) **scale** — logs far exceed the context window, so we retrieve
only what's relevant; (3) **separation of concerns** — deterministic extraction
(IOC/MITRE/timeline) runs independently of the LLM and still works without it.

**Q. How do you defend against prompt injection from malicious log content?**
Untrusted logs are wrapped in explicit XML boundaries (`<UNTRUSTED_RAW_LOGS>`)
with a system instruction to never execute instructions inside them; the user
query is similarly fenced. A keyword detector flags suspected injection and
annotates the result rather than trusting it. Logs are never sanitized (forensic
integrity) — they're isolated.

**Q. What happens when Gemini is unavailable?**
A deterministic `rule_based_analyze()` fallback produces the same response shape
from keyword/correlation heuristics. There are also two model tiers
(`gemini-2.5-flash` → `gemini-flash-latest`) before falling back. The product
never hard-fails on LLM outage — verified in the failure-path tests.

**Q. Why `all-MiniLM-L6-v2`?**
Small (384-dim), fast on CPU, strong semantic quality for short log lines, and
runs locally with no per-call cost or data egress — important for security data.

---

## ChromaDB

**Q. Why ChromaDB over pgvector/FAISS/Pinecone?**
It's an embedded, persistent vector DB — no extra service to operate, simple
Python API, and good enough for single-node SOC scale. FAISS lacks persistence
ergonomics; Pinecone adds a managed dependency and sends data off-box (undesirable
for security logs); pgvector would be the migration target at higher scale.

**Q. How is similarity computed and ranked?**
ChromaDB returns L2 distance; we request `n_results = min(top_k, collection
count)` to avoid over-asking an empty/small store. For display we map distance to
a 0–1 similarity via `1 / (1 + distance)`.

**Q. How do you keep ChromaDB and SQLite consistent?**
ChromaDB is written **first**; only if that succeeds do the SQLite analysis rows
get written, inside a single transaction. So a vector-store failure leaves no
orphaned SQLite rows, and a partial SQLite failure rolls back atomically.

**Q. Chunk IDs?**
Deterministic: `chunk_{upload_id}_{i}`, shared between ChromaDB and SQLite so a
retrieved vector maps back to its source row and metadata.

---

## MITRE ATT&CK Mapping

**Q. How does mapping work?**
`map_to_mitre()` matches log content against technique signatures, returning
`{technique, tactic, confidence}`. Results persist in `chunk_mitre_mapping`, and
`build_kill_chain()` orders techniques by tactic to reconstruct the attack
progression.

**Q. Rule-based mapping — limitations and why it's acceptable?**
It can miss novel phrasing and over/under-match. It's acceptable because it's
fast, explainable (analysts see the matched evidence), deterministic, and free of
LLM cost/latency on the ingestion path. Confidence levels let the UI prioritize.
An embedding- or LLM-assisted classifier is a natural upgrade.

**Q. How does MITRE feed the rest of the system?**
High-confidence techniques become alerts; techniques feed the attack graph and
timeline; and the technique set is part of the structured context handed to the
LLM during investigation.

---

## Threat Intelligence

**Q. How does enrichment work and why cache-first?**
`get_enrichment()` checks the `ioc_enrichment` table first; on miss it calls
AbuseIPDB (stdlib urllib) and caches the normalized record with a TTL —
`OK_TTL` 24h for hits, `NEG_TTL` 1h for failures/unsupported. Cache-first cuts
latency and API quota and survives provider outages.

**Q. How are verdicts derived?**
From AbuseIPDB's abuse-confidence score: ≥75 MALICIOUS, 40–74 SUSPICIOUS, else
CLEAN; UNKNOWN when unavailable.

**Q. What about private IPs and missing keys?**
Only public IPv4s are enriched (RFC1918/loopback/link-local filtered client-side).
With no API key the call returns `unavailable` and the UI degrades gracefully —
it never raises. Verified in the test sweep.

---

## Alerting

**Q. How are alerts generated — does the LLM decide?**
No. `build_alerts()` is a pure function over existing analysis outputs
(HIGH-severity timeline events, high-confidence MITRE techniques, high-risk IOC
correlations, brute-force-success patterns). Keeping the LLM off the alert path
means alerts are deterministic, fast, and cost-free.

**Q. How do you prevent alert storms / duplicates?**
Dedup within a batch by technique id and by `(timestamp, type, technique)`; and a
`BRUTE_FORCE_SUCCESS` (CRITICAL) supersedes a `HIGH_RISK_IOC` for the same IOC so
we don't double-fire.

**Q. How does the live dashboard get alerts in real time, and why polling?**
Cursor-based delta polling: `alert_id` is an autoincrement cursor, and the client
sends `GET /alerts?since=<last_id>` every ~10s, prepending only new rows. Polling
was chosen over SSE/WebSocket because the backend is sync Flask — SSE would hold a
worker thread per client. The cursor model maps cleanly to SSE `Last-Event-ID`
when we migrate.

**Q. How does acknowledge work with the forward-only poll?**
Ack is a `PATCH /alerts/<id>` plus an optimistic UI update. Because the poll only
fetches *newer* ids, it never re-sends an acked alert, so the UI reconciles only
on failure; the server remains source of truth on a full reload.

---

## Attack Graph

**Q. What does the attack graph represent?**
For a given `upload_id`, `build_attack_graph()` reads SQLite and returns nodes
(the upload, its IOCs, mapped techniques) and edges (`maps_to`, `triggers`,
`correlates_with`), rendered with React Flow.

**Q. How are failures handled?**
Internal errors return an empty `{nodes, edges}` rather than crashing; an unknown
`upload_id` returns `None`, which the endpoint surfaces as a 404. The endpoint is
RBAC-gated like the rest.

**Q. Why build it from SQLite rather than recomputing?**
The relationships were already computed and persisted during ingestion, so the
graph is a cheap read/projection — no re-analysis, no LLM.

---

## Retrieval Evaluation

**Q. Why a separate retrieval-eval endpoint instead of reusing /query?**
`/query` runs the full pipeline (IOC/MITRE/timeline/LLM), which would pollute
latency and obscure retrieval quality. `POST /retrieval/eval` does embed + vector
search only, returning ranked chunks with similarity, distance, source evidence,
and per-stage latency (embed / search / total).

**Q. How would you measure retrieval quality rigorously?**
Recall@K / Precision@K / MRR against a labeled set of (query, relevant-chunk)
pairs. The response already reserves a `recall_at_k` field; the next step is a
ground-truth set and scoring, plus latency percentiles under load.

**Q. What did the latency numbers show?**
Embedding dominates (~18–220 ms depending on warm/cold model) while vector search
is single-digit ms — which correctly points optimization at embedding (batching,
caching, a faster model) rather than the vector store.

---

## Production & System Design

**Q. Why SQLite, and how do you handle concurrency?**
SQLite is zero-ops and sufficient for single-node SOC scale. WAL mode allows
concurrent readers with a writer; a connection + `busy_timeout` (default 30s)
makes writers wait rather than fail under contention — verified by holding an
exclusive lock and observing the writer wait. Postgres is the scale-out path.

**Q. Auth design?**
JWT access (15 min) + refresh (30 day), ADMIN/ANALYST roles enforced per endpoint;
the SPA silently refreshes on 401 with a single-flight guard. The app fails closed
without a strong (≥32-char, non-placeholder) `JWT_SECRET_KEY`.

**Q. Biggest limitations and how you'd address them?**
Single-node SQLite (→ Postgres), per-ingest global correlation recompute
(→ windowed), polling delivery (→ SSE), a single-file frontend bundle (→ component
split + code-splitting), and in-memory rate limiting (→ Redis for multi-worker).
All are tracked in the release notes' roadmap.

**Q. How do you know it works?**
A 29-check release sweep (full endpoint matrix + failure paths: invalid/expired
JWT, empty/oversized/malformed payloads, missing auth, Gemini & AbuseIPDB
outages, SQLite lock) runs green against the production Waitress server.
