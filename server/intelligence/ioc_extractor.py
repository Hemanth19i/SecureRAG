import re
import logging
import traceback

logger = logging.getLogger(__name__)

# Common file extensions that the domain regex would otherwise mis-detect as
# domains (e.g. "auth.log", "payload.bin"). Matches on the trailing label are
# dropped from the domain results.
FILE_EXTENSIONS = {
    "log", "txt", "bin", "csv", "json", "xml", "yml", "yaml", "conf", "cfg",
    "ini", "dat", "tmp", "bak", "old", "lock", "pid", "exe", "dll", "sys",
    "bat", "ps1", "sh", "py", "gz", "tar", "zip", "pcap", "cap", "db",
    "sqlite", "md", "pdf", "doc", "docx", "xls", "xlsx", "png", "jpg",
    "jpeg", "gif", "html", "htm",
}


def _is_valid_ipv4(ip: str) -> bool:
    """True only when the string is four octets each in the 0-255 range."""
    parts = ip.split(".")
    if len(parts) != 4:
        return False
    try:
        return all(0 <= int(p) <= 255 for p in parts)
    except ValueError:
        return False


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

        # Extract IPs (basic IPv4, octet-validated to 0-255)
        ip_pattern = r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'
        iocs["ips"] = list({ip for ip in re.findall(ip_pattern, text) if _is_valid_ipv4(ip)})

        # Extract domains
        domain_pattern = r'\b[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b'
        domains = set(re.findall(domain_pattern, text))
        # Drop IP-shaped matches and bare filenames (e.g. "auth.log", "payload.bin")
        iocs["domains"] = [
            d for d in domains
            if not re.fullmatch(ip_pattern, d)
            and d.rsplit(".", 1)[-1].lower() not in FILE_EXTENSIONS
        ]

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
        logger.error("Error in extract_iocs: %s", e)
        traceback.print_exc()
        return {"error": str(e)}
