import sys, json
sys.path.append('c:/Users/abhih/Desktop/SecureRAG/server')
from intelligence.correlator import correlate_iocs
class MockSQLite:
    def get_connection(self):
        import sqlite3
        conn = sqlite3.connect(':memory:')
        conn.row_factory = sqlite3.Row
        conn.execute("CREATE TABLE chunk_ioc_mapping (chunk_id, ioc_value, context_role)")
        conn.execute("CREATE TABLE log_chunks (chunk_id, raw_text, source_file, timestamp_ingested)")
        conn.execute("INSERT INTO chunk_ioc_mapping VALUES ('chunk1', '5f4dcc3b5aa765d61d8327deb882cf99', 'UNKNOWN')")
        conn.execute("INSERT INTO log_chunks VALUES ('chunk1', 'downloaded 5f4dcc3b5aa765d61d8327deb882cf99', 'test.log', '2023')")
        conn.execute("INSERT INTO chunk_ioc_mapping VALUES ('chunk2', 'CVE-2023-44487', 'UNKNOWN')")
        conn.execute("INSERT INTO log_chunks VALUES ('chunk2', 'CVE-2023-44487 detected', 'test.log', '2023')")
        return conn
res = correlate_iocs({'hashes': ['5f4dcc3b5aa765d61d8327deb882cf99'], 'cves': ['CVE-2023-44487']}, MockSQLite())
print(json.dumps(res, indent=2))