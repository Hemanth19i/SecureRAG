import re
import logging
import traceback
from datetime import datetime
from intelligence.ioc_extractor import extract_iocs

logger = logging.getLogger(__name__)

def is_private_ip(ip: str) -> bool:
    if ip.startswith("10.") or ip.startswith("192.168.") or ip.startswith("127."):
        return True
    if ip.startswith("172."):
        try:
            second_octet = int(ip.split(".")[1])
            if 16 <= second_octet <= 31:
                return True
        except:
            pass
    return False

def correlate_iocs(iocs: dict, sqlite_store) -> dict:
    try:
        all_input_iocs = []

        for ioc_type, ioc_list in iocs.items():
            if ioc_type == "hashes":
                t = "hash"
            elif ioc_type == "cves":
                t = "cve"
            elif ioc_type == "error":
                continue
            else:
                t = ioc_type.rstrip("s")

            for ioc_value in ioc_list:
                all_input_iocs.append((t, ioc_value))

        ioc_map = {}

        if not all_input_iocs:
            return {}
            
        logger.debug("Target IOCs to correlate: %s", len(all_input_iocs))

        conn = sqlite_store.get_connection()
        cursor = conn.cursor()

        ioc_values = [val for _, val in all_input_iocs]
        ioc_types = [t for t, _ in all_input_iocs]
        
        placeholders = ','.join(['?'] * len(all_input_iocs))
        query = f"""
            SELECT DISTINCT m.chunk_id
            FROM chunk_ioc_mapping m
            JOIN extracted_iocs e ON m.ioc_value = e.ioc_value
            WHERE e.ioc_value IN ({placeholders})
            AND e.ioc_type IN ({placeholders})
        """
        cursor.execute(query, ioc_values + ioc_types)
        chunk_ids = [row[0] for row in cursor.fetchall()]
        
        if not chunk_ids:
            conn.close()
            return {}
            
        logger.debug("Fetched %s related chunks from SQLite.", len(chunk_ids))
        
        placeholders_chunks = ','.join(['?'] * len(chunk_ids))
        cursor.execute(f"SELECT chunk_id, raw_text, source_file, timestamp_ingested FROM log_chunks WHERE chunk_id IN ({placeholders_chunks})", chunk_ids)
        rows = cursor.fetchall()
        
        documents = [row['raw_text'] for row in rows]
        metadatas = [{"source_file": row['source_file'], "timestamp": row['timestamp_ingested']} for row in rows]
        
        conn.close()



        for doc, meta in zip(documents, metadatas):
            source_file = meta.get("source_file", "unknown")
            chunk_timestamp = meta.get("timestamp", "unknown")

            lines = doc.split('\n')
            
            for line in lines:
                line_lower = line.lower()
                
                for ioc_type, ioc_value in all_input_iocs:
                    if ioc_value not in line:
                        continue

                    if ioc_value not in ioc_map:
                        display_type = ioc_type
                        role = "OBSERVED"
                        
                        if ioc_type == "hash":
                            display_type = "MALWARE HASH"
                            role = "MALWARE"
                        elif ioc_type == "cve":
                            display_type = "CVE"
                            role = "VULNERABILITY"
                        elif ioc_type == "domain":
                            display_type = "DOMAIN"
                            role = "DOMAIN"
                        elif ioc_type == "email":
                            display_type = "EMAIL"
                            role = "EMAIL"
                        elif ioc_type == "ip":
                            display_type = "IP"
                            if is_private_ip(ioc_value):
                                role = "INTERNAL_HOST"

                        ioc_map[ioc_value] = {
                            "type": display_type,
                            "role": role,
                            "seen_in_files": set(),
                            "frequency": 0,
                            "first_seen": chunk_timestamp,
                            "last_seen": chunk_timestamp,
                            "context_flags": set()
                        }
                    
                    # Update context and role based on line proximity
                    if ioc_type == "ip":
                        is_priv = is_private_ip(ioc_value)
                        
                        role_precedence = {
                            "ATTACKER_IP": 4,
                            "C2_IP": 3,
                            "DESTINATION_IP": 2,
                            "INTERNAL_HOST": 1,
                            "OBSERVED": 0
                        }
                        
                        current_role = ioc_map[ioc_value].get("role", "OBSERVED")
                        new_role = current_role
                        
                        # Destination IP context
                        if re.search(rf"(?:to|->|dest(?:ination)?|=|>\s*){re.escape(ioc_value)}", line_lower) or "outbound" in line_lower:
                            if not is_priv:
                                new_role = "DESTINATION_IP"
                                if "outbound" in line_lower or "exfil" in line_lower:
                                    ioc_map[ioc_value]["context_flags"].add("outbound")
                                    new_role = "C2_IP"
                        
                        # Source IP context
                        if re.search(rf"(?:from|src|source|<|user=)\s*{re.escape(ioc_value)}", line_lower) or "auth" in line_lower or "brute" in line_lower:
                            if not is_priv:
                                new_role = "ATTACKER_IP"
                            
                            # Success/Fail flags only apply to authentication-related source IPs
                            if any(k in line_lower for k in ["fail", "brute", "invalid"]):
                                ioc_map[ioc_value]["context_flags"].add("fail")
                            if "success" in line_lower or "accepted password" in line_lower:
                                ioc_map[ioc_value]["context_flags"].add("success")
                                
                        # Enforce precedence
                        if role_precedence.get(new_role, 0) > role_precedence.get(current_role, 0):
                            ioc_map[ioc_value]["role"] = new_role
                                
                        # Fallback for internal IPs doing auth
                        if is_priv and ("auth" in line_lower or "login" in line_lower):
                            if any(k in line_lower for k in ["fail", "brute", "invalid"]):
                                ioc_map[ioc_value]["context_flags"].add("fail")
                            if "success" in line_lower or "accepted password" in line_lower:
                                ioc_map[ioc_value]["context_flags"].add("success")

                    ioc_map[ioc_value]["seen_in_files"].add(source_file)
                    ioc_map[ioc_value]["frequency"] += 1
                    ioc_map[ioc_value]["last_seen"] = chunk_timestamp

        # Step 4: Convert sets to lists, calculate risk
        result = {}
        for ioc_value, data in ioc_map.items():
            files = list(data["seen_in_files"])
            freq = data["frequency"]
            flags = list(data["context_flags"])
            role = data["role"]
            
            is_brute_force_success = ("fail" in flags and "success" in flags)
            category = role
            risk = "LOW"
            
            if role == "MALWARE":
                category = "MALWARE"
                risk = "HIGH"
            elif role == "VULNERABILITY":
                category = "VULNERABILITY"
                risk = "HIGH" if freq > 5 or len(files) >= 2 else "MEDIUM"
            elif role == "INTERNAL_HOST":
                category = "INTERNAL_HOST"
                if is_brute_force_success:
                    risk = "HIGH"
                else:
                    risk = "LOW"
            elif role == "C2_IP":
                category = "C2_IP"
                risk = "HIGH"
            elif role == "DESTINATION_IP":
                category = "DESTINATION_IP"
                risk = "MEDIUM"
            elif role == "ATTACKER_IP":
                category = "ATTACKER_IP"
                if is_brute_force_success:
                    risk = "HIGH"
                else:
                    risk = "HIGH" if freq > 5 or len(files) >= 2 else "MEDIUM"
            elif role == "DOMAIN":
                category = "DOMAIN"
                risk = "MEDIUM" if freq > 3 else "LOW"
            elif role == "EMAIL":
                category = "EMAIL"
                risk = "LOW"
            else:
                category = "OBSERVED"
                risk = "LOW"

            result[ioc_value] = {
                "category": category,
                "type": data["type"],
                "role": role,
                "seen_in_files": files,
                "frequency": freq,
                "first_seen": data["first_seen"],
                "last_seen": data["last_seen"],
                "risk_level": risk,
                "context_flags": flags
            }

        logger.debug("=== FINAL CORRELATION RESULT ===")
        for k, v in result.items():
            logger.debug("%s => %s", k, v)

        return result

    except Exception as e:
        logger.error("Error in correlate_iocs: %s", e)
        traceback.print_exc()
        return {}

def generate_analyst_insights(correlations: dict) -> list[str]:
    try:
        insights = []
        for ioc_value, data in correlations.items():
            files = data.get("seen_in_files", [])
            n = len(files)
            category = data.get("category", "")
            
            if n >= 2:
                if category == "C2_IP":
                    insights.append(f"📡 C2 INFRASTRUCTURE: IP {ioc_value} appears as outbound destination in {n} files — likely attacker command and control server")
                elif category == "ATTACKER_IP":
                    insights.append(f"⚠️ CAMPAIGN DETECTED: IP {ioc_value} shows persistent attack pattern across {n} log files")
                elif category == "MALWARE":
                    insights.append(f"🦠 MALWARE SPREAD: Hash {ioc_value} detected across {n} files — possible lateral movement or shared infection source")
                elif category == "VULNERABILITY":
                    insights.append(f"🎯 REPEATED EXPLOITATION: {ioc_value} targeted across {n} files — attacker is systematically exploiting this vulnerability")
                    
            if data.get("risk_level") == "HIGH" and category == "INTERNAL_HOST":
                insights.append(f"🚨 SUCCESSFUL COMPROMISE: Internal host {ioc_value} successfully logged in after brute-force activity")
            elif data.get("risk_level") == "HIGH" and category == "ATTACKER_IP" and "success" in data.get("context_flags", []):
                insights.append(f"🚨 SUCCESSFUL COMPROMISE: Attacker IP {ioc_value} successfully logged in after brute-force activity")

        return insights

    except Exception as e:
        logger.error("Error generating analyst insights: %s", e)
        return []

def get_correlation_summary(correlation: dict) -> list[str]:
    try:
        summaries = []
        for ioc, data in correlation.items():
            t = data["category"]
            files = len(data["seen_in_files"])
            freq = data["frequency"]
            risk = data["risk_level"]
            
            file_word = "file" if files == 1 else "files"
            occ_word = "occurrence" if freq == 1 else "occurrences"
            
            summary = f"[{risk}] {t} {ioc} seen in {files} {file_word} ({freq} {occ_word})"
            summaries.append(summary)
            
        return summaries
    except Exception as e:
        logger.error("Error in get_correlation_summary: %s", e)
        return ["Error generating correlation summary"]
