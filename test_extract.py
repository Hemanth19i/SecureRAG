import sys, json
sys.path.append('c:/Users/abhih/Desktop/SecureRAG/server')
from intelligence.ioc_extractor import extract_iocs
text = 'downloaded 5f4dcc3b5aa765d61d8327deb882cf99 from evil.com to admin@test.com CVE-2023-44487'
print(json.dumps(extract_iocs(text), indent=2))