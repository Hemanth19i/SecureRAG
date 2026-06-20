"""Alert generation: idempotency + per-upload scoping (regression for the
duplicate-alert bug found in QA).

Before the fix, every upload re-fired HIGH_RISK_IOC / BRUTE_FORCE_SUCCESS for
*all* globally-correlated high-risk IOCs, so the same (alert_type, ioc_value)
accumulated one row per upload. These tests pin the fixed behaviour:
  - store_alert is idempotent per (alert_type, ioc_value) for IOC-bearing alerts;
  - NULL-ioc alerts (timeline/technique) are NOT collapsed;
  - re-ingesting the same IOC across two uploads does not duplicate its alert,
    while a brand-new IOC still alerts and a foreign IOC is not re-fired.
"""


def _brute_log(ips, tag):
    """A log with a fail->fail->success SSH pattern per IP (fires
    BRUTE_FORCE_SUCCESS). `tag` varies the bytes so each upload has a distinct
    file hash (otherwise /upload-style dedup would short-circuit it)."""
    lines = []
    for ip in ips:
        lines += [
            f"2026-06-20 09:00:01 Failed password for admin from {ip} port 22 ssh2",
            f"2026-06-20 09:00:03 Failed password for root from {ip} port 22 ssh2",
            f"2026-06-20 09:00:09 Accepted password for admin from {ip} port 22 ssh2",
        ]
    lines.append(f"# upload {tag}")
    return "\n".join(lines) + "\n"


def test_store_alert_idempotent_per_ioc(app):
    with app.app_context():
        s = app.sqlite_store
        ioc_alert = {
            "severity": "HIGH", "alert_type": "HIGH_RISK_IOC", "title": "t",
            "ioc_value": "9.9.9.9", "technique_id": None, "source": "x",
            "upload_id": "u", "details": {},
        }
        assert s.store_alert(ioc_alert) == 1      # inserted
        assert s.store_alert(ioc_alert) == 0      # duplicate (type, ioc) ignored
        rows = [a for a in s.get_alerts(0, 500) if a["ioc_value"] == "9.9.9.9"]
        assert len(rows) == 1

        # NULL-ioc alerts (timeline/technique) are outside the partial index and
        # must still be allowed to repeat — they are legitimately distinct events.
        tl = {
            "severity": "HIGH", "alert_type": "TIMELINE_HIGH_SEVERITY", "title": "e1",
            "ioc_value": None, "technique_id": "T1110", "source": "x",
            "upload_id": "u", "details": {},
        }
        assert s.store_alert(tl) == 1
        assert s.store_alert({**tl, "title": "e2"}) == 1
        nulls = [a for a in s.get_alerts(0, 500) if a["alert_type"] == "TIMELINE_HIGH_SEVERITY"]
        assert len(nulls) == 2


def test_repeat_ioc_across_uploads_does_not_duplicate_alert(app):
    from intelligence.ingest import ingest_text
    from rag.embedder import Embedder

    ip_only_first = "198.51.100.10"   # only in upload 1  -> scoping check
    ip_shared = "198.51.100.20"       # in both uploads   -> dedup check
    ip_only_second = "198.51.100.30"  # only in upload 2  -> new-alert check

    with app.app_context():
        store, vs, emb = app.sqlite_store, app.vector_store, Embedder()

        def bf_count(ip):
            return sum(
                1 for a in store.get_alerts(0, 1000)
                if a["alert_type"] == "BRUTE_FORCE_SUCCESS" and a["ioc_value"] == ip
            )

        r1 = ingest_text(_brute_log([ip_only_first, ip_shared], "one"), "u1.log",
                         sqlite_store=store, vector_store=vs, embedder=emb)
        assert r1["status"] == "ok"
        assert bf_count(ip_only_first) == 1
        assert bf_count(ip_shared) == 1

        r2 = ingest_text(_brute_log([ip_only_second, ip_shared], "two"), "u2.log",
                         sqlite_store=store, vector_store=vs, embedder=emb)
        assert r2["status"] == "ok"

        # dedup: the shared IOC must NOT have a second alert.
        assert bf_count(ip_shared) == 1
        # scoping: an IOC absent from upload 2 must NOT be re-fired by it.
        assert bf_count(ip_only_first) == 1
        # no false-negative: a brand-new IOC still raises its alert.
        assert bf_count(ip_only_second) == 1
