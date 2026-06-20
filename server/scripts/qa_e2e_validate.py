"""QA E2E pipeline validation — READ-ONLY on product code.

Traces one known log through upload -> IOC -> MITRE -> timeline -> correlation
-> alerts, capturing the API layer and the SQLite/ChromaDB layer at every step.
Frontend (4th layer) is verified separately via the browser preview.

Run (from anywhere, needs the backend live on :5000):
    server/venv/Scripts/python.exe server/scripts/qa_e2e_validate.py
"""
import os
import sys
import json
import sqlite3
import subprocess
import urllib.request
import urllib.error

# Resolve paths relative to this file so the harness runs from any cwd.
_HERE = os.path.dirname(os.path.abspath(__file__))
SERVER_DIR = os.path.dirname(_HERE)
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

from intelligence.sqlite_store import SQLiteStore

BASE = "http://127.0.0.1:5000"
USER, PW = "admin", "SecureRAG-Demo-2026!"
LOG_FILE = os.path.join(_HERE, "qa_e2e_test.log")

# What we KNOW is in qa_e2e_test.log (ground truth):
KNOWN_IPS = ["185.243.115.84", "193.42.33.21"]
KNOWN_HASH = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
KNOWN_CVE = "CVE-2021-44228"
KNOWN_DOMAIN = "evil-c2-domain.example"

DB = SQLiteStore(db_path=os.path.join(SERVER_DIR, "securerag.db")).db_path


def jget(path, token, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Authorization", "Bearer " + token)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:  # noqa: F821
        return e.code, json.loads(e.read().decode() or "{}")  # noqa: F821 (urllib.error imported at top)


def login():
    _, d = jget("/auth/login", "", "POST", {"username": USER, "password": PW})
    return d["access_token"]


def upload(token):
    # curl handles multipart cleanly on Windows git-bash.
    out = subprocess.run(
        ["curl", "-s", "-X", "POST", BASE + "/upload",
         "-H", "Authorization: Bearer " + token,
         "-F", "file=@" + LOG_FILE],
        capture_output=True, text=True,
    ).stdout
    return json.loads(out)


def db_counts():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    q = lambda s: c.execute(s).fetchone()[0]  # noqa: E731
    out = {
        "file_uploads": q("SELECT COUNT(*) FROM file_uploads"),
        "extracted_iocs": q("SELECT COUNT(*) FROM extracted_iocs"),
        "mitre_distinct_technique": q("SELECT COUNT(DISTINCT technique_id) FROM chunk_mitre_mapping"),
        "threats_critical": q("SELECT COUNT(DISTINCT chunk_id) FROM chunk_mitre_mapping WHERE confidence='HIGH'"),
        "timeline_events": q("SELECT COUNT(*) FROM timeline_events"),
        "global_correlations": q("SELECT COUNT(*) FROM global_correlations"),
        "alerts": q("SELECT COUNT(*) FROM alerts"),
        "cases": q("SELECT COUNT(*) FROM cases"),
        "log_chunks": q("SELECT COUNT(*) FROM log_chunks"),
    }
    c.close()
    return out


def trace_upload(upload_id):
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    chunks = [r["chunk_id"] for r in c.execute("SELECT chunk_id FROM log_chunks WHERE upload_id=?", (upload_id,))]
    iocs, mitre, tl = [], [], []
    if chunks:
        qmarks = ",".join("?" * len(chunks))
        iocs = [(r["ioc_value"], r["ioc_type"]) for r in c.execute(
            f"SELECT DISTINCT cim.ioc_value, ei.ioc_type FROM chunk_ioc_mapping cim "
            f"JOIN extracted_iocs ei ON ei.ioc_value=cim.ioc_value WHERE cim.chunk_id IN ({qmarks})", chunks)]
        mitre = [(r["technique_id"], r["tactic"], r["confidence"]) for r in c.execute(
            f"SELECT DISTINCT technique_id, tactic, confidence FROM chunk_mitre_mapping WHERE chunk_id IN ({qmarks})", chunks)]
        tl = [(r["event_timestamp"], r["event_description"][:60], r["severity"]) for r in c.execute(
            f"SELECT event_timestamp, event_description, severity FROM timeline_events WHERE chunk_id IN ({qmarks}) ORDER BY event_timestamp", chunks)]
    c.close()
    return {"chunks": chunks, "iocs": iocs, "mitre": mitre, "timeline": tl}


def main():
    tok = login()
    log_text = open(LOG_FILE).read()

    print("=" * 70)
    print("BASELINE (before upload)")
    _, base_stats = jget("/stats", tok)
    _, base_alerts = jget("/alerts?since=0&limit=200", tok)
    base_db = db_counts()
    print("  API /stats.readouts :", base_stats["readouts"])
    print("  DB  counts          :", base_db)
    print("  API /alerts total   :", base_alerts["total"])
    base_cursor = base_alerts.get("cursor", 0)

    print("=" * 70)
    print("UPLOAD", LOG_FILE)
    up = upload(tok)
    print("  /upload response    :", up)

    # find the upload_id for our file (newest file_uploads row)
    c = sqlite3.connect(DB)
    row = c.execute("SELECT upload_id, filename FROM file_uploads ORDER BY timestamp DESC LIMIT 1").fetchone()
    c.close()
    upload_id = row[0]
    print("  upload_id (DB)      :", upload_id, "file:", row[1])

    print("=" * 70)
    print("AFTER (post upload)")
    _, after_stats = jget("/stats", tok)
    after_db = db_counts()
    print("  API /stats.readouts :", after_stats["readouts"])
    print("  DB  counts          :", after_db)

    print("=" * 70)
    print("DELTA (after - before)")
    for k in base_db:
        print(f"  {k:24} {base_db[k]:>4} -> {after_db[k]:>4}   (+{after_db[k]-base_db[k]})")

    print("=" * 70)
    print("STAGE TRACE for upload_id", upload_id)
    tr = trace_upload(upload_id)
    print("  DB chunks for upload:", len(tr["chunks"]))
    print("  -- IOC extraction (DB rows tied to this upload) --")
    for v, t in tr["iocs"]:
        print(f"     {t:8} {v}")
    got = {v for v, _ in tr["iocs"]}
    expected = set(KNOWN_IPS) | {KNOWN_HASH, KNOWN_CVE, KNOWN_DOMAIN}
    print("  EXPECTED in:", sorted(expected))
    print("  MISSING    :", sorted(expected - got) or "none")
    print("  EXTRA      :", sorted(got - expected) or "none")

    print("  -- MITRE (DB chunk_mitre_mapping for this upload) --")
    for tid, tac, conf in tr["mitre"]:
        print(f"     {tid:8} {conf:6} {tac}")
    print("  -- /mitre-map endpoint on the same text --")
    _, mm = jget("/mitre-map", tok, "POST", {"text": log_text})
    print("     techniques:", [t["technique"] for t in mm.get("techniques", [])])

    print("  -- Timeline (DB timeline_events for this upload) --")
    for ts, desc, sev in tr["timeline"]:
        print(f"     {ts}  [{sev}]  {desc}")
    print("  -- /timeline endpoint on the same text --")
    _, tlapi = jget("/timeline", tok, "POST", {"text": log_text})
    print("     events:", tlapi.get("total_events"), "first ts:",
          (tlapi.get("timeline") or [{}])[0].get("timestamp"))

    print("  -- Correlation (/correlate + DB global_correlations) --")
    _, corr = jget("/correlate", tok, "POST")
    cset = set(corr.get("correlations", {}).keys())
    for ip in KNOWN_IPS:
        print(f"     {ip}: in /correlate={ip in cset}")

    print("  -- Alerts fired by this upload (since baseline cursor) --")
    _, na = jget(f"/alerts?since={base_cursor}&limit=200", tok)
    for a in na.get("alerts", []):
        print(f"     #{a['alert_id']} [{a['severity']}] {a['alert_type']}: {a['title']}")

    print("  -- Case creatable from a /query snapshot --")
    _, qres = jget("/query", tok, "POST", {"query": "SSH brute force from 185.243.115.84 and CVE-2021-44228 exploit"})
    _, casej = jget("/cases", tok, "POST", {"query": qres.get("query"), "snapshot": qres})
    case = casej.get("case", {})
    print("     created case:", case.get("case_id", "<<FAILED>>"),
          "severity:", case.get("severity"), "status:", case.get("status"))

    print("=" * 70)
    print("DONE")


if __name__ == "__main__":
    main()
