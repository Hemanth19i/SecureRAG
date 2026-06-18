"""Unit tests for intelligence.correlator.correlate_iocs (uses a temp SQLite)."""
from intelligence.sqlite_store import SQLiteStore
from intelligence.correlator import correlate_iocs


def test_shared_indicator_detected_across_two_documents(tmp_path):
    store = SQLiteStore(db_path=str(tmp_path / "corr.db"))
    ip = "203.0.113.45"

    # Two different source files both referencing the same attacker IP.
    store.store_log_chunk("c1", "u1", "fileA.log", f"Failed password from {ip} port 22")
    store.store_ioc(ip, "ip", "c1")
    store.store_log_chunk("c2", "u2", "fileB.log", f"auth fail from {ip} again")
    store.store_ioc(ip, "ip", "c2")

    result = correlate_iocs({"ips": [ip]}, store)

    assert ip in result
    assert set(result[ip]["seen_in_files"]) == {"fileA.log", "fileB.log"}
    assert result[ip]["frequency"] >= 2
    for key in ("category", "type", "role", "seen_in_files", "frequency",
                "first_seen", "last_seen", "risk_level", "context_flags"):
        assert key in result[ip], f"missing {key}"


def test_brute_force_success_flags(tmp_path):
    store = SQLiteStore(db_path=str(tmp_path / "corr2.db"))
    ip = "203.0.113.45"
    store.store_log_chunk("c1", "u1", "f.log",
                          f"Failed password from {ip}\naccepted password for admin from {ip}")
    store.store_ioc(ip, "ip", "c1")

    result = correlate_iocs({"ips": [ip]}, store)
    flags = set(result[ip]["context_flags"])
    assert {"fail", "success"} <= flags
    assert result[ip]["risk_level"] == "HIGH"


def test_malware_hash_is_high_risk(tmp_path):
    store = SQLiteStore(db_path=str(tmp_path / "corr_mw.db"))
    h = "44d88612fea8a8f36de82e1278abb02f"
    store.store_log_chunk("c1", "u1", "f.log", f"malware hash {h} detected on host")
    store.store_ioc(h, "hash", "c1")

    result = correlate_iocs({"hashes": [h]}, store)
    assert result[h]["category"] == "MALWARE"
    assert result[h]["risk_level"] == "HIGH"


def test_outbound_destination_classified_as_c2(tmp_path):
    store = SQLiteStore(db_path=str(tmp_path / "corr_c2.db"))
    ip = "198.51.100.23"
    store.store_log_chunk("c1", "u1", "f.log", f"outbound connection to {ip} exfil beacon")
    store.store_ioc(ip, "ip", "c1")

    result = correlate_iocs({"ips": [ip]}, store)
    assert result[ip]["category"] == "C2_IP"
    assert result[ip]["risk_level"] == "HIGH"


def test_domain_indicator_categorized(tmp_path):
    store = SQLiteStore(db_path=str(tmp_path / "corr_dom.db"))
    d = "evil-domain.example"
    store.store_log_chunk("c1", "u1", "f.log", f"beacon callback to {d} observed")
    store.store_ioc(d, "domain", "c1")

    result = correlate_iocs({"domains": [d]}, store)
    assert result[d]["category"] == "DOMAIN"


def test_no_input_iocs_returns_empty(tmp_path):
    store = SQLiteStore(db_path=str(tmp_path / "corr3.db"))
    assert correlate_iocs({"ips": []}, store) == {}
