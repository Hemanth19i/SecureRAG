import re
import traceback

def extract_iocs(text: str) -> dict:
    """
    Extracts IPs, domains, hashes, CVEs, and emails from text.
    """
    try:
        iocs = {
            "ips": [],
            "domains": [],
            "hashes": [],
            "cves": [],
            "emails": []
        }
        
        if not text:
            return iocs
            
        # Extract IPs (basic IPv4)
        ip_pattern = r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'
        iocs["ips"] = list(set(re.findall(ip_pattern, text)))
        
        # Extract domains
        domain_pattern = r'\b[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b'
        domains = set(re.findall(domain_pattern, text))
        # Filter out IPs that get matched by domain regex
        iocs["domains"] = [d for d in domains if not re.fullmatch(ip_pattern, d)]
        
        # Extract Hashes (MD5 = 32 hex, SHA256 = 64 hex)
        md5_pattern = r'\b[a-fA-F0-9]{32}\b'
        sha256_pattern = r'\b[a-fA-F0-9]{64}\b'
        hashes = set(re.findall(md5_pattern, text) + re.findall(sha256_pattern, text))
        iocs["hashes"] = list(hashes)
        
        # Extract CVEs
        cve_pattern = r'\bCVE-\d{4}-\d{4,7}\b'
        iocs["cves"] = list(set(re.findall(cve_pattern, text, re.IGNORECASE)))
        
        # Extract Emails
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b'
        iocs["emails"] = list(set(re.findall(email_pattern, text)))
        
        return iocs
    except Exception as e:
        print(f"Error in extract_iocs: {e}")
        traceback.print_exc()
        return {"error": str(e)}
