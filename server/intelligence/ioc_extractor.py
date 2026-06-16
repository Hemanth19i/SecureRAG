import re
import ipaddress
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


def _refang(text: str) -> str:
    """Normalise common defanged indicators back to canonical form so the
    extractors below can match them. Handles hxxp[s]:// -> http[s]://,
    [.]/(.)/{.}/[dot]/(dot) -> '.', [:] -> ':', and [at]/(at)/[@]/(@) -> '@'.
    A no-op on text that contains no defang markers.
    """
    t = text
    t = t.replace("[.]", ".").replace("(.)", ".").replace("{.}", ".")
    t = re.sub(r"\[dot\]|\(dot\)", ".", t, flags=re.IGNORECASE)
    t = t.replace("[:]", ":")
    t = re.sub(r"\[at\]|\(at\)|\[@\]|\(@\)", "@", t, flags=re.IGNORECASE)
    t = re.sub(r"h[xX]{2}p(s?)://", r"http\1://", t)
    return t


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
            "emails": [],
            # Additive indicator types — the five keys above are unchanged.
            "ipv6": [],
            "urls": []
        }

        if not text:
            return iocs

        # Refang defanged indicators (hxxp://, 1.2.3[.]4, evil[.]com, a[at]b)
        # to canonical form so every extractor below matches them. No-op on
        # text without defang markers, so existing behaviour is preserved.
        refanged = _refang(text)

        # Extract IPs (basic IPv4, octet-validated to 0-255)
        ip_pattern = r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'
        iocs["ips"] = list({ip for ip in re.findall(ip_pattern, refanged) if _is_valid_ipv4(ip)})

        # Extract IPv6 — candidate tokens validated via the stdlib ipaddress
        # module so timestamps (02:11:44) and MAC addresses are not misread.
        ipv6_found = []
        for cand in re.findall(r'(?<![\w:.])[A-Fa-f0-9:]{2,}(?![\w:.])', refanged):
            if cand.count(":") >= 2:
                try:
                    if ipaddress.ip_address(cand).version == 6:
                        ipv6_found.append(cand)
                except ValueError:
                    pass
        iocs["ipv6"] = list(set(ipv6_found))

        # Extract domains
        domain_pattern = r'\b[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b'
        domains = set(re.findall(domain_pattern, refanged))
        # Drop IP-shaped matches and bare filenames (e.g. "auth.log", "payload.bin")
        iocs["domains"] = [
            d for d in domains
            if not re.fullmatch(ip_pattern, d)
            and d.rsplit(".", 1)[-1].lower() not in FILE_EXTENSIONS
        ]

        # Extract Hashes (MD5 = 32, SHA1 = 40, SHA256 = 64 hex)
        md5_pattern = r'\b[a-fA-F0-9]{32}\b'
        sha1_pattern = r'\b[a-fA-F0-9]{40}\b'
        sha256_pattern = r'\b[a-fA-F0-9]{64}\b'
        hashes = set(
            re.findall(md5_pattern, refanged)
            + re.findall(sha1_pattern, refanged)
            + re.findall(sha256_pattern, refanged)
        )
        iocs["hashes"] = list(hashes)

        # Extract CVEs
        cve_pattern = r'\bCVE-\d{4}-\d{4,7}\b'
        iocs["cves"] = list(set(re.findall(cve_pattern, refanged, re.IGNORECASE)))

        # Extract Emails
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b'
        iocs["emails"] = list(set(re.findall(email_pattern, refanged)))

        # Extract URLs (http/https; defanged hxxp:// already refanged above)
        url_pattern = r'https?://[^\s<>"\'\)\]]+'
        urls = re.findall(url_pattern, refanged, re.IGNORECASE)
        iocs["urls"] = list({u.rstrip(".,;:'\")]") for u in urls})

        return iocs
    except Exception as e:
        logger.error("Error in extract_iocs: %s", e)
        traceback.print_exc()
        return {"error": str(e)}
