"""Opt-in end-to-end test: REAL embedder + REAL Chroma + /query.

Deselected by default (CI runs `-m "not integration"`). Run locally with:

    pytest -m integration

It downloads the all-MiniLM-L6-v2 model on first run (then cached). Gemini is
still mocked so no API key/network is needed for the LLM step — the point is to
exercise the real embedding + vector-retrieval path, not the external LLM.
"""
import io

import pytest

import rag.embedder as emb
import api.routes as routes


@pytest.mark.integration
def test_query_end_to_end_real_retrieval(client, app, monkeypatch, sample_log, admin_token):
    # Restore the real model + a real embedder for this test only.
    emb.SentenceTransformer = emb.REAL_SENTENCE_TRANSFORMER
    monkeypatch.setattr(routes, "embedder", emb.Embedder())
    monkeypatch.setattr(routes, "analyze_threat", lambda *a, **k: {
        "answer": "a", "severity": "HIGH", "summary": "s",
        "threats": [], "recommendations": [],
    })

    hdr = {"Authorization": f"Bearer {admin_token}"}

    # Real ingestion: real embeddings written to a real (temp) Chroma store.
    up = client.post(
        "/upload",
        data={"file": (io.BytesIO(sample_log.encode()), "e2e.log")},
        content_type="multipart/form-data",
        headers=hdr,
    )
    assert up.status_code == 200

    # Real retrieval through /query.
    resp = client.post("/query", json={"query": "was there a brute force attack?"}, headers=hdr)
    assert resp.status_code == 200
    body = resp.get_json()
    assert set(body) >= {"status", "analysis", "iocs", "correlation", "mitre",
                         "timeline", "chunks_used", "query"}
    assert body["chunks_used"] >= 1
