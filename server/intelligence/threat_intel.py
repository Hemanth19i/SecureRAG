"""Threat-intelligence enrichment (Week 4C, Phase 1).

Phase 1 scope: AbuseIPDB reputation for IP addresses only, behind a cache-first
layer with TTL and negative caching. Mirrors gemini_analyzer's posture: read the
API key from the environment and degrade gracefully (never raise) when the key
is missing, the provider fails, or the IOC type is unsupported.

Enrichment is an independent overlay on top of correlation — it does not read or
mutate global_correlations, the attack graph, or case data.
"""
import os
import json
import logging
import ipaddress
import urllib.parse
import urllib.request
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

ABUSEIPDB_API_KEY = os.getenv("ABUSEIPDB_API_KEY")
ABUSEIPDB_URL = "https://api.abuseipdb.com/api/v2/check"

# TTLs (seconds). Successful lookups cache for a day; failures/unsupported/
# missing-key results get a short negative-cache window so we don't hammer the
# provider but still retry reasonably soon.
OK_TTL = int(os.getenv("ENRICH_TTL_SECONDS", "86400"))
NEG_TTL = int(os.getenv("ENRICH_NEG_TTL_SECONDS", "3600"))


def classify_ioc(value):
    """Return 'ip', 'ipv6', or 'unsupported' (Phase 1 enriches IPs only)."""
    v = (value or "").strip()
    try:
        return "ipv6" if ipaddress.ip_address(v).version == 6 else "ip"
    except ValueError:
        return "unsupported"


def _verdict(score):
    """Map an abuse-confidence score (0-100) to a verdict bucket."""
    if score is None:
        return "UNKNOWN"
    if score >= 75:
        return "MALICIOUS"
    if score >= 40:
        return "SUSPICIOUS"
    return "CLEAN"


def _result(value, itype, source=None, abuse=None, data=None, status="ok"):
    """Build the unified enrichment record. verdict is only meaningful for ok."""
    return {
        "ioc_value": value,
        "ioc_type": itype,
        "source": source,
        "reputation_score": abuse,
        "abuse_confidence": abuse,
        "verdict": _verdict(abuse) if status == "ok" else "UNKNOWN",
        "enrichment_data": data or {},
        "status": status,
    }


def enrich_ip(value, itype="ip"):
    """Query AbuseIPDB for one IP. Returns a normalized record; never raises.
    status: 'ok' | 'unavailable' (no key) | 'error' (provider failure)."""
    if not ABUSEIPDB_API_KEY:
        logger.warning("ABUSEIPDB_API_KEY not configured; returning 'unavailable'.")
        return _result(value, itype, status="unavailable")
    try:
        url = ABUSEIPDB_URL + "?" + urllib.parse.urlencode({"ipAddress": value, "maxAgeInDays": 90})
        req = urllib.request.Request(url, headers={"Key": ABUSEIPDB_API_KEY, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:  # nosec B310 - fixed https AbuseIPDB endpoint; only query string varies
            payload = json.loads(resp.read().decode("utf-8"))
        d = payload.get("data", {}) or {}
        abuse = int(d.get("abuseConfidenceScore", 0) or 0)
        data = {
            "country_code": d.get("countryCode"),
            "isp": d.get("isp"),
            "domain": d.get("domain"),
            "usage_type": d.get("usageType"),
            "total_reports": d.get("totalReports"),
            "last_reported_at": d.get("lastReportedAt"),
            "is_tor": d.get("isTor"),
        }
        return _result(value, itype, source="abuseipdb", abuse=abuse, data=data, status="ok")
    except Exception as e:
        logger.error("AbuseIPDB lookup failed for %s: %s", value, e)
        return _result(value, itype, status="error")


def get_enrichment(sqlite_store, value, force=False):
    """Cache-first enrichment. Serves a fresh cached record unless force=True;
    otherwise fetches, caches (with an appropriate TTL), and returns the stored
    canonical record. Adds a 'cached' flag. Never raises for normal flows."""
    value = (value or "").strip()
    if not value:
        rec = _result(value, "unsupported", status="unsupported")
        rec["cached"] = False
        return rec

    cached = sqlite_store.get_ioc_enrichment(value)
    if cached and not force and not cached.get("expired"):
        cached["cached"] = True
        return cached

    itype = classify_ioc(value)
    if itype not in ("ip", "ipv6"):
        record = _result(value, "unsupported", status="unsupported")
        ttl = NEG_TTL
    else:
        record = enrich_ip(value, itype)
        ttl = OK_TTL if record["status"] == "ok" else NEG_TTL

    sqlite_store.store_ioc_enrichment(record, ttl)
    stored = sqlite_store.get_ioc_enrichment(value)
    if stored:
        stored["cached"] = False
        return stored
    record["cached"] = False
    return record
