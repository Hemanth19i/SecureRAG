"""Case management: lifecycle, role gating, and the append-only audit trail.

Offline — uses the conftest app (temp SQLite + Chroma, stubbed embedder).
"""
import sqlite3

import pytest


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


def _create(client, token, **fields):
    body = {"title": "Test case", "severity": "HIGH"}
    body.update(fields)
    r = client.post("/cases", json=body, headers=_bearer(token))
    assert r.status_code == 201, r.get_json()
    return r.get_json()["case"]["case_id"]


def _audit(client, token, case_id):
    return client.get(f"/cases/{case_id}", headers=_bearer(token)).get_json()["audit"]


# --- create -----------------------------------------------------------------
def test_create_case_opens_audit_trail(client, analyst_token):
    cid = _create(client, analyst_token, title="Intrusion on db01")
    audit = _audit(client, analyst_token, cid)
    assert any(e["entry_type"] == "created" for e in audit)


def test_create_requires_auth(client):
    assert client.post("/cases", json={"title": "x"}).status_code == 401


def test_create_forbidden_for_viewer(client, viewer_token):
    assert client.post("/cases", json={"title": "x"},
                       headers=_bearer(viewer_token)).status_code == 403


# --- list -------------------------------------------------------------------
def test_list_and_filter(client, admin_token):
    _create(client, admin_token, title="A", severity="HIGH")
    _create(client, admin_token, title="B", severity="LOW")
    all_cases = client.get("/cases", headers=_bearer(admin_token)).get_json()
    assert all_cases["total"] >= 2

    high = client.get("/cases?severity=HIGH", headers=_bearer(admin_token)).get_json()
    assert all(c["severity"] == "HIGH" for c in high["cases"])


# --- get --------------------------------------------------------------------
def test_get_case_returns_evidence_and_audit(client, analyst_token):
    cid = _create(client, analyst_token)
    body = client.get(f"/cases/{cid}", headers=_bearer(analyst_token)).get_json()
    assert "evidence" in body and isinstance(body["evidence"], list)
    assert "audit" in body and isinstance(body["audit"], list)


def test_get_missing_case_404(client, admin_token):
    assert client.get("/cases/nope", headers=_bearer(admin_token)).status_code == 404


# --- update / lifecycle -----------------------------------------------------
def test_analyst_can_advance_status_and_it_is_audited(client, analyst_token):
    cid = _create(client, analyst_token)
    for new_status in ("IN_PROGRESS", "CONTAINED"):
        r = client.patch(f"/cases/{cid}", json={"status": new_status},
                         headers=_bearer(analyst_token))
        assert r.status_code == 200
        assert r.get_json()["case"]["status"] == new_status

    changes = [e for e in _audit(client, analyst_token, cid) if e["entry_type"] == "status_change"]
    assert len(changes) >= 2


def test_invalid_status_rejected(client, analyst_token):
    cid = _create(client, analyst_token)
    assert client.patch(f"/cases/{cid}", json={"status": "BOGUS"},
                        headers=_bearer(analyst_token)).status_code == 400


def test_close_requires_admin(client, analyst_token, admin_token):
    cid = _create(client, analyst_token)
    assert client.patch(f"/cases/{cid}", json={"status": "CLOSED"},
                        headers=_bearer(analyst_token)).status_code == 403
    r = client.patch(f"/cases/{cid}", json={"status": "CLOSED"}, headers=_bearer(admin_token))
    assert r.status_code == 200 and r.get_json()["case"]["status"] == "CLOSED"


def test_reassign_requires_admin(client, analyst_token, admin_token):
    cid = _create(client, analyst_token)
    assert client.patch(f"/cases/{cid}", json={"assigned_to": "bob"},
                        headers=_bearer(analyst_token)).status_code == 403
    r = client.patch(f"/cases/{cid}", json={"assigned_to": "bob"}, headers=_bearer(admin_token))
    assert r.status_code == 200
    assert any(e["entry_type"] == "assignment" for e in _audit(client, admin_token, cid))


# --- notes ------------------------------------------------------------------
def test_note_is_recorded_in_notes_and_audit(client, analyst_token):
    cid = _create(client, analyst_token)
    r = client.post(f"/cases/{cid}/notes", json={"body": "checked the firewall logs"},
                    headers=_bearer(analyst_token))
    assert r.status_code == 201
    notes = client.get(f"/cases/{cid}/notes", headers=_bearer(analyst_token)).get_json()["notes"]
    assert any(n["body"] == "checked the firewall logs" for n in notes)
    audit = _audit(client, analyst_token, cid)
    assert any(e["entry_type"] == "note" and e["content"] == "checked the firewall logs" for e in audit)


# --- link evidence ----------------------------------------------------------
def test_link_evidence_snapshot(client, analyst_token):
    cid = _create(client, analyst_token)
    snap = {"iocs": {"ips": ["203.0.113.45"]}, "mitre": {"techniques": []}}
    r = client.post(f"/cases/{cid}/link-evidence", json={"snapshot": snap},
                    headers=_bearer(analyst_token))
    assert r.status_code == 201
    evidence = r.get_json()["evidence"]
    assert evidence and evidence[0]["evidence_type"] == "snapshot"
    assert evidence[0]["payload"] == snap
    assert any(e["entry_type"] == "evidence_linked" for e in _audit(client, analyst_token, cid))


def test_link_evidence_explicit_type(client, analyst_token):
    cid = _create(client, analyst_token)
    r = client.post(f"/cases/{cid}/link-evidence",
                    json={"evidence_type": "ioc", "payload": {"value": "evil.example"}},
                    headers=_bearer(analyst_token))
    assert r.status_code == 201
    assert r.get_json()["evidence"][-1]["evidence_type"] == "ioc"


def test_link_evidence_bad_body_400(client, analyst_token):
    cid = _create(client, analyst_token)
    assert client.post(f"/cases/{cid}/link-evidence", json={},
                       headers=_bearer(analyst_token)).status_code == 400


# --- the audit trail is immutable (the product) -----------------------------
def test_audit_trail_is_append_only(app, client, analyst_token):
    cid = _create(client, analyst_token)
    store = app.sqlite_store
    conn = store.get_connection()
    try:
        row = conn.execute("SELECT audit_id FROM case_audit WHERE case_id=?", (cid,)).fetchone()
        assert row is not None
        aid = row[0]
        # DB triggers must reject any edit or delete of an audit entry.
        with pytest.raises(sqlite3.Error):
            conn.execute("UPDATE case_audit SET content='tampered' WHERE audit_id=?", (aid,))
            conn.commit()
        conn.rollback()
        with pytest.raises(sqlite3.Error):
            conn.execute("DELETE FROM case_audit WHERE audit_id=?", (aid,))
            conn.commit()
        conn.rollback()
    finally:
        conn.close()

    # The store exposes no mutation path for the audit trail.
    assert not hasattr(store, "update_case_audit")
    assert not hasattr(store, "delete_case_audit")
