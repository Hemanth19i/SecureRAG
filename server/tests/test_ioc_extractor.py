"""Unit tests for intelligence.ioc_extractor.extract_iocs."""
from intelligence.ioc_extractor import extract_iocs


def test_extracts_each_ioc_type():
    text = (
        "src 203.0.113.45 reached host db01.corp.example over fe80::1ff:fe23:4567:890a\n"
        "md5 44d88612fea8a8f36de82e1278abb02f sha1 da39a3ee5e6b4b0d3255bfef95601890afd80709\n"
        "sha256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\n"
        "CVE-2021-44228 reported; mail to analyst@corp.example; ref http://evil.example/payload\n"
    )
    iocs = extract_iocs(text)

    assert "203.0.113.45" in iocs["ips"]
    assert "db01.corp.example" in iocs["domains"]
    assert "44d88612fea8a8f36de82e1278abb02f" in iocs["hashes"]
    assert "da39a3ee5e6b4b0d3255bfef95601890afd80709" in iocs["hashes"]
    assert "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" in iocs["hashes"]
    assert "CVE-2021-44228" in iocs["cves"]
    assert "analyst@corp.example" in iocs["emails"]
    assert any("evil.example/payload" in u for u in iocs["urls"])
    assert "fe80::1ff:fe23:4567:890a" in iocs["ipv6"]


def test_keys_are_exactly_the_seven_contract_keys():
    iocs = extract_iocs("nothing here")
    assert set(iocs) == {"ips", "domains", "hashes", "cves", "emails", "ipv6", "urls"}
    assert all(isinstance(v, list) for v in iocs.values())


def test_dedup_repeated_indicator():
    text = "203.0.113.45 again 203.0.113.45 and once more 203.0.113.45"
    assert extract_iocs(text)["ips"].count("203.0.113.45") == 1


def test_refangs_defanged_indicators():
    iocs = extract_iocs("attacker 1.2.3[.]4 contacted hxxp://evil[.]com/c2")
    assert "1.2.3.4" in iocs["ips"]
    assert any("evil.com/c2" in u for u in iocs["urls"])


def test_invalid_ip_octets_rejected():
    assert "999.999.999.999" not in extract_iocs("999.999.999.999")["ips"]


def test_filenames_not_treated_as_domains():
    domains = extract_iocs("opened auth.log and payload.bin")["domains"]
    assert "auth.log" not in domains
    assert "payload.bin" not in domains


def test_empty_text_returns_empty_lists():
    iocs = extract_iocs("")
    assert all(iocs[k] == [] for k in iocs)
