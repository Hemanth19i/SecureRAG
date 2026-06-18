"""API tests: status codes, basic shape, and auth gating.

Offline: the embedder is stubbed (conftest) and stores are temp. No Gemini is
exercised here (these endpoints don't call it).
"""
import io


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


# --- /mitre-map -------------------------------------------------------------
def test_mitre_map_ok(client, admin_token):
    resp = client.post("/mitre-map", json={"text": "Failed password; Failed password; auth fail"},
                       headers=_bearer(admin_token))
    assert resp.status_code == 200
    body = resp.get_json()
    assert set(body) >= {"techniques", "kill_chain", "total_techniques"}
    assert isinstance(body["techniques"], list)


def test_mitre_map_requires_auth(client):
    assert client.post("/mitre-map", json={"text": "x"}).status_code == 401


def test_mitre_map_forbidden_for_viewer(client, viewer_token):
    assert client.post("/mitre-map", json={"text": "x"},
                       headers=_bearer(viewer_token)).status_code == 403


def test_mitre_map_missing_text(client, admin_token):
    assert client.post("/mitre-map", json={}, headers=_bearer(admin_token)).status_code == 400


# --- /timeline --------------------------------------------------------------
def test_timeline_ok(client, admin_token):
    resp = client.post("/timeline",
                       json={"text": "2026-06-15 02:00:00 Failed password for admin from 203.0.113.45"},
                       headers=_bearer(admin_token))
    assert resp.status_code == 200
    body = resp.get_json()
    assert set(body) >= {"timeline", "summary", "total_events"}
    assert isinstance(body["timeline"], list)


def test_timeline_missing_text(client, admin_token):
    assert client.post("/timeline", json={}, headers=_bearer(admin_token)).status_code == 400


# --- /correlate -------------------------------------------------------------
def test_correlate_ok(client, analyst_token):
    resp = client.post("/correlate", headers=_bearer(analyst_token))
    assert resp.status_code == 200
    body = resp.get_json()
    assert set(body) >= {"correlations", "summary", "high_risk_iocs", "analyst_insights"}


def test_correlate_requires_auth(client):
    assert client.post("/correlate").status_code == 401


# --- /upload ----------------------------------------------------------------
def test_upload_ok(client, admin_token):
    data = {"file": (io.BytesIO(b"2026-06-15 02:00:00 Failed password for admin from 203.0.113.45\n"),
                     "sample.log")}
    resp = client.post("/upload", data=data, content_type="multipart/form-data",
                       headers=_bearer(admin_token))
    assert resp.status_code == 200
    body = resp.get_json()
    assert "chunks_stored" in body


def test_upload_admin_only(client, analyst_token):
    data = {"file": (io.BytesIO(b"log line"), "x.log")}
    resp = client.post("/upload", data=data, content_type="multipart/form-data",
                       headers=_bearer(analyst_token))
    assert resp.status_code == 403


def test_upload_no_file(client, admin_token):
    assert client.post("/upload", headers=_bearer(admin_token)).status_code == 400


# --- /debug/chunks ----------------------------------------------------------
def test_debug_chunks_admin_ok(client, admin_token):
    resp = client.get("/debug/chunks", headers=_bearer(admin_token))
    assert resp.status_code == 200
    assert "total_chunks" in resp.get_json()


def test_debug_chunks_admin_only(client, analyst_token):
    assert client.get("/debug/chunks", headers=_bearer(analyst_token)).status_code == 403
