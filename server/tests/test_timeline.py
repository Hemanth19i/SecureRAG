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


def test_timestamped_document_still_produces_ordered_events():
    # Proves only the empty path changed: a timestamped doc still yields a
    # non-empty, chronologically ordered timeline.
    text = (
        "2026-06-15 02:00:00 Failed password for admin from 203.0.113.45\n"
        "2026-06-15 02:05:00 Accepted password for admin from 203.0.113.45\n"
    )
    events = generate_timeline(text, map_to_mitre(text))
    assert len(events) >= 1
    timestamps = [e["timestamp"] for e in events]
    assert timestamps == sorted(timestamps)


def test_text_without_timestamps_returns_empty():
    # Content but no parseable timestamps -> empty timeline (no T+unknown event).
    text = "Failed password for admin"
    assert generate_timeline(text, map_to_mitre(text)) == []


def test_empty_text_returns_empty():
    assert generate_timeline("", []) == []
