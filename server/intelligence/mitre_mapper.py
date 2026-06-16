import re
import logging
import traceback

logger = logging.getLogger(__name__)

MITRE_PATTERNS = {
    r"brute force|auth fail|password fail|login fail|failed password": {
        "tactic": "Credential Access", "technique": "T1110",
        "name": "Brute Force", "phase": "TA0006"
    },
    r"accepted password for|authentication success|login success|valid account|logon success": {
        "tactic": "Initial Access", "technique": "T1078",
        "name": "Valid Accounts", "phase": "TA0001"
    },
    r"outbound|egress|bytes transferred": {
        "tactic": "Exfiltration", "technique": "T1041",
        "name": "Suspicious Outbound Communication", "phase": "TA0010"
    },
    r"CVE|vulnerability|exploit": {
        "tactic": "Execution", "technique": "T1203",
        "name": "Exploitation for Client Execution", "phase": "TA0002"
    },
    r"privilege|escalat|sudo|su\s|root shell|UAC": {
        "tactic": "Privilege Escalation", "technique": "T1068",
        "name": "Exploitation for Privilege Escalation", "phase": "TA0004"
    },
    r"lateral|pivot|internal scan|smb|rdp to internal": {
        "tactic": "Lateral Movement", "technique": "T1021",
        "name": "Remote Services", "phase": "TA0008"
    },
    r"recon|scan|nmap|port scan": {
        "tactic": "Discovery", "technique": "T1046",
        "name": "Network Service Discovery", "phase": "TA0007"
    },
    r"persistence|backdoor|cron|startup": {
        "tactic": "Persistence", "technique": "T1053",
        "name": "Scheduled Task", "phase": "TA0003"
    },
    # Consolidated from timeline-only logic — MITRE_PATTERNS is the single
    # source of truth for technique classification.
    r"malware|ransomware|trojan|virus": {
        "tactic": "Execution", "technique": "T1204",
        "name": "User Execution", "phase": "TA0002"
    },
    r"backdoor|rootkit|persistence": {
        "tactic": "Persistence", "technique": "T1547",
        "name": "Boot or Logon Autostart Execution", "phase": "TA0003"
    }
}

def map_to_mitre(text: str) -> list[dict]:
    try:
        if not text:
            return []
            
        results = []
        matched_techniques = set()
        
        for pattern, mapping in MITRE_PATTERNS.items():
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                distinct_matches = list(set([m.lower().strip() for m in matches]))
                match_count = len(distinct_matches)
                
                tech_id = mapping["technique"]
                if tech_id not in matched_techniques:
                    result = mapping.copy()
                    result["evidence"] = distinct_matches
                    result["inferred"] = False
                    result["note"] = ""
                    
                    if tech_id == "T1110":
                        if match_count >= 3:
                            confidence = "HIGH"
                        elif match_count == 2:
                            confidence = "MEDIUM"
                        else:
                            confidence = "LOW"
                            result["inferred"] = True
                            
                    elif tech_id == "T1078":
                        confidence = "MEDIUM"
                        
                    elif tech_id == "T1041":
                        bytes_match = re.search(r'(\d+)\s*(?:KB|MB|GB|B|bytes)', text, re.IGNORECASE)
                        has_large_bytes = False
                        if bytes_match:
                            try:
                                val = int(bytes_match.group(1))
                                if 'MB' in bytes_match.group(0).upper() or 'GB' in bytes_match.group(0).upper():
                                    has_large_bytes = True
                                elif 'KB' in bytes_match.group(0).upper() and val > 50:
                                    has_large_bytes = True
                                elif val > 50000:
                                    has_large_bytes = True
                            except:
                                pass
                                
                        if has_large_bytes:
                            result["name"] = "Possible Data Exfiltration"
                            confidence = "MEDIUM"
                            result["note"] = "Large outbound transfer detected. Verify if authorized."
                        else:
                            result["name"] = "Suspicious Outbound Communication"
                            confidence = "LOW"
                            result["note"] = "Normal-looking traffic. Could be C2 beaconing."
                            result["inferred"] = True
                            
                    elif tech_id == "T1203":
                        confidence = "LOW"
                        result["note"] = "CVE presence != exploitation. Verify patch status."
                        result["inferred"] = True
                        
                    elif tech_id == "T1068":
                        confidence = "HIGH" if match_count >= 3 else ("MEDIUM" if match_count >= 1 else "LOW")
                        
                    elif tech_id == "T1021":
                        confidence = "HIGH" if match_count >= 3 else ("MEDIUM" if match_count >= 2 else "LOW")
                    else:
                        confidence = "HIGH" if match_count >= 3 else ("MEDIUM" if match_count >= 2 else "LOW")
                        
                    if confidence == "LOW":
                        result["inferred"] = True
                        
                    result["confidence"] = confidence
                    results.append(result)
                    matched_techniques.add(tech_id)
                    
        return results
    except Exception as e:
        logger.error("Error in map_to_mitre: %s", e)
        traceback.print_exc()
        return []

def build_kill_chain(mitre_results: list) -> list[dict]:
    try:
        phase_order = {
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
        return sorted(mitre_results, key=lambda x: phase_order.get(x.get("phase", ""), 99))
    except Exception as e:
        logger.error("Error in build_kill_chain: %s", e)
        traceback.print_exc()
        return []
