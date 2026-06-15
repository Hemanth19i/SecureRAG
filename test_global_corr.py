import sys, json, os, traceback
sys.path.append('c:/Users/abhih/Desktop/SecureRAG/server')
from intelligence.sqlite_store import SQLiteStore
from intelligence.correlator import correlate_iocs
from intelligence.ioc_extractor import extract_iocs

db_path = 'test_global.db'
if os.path.exists(db_path): os.remove(db_path)
store = SQLiteStore(db_path)

# Mock some chunks
chunks = [
    ('chunk1', 'downloaded 5f4dcc3b5aa765d61d8327deb882cf99 from evil.com', 'test.log'),
    ('chunk2', 'auth fail from 10.0.0.5', 'test.log'),
    ('chunk3', 'CVE-2023-44487 detected', 'test.log')
]

for chunk_id, text, file in chunks:
    store.store_log_chunk(chunk_id, 'up1', file, text)
    iocs = extract_iocs(text)
    for ioc_type, ioc_list in iocs.items():
        if ioc_type == "error": continue
        for ioc_val in ioc_list:
            single_type = "hash" if ioc_type == "hashes" else ("cve" if ioc_type == "cves" else ioc_type.rstrip("s"))
            store.store_ioc(ioc_val, single_type, chunk_id)

# Simulate global correlation
all_iocs = store.get_all_extracted_iocs()
print('All IOCs:', all_iocs)
global_correlations = correlate_iocs(all_iocs, store)
store.store_global_correlation(global_correlations)

# Simulate query
print('Global Correlations:', json.dumps(store.get_global_correlation(), indent=2))