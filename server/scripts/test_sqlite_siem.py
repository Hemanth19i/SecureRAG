import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from intelligence.sqlite_store import SQLiteStore

def test_sqlite():
    db_path = "./test_securerag.db"
    if os.path.exists(db_path):
        os.remove(db_path)
        
    store = SQLiteStore(db_path=db_path)
    
    print("Testing store_log_chunk...")
    store.store_log_chunk("chunk_1", "upload_1", "test.log", "Failed password for root from 10.0.0.5 port 22")
    
    print("Testing store_ioc...")
    store.store_ioc("10.0.0.5", "ip", "chunk_1", "ATTACKER_IP")
    
    print("Testing store_mitre_mapping...")
    store.store_mitre_mapping("chunk_1", "T1110", "Credential Access", "HIGH")
    
    print("Testing store_timeline_event...")
    store.store_timeline_event("chunk_1", "2026-06-15T00:00:00Z", "Failed password", "MEDIUM")
    
    conn = store.get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM log_chunks")
    chunks = cursor.fetchall()
    assert len(chunks) == 1
    assert chunks[0]["chunk_id"] == "chunk_1"
    
    cursor.execute("SELECT * FROM extracted_iocs")
    iocs = cursor.fetchall()
    assert len(iocs) == 1
    assert iocs[0]["ioc_value"] == "10.0.0.5"
    
    cursor.execute("SELECT * FROM chunk_ioc_mapping")
    mappings = cursor.fetchall()
    assert len(mappings) == 1
    assert mappings[0]["context_role"] == "ATTACKER_IP"
    
    cursor.execute("SELECT * FROM chunk_mitre_mapping")
    mitre = cursor.fetchall()
    assert len(mitre) == 1
    assert mitre[0]["technique_id"] == "T1110"
    
    cursor.execute("SELECT * FROM timeline_events")
    timeline = cursor.fetchall()
    assert len(timeline) == 1
    assert timeline[0]["severity"] == "MEDIUM"
    
    conn.close()
    
    print("All tests passed successfully!")
    if os.path.exists(db_path):
        os.remove(db_path)

if __name__ == "__main__":
    test_sqlite()
