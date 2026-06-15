import re
import traceback
from datetime import datetime
from intelligence.mitre_mapper import map_to_mitre

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
        print(f"Error in extract_timestamps: {e}")
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
            "TA0043": 1, "TA0001": 2, "TA0002": 3, "TA0003": 4, 
            "TA0004": 5, "TA0006": 6, "TA0008": 7, "TA0010": 8
        }
        
        for e in events:
            line = e["raw_line"]
            mitre_match = map_to_mitre(line)
            technique = mitre_match[0]["technique"] if mitre_match else "None"
            tactic = mitre_match[0]["tactic"] if mitre_match else "Unknown"
            confidence = mitre_match[0].get("confidence", "LOW") if mitre_match else "LOW"
            phase = mitre_match[0].get("phase", "") if mitre_match else ""
            
            ts = e["timestamp"]
            # Time bucket: group by minute -> YYYY-MM-DD HH:MM
            time_bucket = ts[:16] if len(ts) >= 16 else ts
            
            desc_lower = e["event"].lower()
            if any(k in desc_lower for k in ["malware", "ransomware", "trojan", "virus"]):
                tactic = "EXECUTION"
                technique = "T1204"
                phase = "TA0002"
            elif any(k in desc_lower for k in ["backdoor", "rootkit", "persistence"]):
                tactic = "PERSISTENCE"
                technique = "T1547"
                phase = "TA0003"
            elif "firewall deny" in desc_lower or "firewall block" in desc_lower or ("deny" in desc_lower and "port" in desc_lower):
                tactic = "RECONNAISSANCE"
                technique = "T1046"
                phase = "TA0043"
                confidence = "LOW"
            
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
        
        print("\n=== TIMELINE DEBUG ===")
        for t in timeline:
            print(t["timestamp"], t["event_type"])
        
        return timeline
    except Exception as e:
        print(f"Error in generate_timeline: {e}")
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
        print(f"Error in format_timeline_string: {e}")
        traceback.print_exc()
        return "Error formatting timeline."
