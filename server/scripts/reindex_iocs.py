import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from rag.vectorstore import VectorStore
from intelligence.sqlite_store import SQLiteStore
from intelligence.ioc_extractor import extract_iocs
from intelligence.mitre_mapper import map_to_mitre
from intelligence.timeline_gen import extract_timestamps

def run_reindex():
    print("Starting reindex of ChromaDB into SQLite...")
    
    db_path = os.getenv("CHROMA_DB_PATH", "./chroma_store")
    vector_store = VectorStore(persist_directory=db_path)
    sqlite_store = SQLiteStore(db_path="./securerag.db")
    
    all_data = vector_store.get_all_chunks()
    documents = all_data.get("documents", [])
    metadatas = all_data.get("metadatas", [])
    ids = all_data.get("ids", [])
    
    # In older ChromaDB collections that we stored without explicit chunk_id, we might not have `ids` matched.
    # Fortunately vectorstore.get() does return 'ids'.
    if not ids:
        ids = [f"chunk_legacy_{i}" for i in range(len(documents))]
        
    print(f"Found {len(documents)} chunks to migrate.")
    
    for i, (doc, meta, chunk_id) in enumerate(zip(documents, metadatas, ids)):
        upload_id = meta.get("upload_id", "legacy_upload")
        source_file = meta.get("source_file", "unknown")
        
        sqlite_store.store_log_chunk(chunk_id, upload_id, source_file, doc)
        
        chunk_iocs = extract_iocs(doc)
        for ioc_type, ioc_list in chunk_iocs.items():
            if ioc_type == "error": continue
            for ioc_val in ioc_list:
                single_type = "hash" if ioc_type == "hashes" else ("cve" if ioc_type == "cves" else ioc_type.rstrip("s"))
                sqlite_store.store_ioc(ioc_val, single_type, chunk_id)
                
        mitre_matches = map_to_mitre(doc)
        for match in mitre_matches:
            sqlite_store.store_mitre_mapping(chunk_id, match["technique"], match["tactic"], match.get("confidence", "UNKNOWN"))
            
        timeline_events = extract_timestamps(doc)
        for ev in timeline_events:
            severity = "LOW"
            if any(k in ev["event"].lower() for k in ["fail", "deny", "malware"]):
                severity = "MEDIUM"
            sqlite_store.store_timeline_event(chunk_id, ev["timestamp"], ev["event"], severity)
            
        if not timeline_events and mitre_matches:
            desc = doc.strip()[:100] + ("..." if len(doc.strip()) > 100 else "")
            sqlite_store.store_timeline_event(chunk_id, "T+unknown", f"[{mitre_matches[0]['tactic'].upper()}] {desc}", mitre_matches[0].get("confidence", "UNKNOWN"))
            
        if i % 100 == 0 and i > 0:
            print(f"Processed {i}/{len(documents)} chunks...")
            
    print("Reindexing complete!")

if __name__ == "__main__":
    run_reindex()
