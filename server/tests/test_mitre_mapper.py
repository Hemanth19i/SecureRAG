"""Unit tests for intelligence.mitre_mapper."""
from intelligence.mitre_mapper import map_to_mitre, build_kill_chain


def _by_id(results):
    return {r["technique"]: r for r in results}


def test_brute_force_three_distinct_signals_is_high_confidence():
    # Confidence scales with the number of DISTINCT matched phrases, not raw
    # occurrences: 3 distinct brute-force signals -> HIGH.
    text = (
        "Failed password for admin\n"
        "brute force detected\n"
        "auth fail from host\n"
    )
    results = _by_id(map_to_mitre(text))
    assert "T1110" in results
    t = results["T1110"]
    assert t["confidence"] == "HIGH"
    assert t["tactic"] == "Credential Access"
    assert t["phase"] == "TA0006"
    assert isinstance(t["evidence"], list) and t["evidence"]


def test_brute_force_two_distinct_signals_is_medium_confidence():
    text = "Failed password for admin\nauth fail from host"
    results = _by_id(map_to_mitre(text))
    assert results["T1110"]["confidence"] == "MEDIUM"


def test_cve_maps_to_exploitation():
    results = _by_id(map_to_mitre("CVE-2021-44228 exploit attempt"))
    assert "T1203" in results
    assert results["T1203"]["tactic"] == "Execution"


def test_every_item_has_contract_keys():
    results = map_to_mitre("Failed password; CVE-2021-1; outbound 250 MB transferred")
    assert results
    for r in results:
        for key in ("tactic", "technique", "name", "phase", "evidence",
                    "inferred", "note", "confidence"):
            assert key in r, f"missing {key}"


def test_kill_chain_orders_by_phase():
    # Exfiltration (TA0010) appears in text before Initial Access (TA0001);
    # the kill chain must still order Initial Access earlier.
    text = "outbound bytes transferred\naccepted password for admin"
    chain = build_kill_chain(map_to_mitre(text))
    phases = [c["phase"] for c in chain]
    from intelligence.mitre_mapper import PHASE_ORDER
    orders = [PHASE_ORDER.get(p, 99) for p in phases]
    assert orders == sorted(orders)


def test_empty_text_returns_empty_list():
    assert map_to_mitre("") == []
