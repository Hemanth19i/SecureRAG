# `/query` Response Contract (locked)

This is the human-readable source of truth for the `POST /query` response shape,
mirrored by the assertions in `test_contract_query.py`. Any change here is a
breaking API change and must be intentional.

```jsonc
{
  "status": "success",

  // analyze_threat() output — Gemini, or the rule-based fallback (which adds
  // "analysis_method"); on hard failure it returns {"error": ...}. Mocked in tests.
  "analysis": {
    "answer": "string",
    "severity": "CRITICAL | HIGH | MEDIUM | LOW",
    "summary": "string",
    "threats": ["string"],
    "recommendations": ["string"]
  },

  // extract_iocs(combined_text) — exactly these 7 list keys.
  "iocs": {
    "ips": [], "domains": [], "hashes": [], "cves": [],
    "emails": [], "ipv6": [], "urls": []
  },

  // Nested object (NOT a flat list).
  "correlation": {
    "details": {
      "<ioc_value>": {
        "category": "string", "type": "string", "role": "string",
        "seen_in_files": ["string"], "frequency": 0,
        "first_seen": "string", "last_seen": "string",
        "risk_level": "HIGH | MEDIUM | LOW", "context_flags": ["string"]
      }
    },
    "summary": ["string"],
    "analyst_insights": ["string"]
  },

  // Techniques live under "techniques" (+ phase-ordered "kill_chain").
  "mitre": {
    "techniques": [
      {
        "tactic": "string", "technique": "Txxxx", "name": "string",
        "phase": "TAxxxx", "evidence": ["string"],
        "inferred": true, "note": "string",
        "confidence": "HIGH | MEDIUM | LOW"
      }
    ],
    "kill_chain": [ /* same items, sorted by kill-chain phase */ ]
  },

  // Events under "events" (+ human-readable "summary"); chronologically sorted.
  // Note keys: event_type and mitre_technique (not tactic/technique).
  "timeline": {
    "events": [
      {
        "timestamp": "string", "event_type": "string",
        "description": "string", "mitre_technique": "Txxxx",
        "severity": "HIGH | MEDIUM | LOW | UNKNOWN", "phase_order": 0
      }
    ],
    "summary": "string"
  },

  // Additive (new) key: source-grounding for the answer — the retrieved chunks
  // that supported it. score = semantic similarity (1/(1+distance)) or null
  // (e.g. when hybrid retrieval is enabled and no distance is available).
  "citations": [
    { "chunk_id": "chunk_<upload>_<i>", "source_file": "ssh.log",
      "snippet": "first ~200 chars of the chunk", "score": 0.81 }
  ],

  "chunks_used": 0,
  "query": "string"
}
```

## Additive keys
- `citations[]` (added in the RAG upgrade) — new key only; all keys above are
  unchanged. Each entry: `chunk_id`, `source_file`, `snippet`, `score`.

## Empty states
- When the analyzed text has **no parseable timestamps**, `timeline.events` is
  `[]` and `timeline.summary` is the string `"No timeline events found."`
  (`generate_timeline()` returns `[]` — there is no `T+unknown` placeholder event).

## Locked invariants (the 4 nuances)
1. `mitre` items are under `mitre.techniques` (+ `mitre.kill_chain`), each also
   carrying `name`, `inferred`, `note` beyond `confidence/evidence/tactic/technique/phase`.
2. `iocs` has **7** keys (the original 5 + `ipv6`, `urls`).
3. timeline events use `event_type` and `mitre_technique` (not `tactic`/`technique`),
   under `timeline.events` (+ `timeline.summary`).
4. `correlation` is nested: `details` / `summary` / `analyst_insights`.
