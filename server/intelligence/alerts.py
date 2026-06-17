"""Alert derivation (Week 4D, Phase 1).

Pure functions that turn the analysis outputs the upload pipeline already
produces (timeline events, MITRE matches, correlation map) into alert records.
No DB, no Flask, no recomputation — callers pass in what they already have and
persist the result via SQLiteStore.store_alert.
"""
import logging

logger = logging.getLogger(__name__)


def build_alerts(timeline_events=None, mitre_matches=None, correlations=None,
                 source=None, upload_id=None):
    """Derive alert records from existing analysis outputs.

    Sources: HIGH-severity timeline events, HIGH-confidence MITRE techniques,
    HIGH-risk IOC correlations, and brute-force-success patterns (correlation
    context_flags containing both 'fail' and 'success'). Returns a list of
    dicts shaped for SQLiteStore.store_alert. Deduped to avoid storms.
    """
    timeline_events = timeline_events or []
    mitre_matches = mitre_matches or []
    correlations = correlations or {}
    alerts = []

    def add(severity, alert_type, title, ioc_value=None, technique_id=None, details=None):
        alerts.append({
            "severity": severity,
            "alert_type": alert_type,
            "title": title,
            "ioc_value": ioc_value,
            "technique_id": technique_id,
            "source": source,
            "upload_id": upload_id,
            "details": details or {},
        })

    # HIGH-severity timeline events (dedup by timestamp+type+technique)
    seen_tl = set()
    for ev in timeline_events:
        if str(ev.get("severity", "")).upper() != "HIGH":
            continue
        key = (ev.get("timestamp"), ev.get("event_type"), ev.get("mitre_technique"))
        if key in seen_tl:
            continue
        seen_tl.add(key)
        add(
            "HIGH", "TIMELINE_HIGH_SEVERITY",
            ("%s: %s" % (ev.get("event_type", "EVENT"), ev.get("description", "")))[:160],
            technique_id=ev.get("mitre_technique"),
            details={"timestamp": ev.get("timestamp"), "event_type": ev.get("event_type"),
                     "description": ev.get("description")},
        )

    # HIGH-confidence MITRE techniques (dedup by technique id)
    seen_tech = set()
    for m in mitre_matches:
        if str(m.get("confidence", "")).upper() != "HIGH":
            continue
        tech = m.get("technique")
        if not tech or tech in seen_tech:
            continue
        seen_tech.add(tech)
        add(
            "HIGH", "HIGH_CONF_TECHNIQUE",
            ("%s %s (HIGH confidence)" % (tech, m.get("name", ""))).strip(),
            technique_id=tech,
            details={"tactic": m.get("tactic"), "name": m.get("name"), "evidence": m.get("evidence", [])},
        )

    # Correlation-derived IOC alerts. Brute-force success (CRITICAL) supersedes
    # the HIGH-risk alert for the same IOC so we don't double-fire.
    for ioc_value, d in correlations.items():
        flags = d.get("context_flags", []) or []
        category = d.get("category", "IOC")
        if "fail" in flags and "success" in flags:
            add(
                "CRITICAL", "BRUTE_FORCE_SUCCESS",
                "Brute-force success involving %s" % ioc_value,
                ioc_value=ioc_value,
                details={"category": category, "risk_level": d.get("risk_level"), "context_flags": flags},
            )
        elif str(d.get("risk_level", "")).upper() == "HIGH":
            add(
                "HIGH", "HIGH_RISK_IOC",
                "High-risk %s: %s" % (category, ioc_value),
                ioc_value=ioc_value,
                details={"category": category, "role": d.get("role"), "frequency": d.get("frequency")},
            )

    return alerts
