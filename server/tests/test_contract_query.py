"""Contract guardrail for POST /query.

This test locks the response shape so future changes can't silently drift it.
The full contract is documented in tests/CONTRACT.md. Summary:

    {
      status, query, chunks_used,
      analysis:   {answer, severity, summary, threats[], recommendations[]},
      iocs:       {ips, domains, hashes, cves, emails, ipv6, urls},   # 7 keys
      correlation:{details{<ioc>{category,type,role,seen_in_files,frequency,
                                 first_seen,last_seen,risk_level,context_flags}},
                   summary[], analyst_insights[]},
      mitre:      {techniques[{tactic,technique,name,phase,evidence,
                               inferred,note,confidence}], kill_chain[]},
      timeline:   {events[{timestamp,event_type,description,mitre_technique,
                           severity,phase_order}], summary},
    }

Retrieval (embedder + Chroma) and Gemini are stubbed/mocked so the intelligence
layer runs for real against a known document, offline and deterministically.
"""
import api.routes as routes


def _fake_analysis(*args, **kwargs):
    return {
        "answer": "Brute-force attack succeeded from 203.0.113.45.",
        "severity": "HIGH",
        "summary": "Successful compromise after repeated auth failures.",
        "threats": ["SSH brute force", "Unauthorized access"],
        "recommendations": ["Isolate host", "Rotate credentials"],
    }


def _call_query(client, app, monkeypatch, sample_log, token):
    # Stub retrieval to return our known document, and mock the LLM.
    monkeypatch.setattr(
        app.vector_store,
        "query_similar",
        lambda emb, top_k=5: {
            "documents": [[sample_log]],
            "metadatas": [[{"source_file": "sample.log", "upload_id": "u1", "chunk_id": "chunk_u1_0"}]],
            "distances": [[0.12]],
        },
    )
    monkeypatch.setattr(routes, "analyze_threat", _fake_analysis)

    # Seed a global correlation row so correlation.details locks its sub-shape.
    app.sqlite_store.store_global_correlation(
        {
            "203.0.113.45": {
                "category": "ATTACKER_IP", "type": "IP", "role": "ATTACKER_IP",
                "seen_in_files": ["sample.log"], "frequency": 4,
                "first_seen": "2026-06-15 02:11:03", "last_seen": "2026-06-15 02:11:20",
                "risk_level": "HIGH", "context_flags": ["fail", "success"],
            }
        }
    )

    return client.post(
        "/query",
        json={"query": "was there a brute force attack?"},
        headers={"Authorization": f"Bearer {token}"},
    )


def test_query_contract(client, app, monkeypatch, sample_log, admin_token):
    resp = _call_query(client, app, monkeypatch, sample_log, admin_token)
    assert resp.status_code == 200
    body = resp.get_json()

    # --- top-level keys (incl. additive citations) ---
    for key in ("status", "analysis", "iocs", "correlation", "mitre", "timeline",
                "citations", "chunks_used", "query"):
        assert key in body, f"missing top-level key: {key}"
    assert body["status"] == "success"
    assert isinstance(body["chunks_used"], int)

    # --- analysis ---
    for key in ("answer", "severity", "summary", "threats", "recommendations"):
        assert key in body["analysis"], f"missing analysis.{key}"
    assert isinstance(body["analysis"]["threats"], list)
    assert isinstance(body["analysis"]["recommendations"], list)

    # --- iocs: exactly the 7 list keys ---
    iocs = body["iocs"]
    assert set(iocs) == {"ips", "domains", "hashes", "cves", "emails", "ipv6", "urls"}
    assert all(isinstance(v, list) for v in iocs.values())
    assert "203.0.113.45" in iocs["ips"]
    assert "44d88612fea8a8f36de82e1278abb02f" in iocs["hashes"]
    assert "CVE-2021-44228" in iocs["cves"]
    assert "evil-domain.example" in iocs["domains"]
    assert "admin@corp.example" in iocs["emails"]

    # --- correlation: nested details/summary/analyst_insights ---
    corr = body["correlation"]
    assert set(corr) >= {"details", "summary", "analyst_insights"}
    assert isinstance(corr["details"], dict)
    assert isinstance(corr["summary"], list)
    assert isinstance(corr["analyst_insights"], list)
    detail = corr["details"]["203.0.113.45"]
    for key in ("category", "type", "role", "seen_in_files", "frequency",
                "first_seen", "last_seen", "risk_level", "context_flags"):
        assert key in detail, f"missing correlation.details.*.{key}"

    # --- mitre: techniques (+ kill_chain), each with the locked sub-keys ---
    mitre = body["mitre"]
    assert set(mitre) >= {"techniques", "kill_chain"}
    assert isinstance(mitre["techniques"], list) and mitre["techniques"]
    assert isinstance(mitre["kill_chain"], list)
    for tech in mitre["techniques"]:
        for key in ("tactic", "technique", "name", "phase", "evidence",
                    "inferred", "note", "confidence"):
            assert key in tech, f"missing mitre.techniques[].{key}"
        assert isinstance(tech["evidence"], list)
    technique_ids = {t["technique"] for t in mitre["techniques"]}
    assert "T1110" in technique_ids  # brute force from the sample

    # --- timeline: events (+ summary), chronological, locked sub-keys ---
    tl = body["timeline"]
    assert set(tl) >= {"events", "summary"}
    assert isinstance(tl["summary"], str)
    assert isinstance(tl["events"], list) and tl["events"]
    for ev in tl["events"]:
        for key in ("timestamp", "event_type", "description", "mitre_technique",
                    "severity", "phase_order"):
            assert key in ev, f"missing timeline.events[].{key}"
    dated = [e["timestamp"] for e in tl["events"] if e["timestamp"] != "T+unknown"]
    assert dated == sorted(dated), "timeline events must be chronologically ordered"

    # --- citations (additive key): source-grounding for the answer ---
    citations = body["citations"]
    assert isinstance(citations, list) and citations
    for cit in citations:
        for key in ("chunk_id", "source_file", "snippet", "score"):
            assert key in cit, f"missing citations[].{key}"
    assert citations[0]["chunk_id"] == "chunk_u1_0"
    assert citations[0]["source_file"] == "sample.log"
    assert citations[0]["score"] == round(1.0 / 1.12, 4)


def test_build_citations_shapes_chunks():
    from api.routes import _build_citations
    chunks = [
        {"document": "x" * 300, "metadata": {"chunk_id": "c1", "source_file": "a.log"}, "distance": 0.0},
        {"document": "y", "metadata": {"filename": "b.log"}, "distance": None},
    ]
    cits = _build_citations(chunks)
    assert cits[0]["chunk_id"] == "c1"
    assert cits[0]["source_file"] == "a.log"
    assert len(cits[0]["snippet"]) == 200          # snippet truncated to ~200 chars
    assert cits[0]["score"] == 1.0                 # 1/(1+0)
    assert cits[1]["source_file"] == "b.log"       # falls back to filename
    assert cits[1]["score"] is None                # no distance -> null score


def test_query_requires_auth(client):
    assert client.post("/query", json={"query": "x"}).status_code == 401


def test_query_forbidden_for_viewer(client, viewer_token):
    resp = client.post(
        "/query", json={"query": "x"},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert resp.status_code == 403
