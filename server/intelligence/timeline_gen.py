import re
import logging
import traceback
from datetime import datetime
from intelligence.mitre_mapper import map_to_mitre

logger = logging.getLogger(__name__)

def extract_timestamps(text: str) -> list[dict]:
    try:
        if not text:
            return []
            
        pattern1 = r'\b(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\b'
        pattern2 = r'\b(\d{2}:\d{2}:\d{2})\b'
        pattern3 = r'\b(\d{2}/[A-Z][a-z]{2}/\d{4}:\d{2}:\d{2}:\d{2})\b'
        
        lines = text.split('\n')
        events = []
        
        for line in lines:
            if not line.strip():
                continue
                
            timestamp = None
            m1 = re.search(pattern1, line)
            m3 = re.search(pattern3, line)
            m2 = re.search(pattern2, line)
            
            if m1:
                timestamp = m1.group(1)
            elif m3:
                timestamp = m3.group(1)
            elif m2:
                timestamp = m2.group(1)
                
            if timestamp:
                event_desc = line.replace(timestamp, "").strip()
                event_desc = re.sub(r'^[\]\-\:\s]+', '', event_desc)
                
                events.append({
                    "timestamp": timestamp,
                    "event": event_desc or line.strip(),
                    "raw_line": line.strip()
                })
        
        return events
    except Exception as e:
        logger.error("Error in extract_timestamps: %s", e)
        traceback.print_exc()
        return []
def parse_ts(ts):
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%d/%b/%Y:%H:%M:%S",
        "%H:%M:%S"
    ]
    for fmt in formats:
        try:
            return datetime.strptime(ts, fmt)
        except ValueError:
            continue
    return None

def normalize_timestamp(ts):
    """Canonicalise a recognised timestamp to 'YYYY-MM-DD HH:MM:SS'.

    Dated formats (ISO and Apache) are normalised to one canonical form so the
    stored and returned timelines agree. Time-only logs (which parse to a 1900
    placeholder date) and the 'T+unknown' marker are passed through unchanged so
    no fabricated dates enter the timeline.
    """
    if not ts or ts == "T+unknown":
        return ts
    dt = parse_ts(ts)
    if dt is None or dt.year == 1900:
        return ts
    return dt.strftime("%Y-%m-%d %H:%M:%S")

def generate_timeline(log_text: str, mitre_results: list) -> list[dict]:
    try:
        events = extract_timestamps(log_text)
        timeline = []
        
        if not events:
            mitre_match = map_to_mitre(log_text)
            technique = mitre_match[0]["technique"] if mitre_match else "None"
            tactic = mitre_match[0]["tactic"] if mitre_match else "Unknown"
            desc = log_text.strip()[:100] + ("..." if len(log_text.strip()) > 100 else "")
            
            timeline.append({
                "timestamp": "T+unknown",
                "event_type": tactic.upper(),
                "description": desc,
                "mitre_technique": technique,
                "severity": mitre_match[0].get("confidence", "UNKNOWN") if mitre_match else "UNKNOWN",
                "count": 1,
                "phase_order": 99
            })


        # Deduplication mapping by minute bucket
        seen = {}
        
        # TA phase order mapping for final kill chain sort
        phase_order_map = {
            "TA0043": 1,   # Reconnaissance
            "TA0042": 2,   # Resource Development
            "TA0001": 3,   # Initial Access
            "TA0002": 4,   # Execution
            "TA0003": 5,   # Persistence
            "TA0004": 6,   # Privilege Escalation
            "TA0005": 7,   # Defense Evasion
            "TA0006": 8,   # Credential Access
            "TA0007": 9,   # Discovery
            "TA0008": 10,  # Lateral Movement
            "TA0009": 11,  # Collection
            "TA0011": 12,  # Command and Control
            "TA0010": 13,  # Exfiltration
            "TA0040": 14,  # Impact
        }
        
        for e in events:
            line = e["raw_line"]
            mitre_match = map_to_mitre(line)
            technique = mitre_match[0]["technique"] if mitre_match else "None"
            tactic = mitre_match[0]["tactic"] if mitre_match else "Unknown"
            confidence = mitre_match[0].get("confidence", "LOW") if mitre_match else "LOW"
            phase = mitre_match[0].get("phase", "") if mitre_match else ""
            
            ts = normalize_timestamp(e["timestamp"])
            # Time bucket: group by minute -> YYYY-MM-DD HH:MM
            time_bucket = ts[:16] if len(ts) >= 16 else ts
            
            # Technique classification comes solely from map_to_mitre above —
            # mitre_mapper.MITRE_PATTERNS is the single source of truth.
            key = (tactic.upper(), technique)
            bucket_key = (key, time_bucket)
            
            if bucket_key not in seen:
                seen[bucket_key] = {
                    "timestamp": ts,
                    "event_type": tactic.upper(),
                    "description": e["event"],
                    "mitre_technique": technique,
                    "severity": confidence,
                    "count": 1,
                    "descriptions": [e["event"]],
                    "phase_order": phase_order_map.get(phase, 99)
                }
            else:
                seen[bucket_key]['count'] += 1
                seen[bucket_key]['descriptions'].append(e["event"])
                
        # Group summary
        for bucket_key, ev in seen.items():
            count = ev["count"]
            if count > 1:
                ips = set()
                users = set()
                for d in ev["descriptions"]:
                    ip_match = re.search(r'\b\d{1,3}(?:\.\d{1,3}){3}\b', d)
                    if ip_match:
                        ips.add(ip_match.group(0))
                        
                    user_match = re.search(r'(?:user=|user\s+|for\s+)([a-zA-Z0-9_]+)', d, re.IGNORECASE)
                    if user_match:
                        u = user_match.group(1)
                        if u.lower() not in ('invalid', 'from', 'user'):
                            users.add(u)
                            
                first_desc = ev["descriptions"][0]
                clean_desc = re.sub(r'\b\d{1,3}(?:\.\d{1,3}){3}\b', '', first_desc)
                clean_desc = re.sub(r'(?:user=|user\s+|for\s+)([a-zA-Z0-9_]+)', '', clean_desc, flags=re.IGNORECASE)
                clean_desc = re.sub(r'from\s+', '', clean_desc, flags=re.IGNORECASE)
                clean_desc = re.sub(r'from=', '', clean_desc, flags=re.IGNORECASE)
                clean_desc = ' '.join(clean_desc.split()).strip()
                
                if len(clean_desc) > 3:
                    summary = f"{clean_desc} x{count}"
                else:
                    summary = f"{first_desc} x{count}"
                    
                if ips:
                    summary += f" from {', '.join(ips)}"
                if users:
                    summary += f" (users: {', '.join(users)})"
                    
                ev["description"] = summary
                
            if ev["event_type"] == "CREDENTIAL ACCESS" and count >= 5:
                ev["severity"] = "HIGH"
            elif ev["event_type"] in ("INITIAL ACCESS", "EXECUTION"):
                ev["severity"] = "HIGH"
            elif ev["event_type"] == "EXFILTRATION" and ev["severity"] in ("HIGH", "MEDIUM"):
                ev["severity"] = "HIGH"
            elif ev["event_type"] == "CREDENTIAL ACCESS" and count >= 2:
                ev["severity"] = "MEDIUM"
            elif ev["severity"] == "UNKNOWN":
                ev["severity"] = "LOW"
                    
            timeline.append({
                "timestamp": ev["timestamp"],
                "event_type": ev["event_type"],
                "description": ev["description"],
                "mitre_technique": ev["mitre_technique"],
                "severity": ev["severity"],
                "phase_order": ev["phase_order"]
            })
            
        # Final timeline order must follow kill chain
        timeline.sort(key=lambda x: parse_ts(x["timestamp"]) or datetime.min)
        
        logger.debug("=== TIMELINE DEBUG ===")
        for t in timeline:
            logger.debug("%s %s", t["timestamp"], t["event_type"])

        return timeline
    except Exception as e:
        logger.error("Error in generate_timeline: %s", e)
        traceback.print_exc()
        return []

def format_timeline_string(timeline: list) -> str:
    try:
        if not timeline:
            return "No timeline events found."
            
        result = []
        first_dt = None
        
            
        for item in timeline:
            ts_str = item["timestamp"]
            if ts_str == "T+unknown":
                note = ""
                if item.get("severity") == "LOW":
                    note = " - unconfirmed"
                result.append(f"T+unknown  [{item['event_type']}] {item['description']} -> {item['mitre_technique']} ({item['severity']}{note})")
                continue
                
            dt = parse_ts(ts_str)
            if dt:
                if first_dt is None:
                    first_dt = dt
                    rel_time = 0
                else:
                    diff = dt - first_dt
                    rel_time = int(diff.total_seconds() / 60)
                time_str = f"T+{rel_time}min"
            else:
                time_str = "T+unknown"
                
            note = ""
            if item.get("severity") == "LOW":
                note = " - unconfirmed"
                
            result.append(f"{time_str}  [{item['event_type']}] {item['description']} -> {item['mitre_technique']} ({item['severity']}{note})")
            
        return "\n".join(result)
    except Exception as e:
        logger.error("Error in format_timeline_string: %s", e)
        traceback.print_exc()
        return "Error formatting timeline."
