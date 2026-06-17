# Graph Report - .  (2026-06-17)

## Corpus Check
- Corpus is ~30,948 words - fits in a single context window. You may not need a graph.

## Summary
- 228 nodes · 368 edges · 16 communities (10 shown, 6 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_React Frontend UI|React Frontend UI]]
- [[_COMMUNITY_Flask API Routes|Flask API Routes]]
- [[_COMMUNITY_Frontend Dependencies|Frontend Dependencies]]
- [[_COMMUNITY_SQLite SIEM Store|SQLite SIEM Store]]
- [[_COMMUNITY_Agent Architecture Plan|Agent Architecture Plan]]
- [[_COMMUNITY_JWT Auth & RBAC|JWT Auth & RBAC]]
- [[_COMMUNITY_Threat Analysis & LLM|Threat Analysis & LLM]]
- [[_COMMUNITY_RAG Ingestion Pipeline|RAG Ingestion Pipeline]]
- [[_COMMUNITY_Frontend Assets|Frontend Assets]]
- [[_COMMUNITY_Vector Embedding|Vector Embedding]]
- [[_COMMUNITY_Frontend Scaffolding|Frontend Scaffolding]]
- [[_COMMUNITY_VS Code Config|VS Code Config]]
- [[_COMMUNITY_Claude Settings|Claude Settings]]
- [[_COMMUNITY_Embedder Class|Embedder Class]]

## God Nodes (most connected - your core abstractions)
1. `SQLiteStore` - 27 edges
2. `query_system()` - 12 edges
3. `generate_timeline()` - 12 edges
4. `App()` - 9 edges
5. `upload_log()` - 9 edges
6. `VectorStore` - 9 edges
7. `apiFetch()` - 8 edges
8. `useAuth()` - 8 edges
9. `create_app()` - 8 edges
10. `extract_iocs()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `scripts-reindex Community (server/scripts)` --references--> `test_prompt_injection()`  [EXTRACTED]
  .code-review-graph/wiki/scripts-reindex.md → server/scripts/test_prompt_injection.py
- `securerag-mocksqlite Community (test_correlator)` --references--> `MockSQLite`  [EXTRACTED]
  .code-review-graph/wiki/securerag-mocksqlite.md → test_correlator.py
- `Global Correlation Integration Flow` --semantically_similar_to--> `correlate_iocs invocation (test_correlator)`  [INFERRED] [semantically similar]
  test_global_corr.py → test_correlator.py
- `Global Correlation Integration Flow` --semantically_similar_to--> `extract_iocs invocation (test_extract)`  [INFERRED] [semantically similar]
  test_global_corr.py → test_extract.py
- `Ingestion Agent` --conceptually_related_to--> `SQLite SIEM Storage Pattern`  [INFERRED]
  Agents.md → server/scripts/test_sqlite_siem.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Upload Ingestion Pipeline: chunk -> embed -> store -> extract -> correlate** — api_routes_upload, rag_chunker_chunk, rag_embedder_embed_chunks, rag_vectorstore_store, intelligence_ioc_extractor_extract, intelligence_mitre_mapper_map, intelligence_timeline_gen_generate, intelligence_correlator_correlate, intelligence_sqlite_store_class [EXTRACTED 1.00]
- **PHASE_ORDER shared by Mitre Mapper, Timeline Gen, Attack Graph** — intelligence_mitre_mapper_phase_order, intelligence_timeline_gen_generate, intelligence_attack_graph_build, intelligence_mitre_mapper_technique_phase [EXTRACTED 1.00]
- **Query Analysis Flow: embed -> vector-search -> ioc/mitre/timeline/gemini** — api_routes_query, rag_embedder_embed_query, rag_vectorstore_query, intelligence_ioc_extractor_extract, intelligence_mitre_mapper_map, intelligence_timeline_gen_generate, intelligence_gemini_analyzer_analyze [EXTRACTED 1.00]
- **Global IOC Correlation Test Flow (extract, store, correlate)** — test_global_corr_global_correlation_flow, test_extract_extract_iocs_call, test_correlator_correlate_iocs_call [INFERRED 0.85]
- **SQLite SIEM Test Coverage (store, mock, integration)** — scripts_test_sqlite_siem_test_sqlite, test_correlator_mocksqlite, concept_sqlite_siem_storage [EXTRACTED 1.00]
- **SecureRAG Agent Decomposition (ingestion, IOC, correlation, MITRE, reporting)** — agents_md_ingestion_agent, agents_md_ioc_agent, agents_md_correlation_agent, agents_md_mitre_agent, agents_md_reporting_agent [EXTRACTED 1.00]

## Communities (16 total, 6 thin omitted)

### Community 0 - "React Frontend UI"
Cohesion: 0.09
Nodes (41): apiFetch(), App(), BASELINE, Counter(), DETECTED, EASE, ENV, fetchCorrelations() (+33 more)

### Community 1 - "Flask API Routes"
Cohesion: 0.09
Nodes (29): attack_graph_endpoint(), correlate_endpoint(), mitre_map(), query_system(), timeline_endpoint(), MITRE ATT&CK Kill-Chain Phase Ordering (shared constant), build_attack_graph(), Build a nodes/edges attack graph for one upload from already-stored data.      N (+21 more)

### Community 2 - "Frontend Dependencies"
Cohesion: 0.08
Nodes (25): dependencies, framer-motion, lucide-react, motion, react, react-dom, devDependencies, eslint (+17 more)

### Community 4 - "Agent Architecture Plan"
Cohesion: 0.10
Nodes (22): Correlation Agent, Ingestion Agent, IOC Agent, MITRE Agent, Reporting Agent, SecureRAG Platform, Global Correlation Pipeline, MockSQLite In-Memory Testing Pattern (+14 more)

### Community 5 - "JWT Auth & RBAC"
Cohesion: 0.11
Nodes (12): _client_ip(), login(), _login_rate_limited(), register(), JWT-based RBAC (ADMIN/ANALYST/VIEWER), SQLite SIEM Event Store (8-table schema), SQLiteStore class, VectorStore class (+4 more)

### Community 6 - "Threat Analysis & LLM"
Cohesion: 0.20
Nodes (10): Prompt Injection Defense, report_endpoint(), Gemini -> Rule-Based Analyzer Fallback Pattern, Prompt Injection Detection Pattern, AnalysisSchema, analyze_threat(), generate_incident_report(), rule_based_analyze() (+2 more)

### Community 7 - "RAG Ingestion Pipeline"
Cohesion: 0.31
Nodes (8): upload_log(), Atomic Upload Transaction (ChromaDB first, then SQLite), RAG Ingestion Pipeline (chunk->embed->store), chunk_text(), chunk_text_generator(), Split text into chunks by line boundaries, never cutting mid-line.     `overlap`, embed_chunks(), store_embeddings()

### Community 8 - "Frontend Assets"
Cohesion: 0.50
Nodes (5): Hero Isometric Illustration, React Logo SVG, Vite Logo SVG, SecureRAG Favicon SVG, UI Icon Sprite Sheet

## Knowledge Gaps
- **48 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+43 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SQLiteStore` connect `SQLite SIEM Store` to `Flask API Routes`, `Agent Architecture Plan`, `JWT Auth & RBAC`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **Why does `create_app()` connect `JWT Auth & RBAC` to `Flask API Routes`, `SQLite SIEM Store`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `test_sqlite()` connect `Agent Architecture Plan` to `Flask API Routes`, `SQLite SIEM Store`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `generate_timeline()` (e.g. with `MITRE ATT&CK Kill-Chain Phase Ordering (shared constant)` and `build_kill_chain()`) actually correct?**
  _`generate_timeline()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _59 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `React Frontend UI` be split into smaller, more focused modules?**
  _Cohesion score 0.08599290780141844 - nodes in this community are weakly interconnected._
- **Should `Flask API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.08879492600422834 - nodes in this community are weakly interconnected._