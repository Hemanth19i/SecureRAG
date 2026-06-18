# SecureRAG — Architecture Diagram Set

Mermaid diagrams covering system context, components, data flow, the data model,
deployment, and key state machines. (GitHub renders Mermaid natively.)

---

## 1. System context

```mermaid
flowchart LR
  analyst([SOC Analyst]) -->|browser| SPA[React SPA]
  SPA -->|REST + JWT| API[Flask API]
  API --> GEM[(Google Gemini)]
  API --> ABDB[(AbuseIPDB)]
  API --> SQL[(SQLite WAL)]
  API --> CHR[(ChromaDB)]
```

---

## 2. Component architecture

```mermaid
flowchart TB
  subgraph Frontend
    APP["App.jsx (Vite SPA)"]
  end
  subgraph Backend["Flask backend (server/)"]
    AUTH["auth_bp /auth\nlogin · refresh · register\nrate limiting"]
    API["api_bp\nupload · query · stats · report\ncorrelate · attack-graph · enrich\ncases · alerts · monitor/feed\nretrieval/eval"]
    subgraph intelligence
      ING[ingest_text]
      IOC[ioc_extractor]
      MIT[mitre_mapper]
      TL[timeline_gen]
      COR[correlator]
      AL[alerts.build_alerts]
      TI[threat_intel]
      GA[gemini_analyzer]
    end
    subgraph rag
      CH[chunker]
      EMB[embedder]
      VS[vectorstore]
    end
    STORE[sqlite_store]
  end
  APP --> AUTH & API
  API --> ING & GA & TI
  ING --> CH --> EMB --> VS
  ING --> IOC & MIT & TL & COR & AL
  API --> STORE
  ING --> STORE
  VS --> CHRO[(ChromaDB)]
  STORE --> SQLITE[(SQLite WAL)]
```

---

## 3. Ingestion data flow (shared by /upload and /monitor/feed)

```mermaid
flowchart LR
  T[raw log text] --> C[chunk_text]
  C --> E[embed_chunks]
  E --> V[(ChromaDB\nwritten first)]
  C --> TX{SQLite transaction}
  TX --> LC[store_log_chunk]
  TX --> I[extract_iocs -> store_ioc]
  TX --> M[map_to_mitre -> store_mitre]
  TX --> TLN[generate_timeline -> store_timeline]
  TX --> FU[store_file_upload]
  TX --> COR[correlate_iocs -> store_global_correlation]
  COR --> AL[build_alerts -> store_alert]
```

ChromaDB is written before SQLite so a vector-store failure leaves no orphaned
analysis rows. Gemini is **not** on the ingestion/alert path.

---

## 4. Query vs. retrieval-eval paths

```mermaid
flowchart TB
  Q[POST /query] --> QE[embed] --> QV[vector search]
  QV --> QA[IOC + MITRE + timeline + correlation]
  QA --> QG[Gemini analysis] --> QR[full investigation result]

  R[POST /retrieval/eval] --> RE[embed] --> RV[vector search]
  RV --> RR[ranked chunks + similarity + distance + latency]
```

`/retrieval/eval` isolates the RAG step (no analysis/LLM) so latency and
similarity reflect retrieval only.

---

## 5. Data model (SQLite)

```mermaid
erDiagram
  log_chunks ||--o{ chunk_ioc_mapping : has
  extracted_iocs ||--o{ chunk_ioc_mapping : referenced_by
  log_chunks ||--o{ chunk_mitre_mapping : has
  log_chunks ||--o{ timeline : has
  file_uploads ||--o{ log_chunks : groups
  cases ||--o{ case_notes : has
  users {
    string username PK
    string password_hash
    string role
  }
  alerts {
    int alert_id PK
    string severity
    string alert_type
    int acknowledged
  }
  ioc_enrichment {
    string ioc_value PK
    string verdict
    int expires_at
  }
```

---

## 6. Deployment topology (Docker Compose)

```mermaid
flowchart LR
  user([User]) -->|:5173| FE[nginx\nstatic SPA]
  user -->|:5000| BE[Waitress\nFlask app]
  FE -. build-time VITE_API_BASE_URL .-> BE
  BE --> VOL[(named volume\n/data: SQLite + Chroma)]
  BE -.-> GEM[(Gemini)]
  BE -.-> ABDB[(AbuseIPDB)]
```

---

## 7. Alert lifecycle

```mermaid
stateDiagram-v2
  [*] --> NEW: build_alerts during ingestion
  NEW --> ACKNOWLEDGED: PATCH /alerts/<id> {acknowledged:true}
  ACKNOWLEDGED --> [*]
  note right of NEW
    cursor poll (GET /alerts?since=) streams
    new alerts to the live dashboard
  end note
```

---

## 8. Authentication flow

```mermaid
sequenceDiagram
  participant U as SPA
  participant A as /auth
  participant R as API
  U->>A: POST /login (user, pass)
  A-->>U: access (15m) + refresh (30d)
  U->>R: request + Bearer access
  R-->>U: 401 (expired)
  U->>A: POST /refresh (Bearer refresh)
  A-->>U: new access token
  U->>R: retry with new access
  R-->>U: 200
```
