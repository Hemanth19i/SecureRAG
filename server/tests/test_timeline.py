"""Unit tests for intelligence.timeline_gen.generate_timeline."""
from intelligence.mitre_mapper import map_to_mitre
from intelligence.timeline_gen import generate_timeline


def test_events_are_sorted_chronologically_from_unordered_input():
    # Deliberately out of order (later timestamp first).
    text = (
        "2026-06-15 05:00:00 outbound 250 MB transferred to host\n"
        "2026-06-15 02:00:00 Failed password for admin from 203.0.113.45\n"
        "2026-06-15 03:30:00 CVE-2021-44228 exploit attempt\n"
    )
    timeline = generate_timeline(text, map_to_mitre(text))
    timestamps = [e["timestamp"] for e in timeline if e["timestamp"] != "T+unknown"]
    assert timestamps == sorted(timestamps)
    assert timestamps[0].startswith("2026-06-15 02:00:00")


def test_each_event_has_contract_keys():
    text = "2026-06-15 02:00:00 Failed password for admin from 203.0.113.45"
    for ev in generate_timeline(text, []):
        for key in ("timestamp", "event_type", "description", "mitre_technique",
                    "severity", "phase_order"):
            assert key in ev, f"missing {key}"


def test_text_without_timestamps_yields_unknown_marker():
    timeline = generate_timeline("Failed password for admin", map_to_mitre("Failed password for admin"))
    assert timeline
    assert timeline[0]["timestamp"] == "T+unknown"


def test_empty_text_yields_single_unknown_placeholder():
    # No timestamps (incl. empty input) -> the "no events" branch emits one
    # T+unknown placeholder rather than an empty list.
    tl = generate_timeline("", [])
    assert len(tl) == 1
    assert tl[0]["timestamp"] == "T+unknown"
    assert tl[0]["mitre_technique"] == "None"
