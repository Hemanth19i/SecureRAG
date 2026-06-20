"""Reusable ingestion pipeline (Week 4D, Phase 4).

Extracts the end-to-end ingestion that the /upload route performed inline so
other entry points (e.g. a future live monitor feed) can reuse the identical
chunk -> embed -> Chroma -> SQLite -> correlate -> alerts flow without
duplicating it.

Behaviour is a verbatim move of the original /upload body: the route keeps
owning HTTP concerns (auth, file IO, the duplicate decision, status codes) and
delegates the pipeline here. This service never performs a duplicate check — the
caller decides whether to dedup before calling.
"""
import uuid
import logging
import hashlib
from datetime import datetime

from rag.chunker import chunk_text
from intelligence.ioc_extractor import extract_iocs
from intelligence.mitre_mapper import map_to_mitre
from intelligence.timeline_gen import generate_timeline
from intelligence.correlator import correlate_iocs
from intelligence.alerts import build_alerts

logger = logging.getLogger(__name__)

# Same IOC-type normalisation the upload route used (was an inline dict).
_IOC_TYPE_MAP = {"ips": "ip", "hashes": "hash", "cves": "cve", "domains": "domain",
                 "emails": "email", "ipv6": "ipv6", "urls": "url"}


def ingest_text(text, filename, *, sqlite_store, vector_store, embedder,
                file_hash=None, upload_id=None):
    """Run the full ingestion pipeline for one blob of log text.

    Returns a result dict:
      {"status": "ok", "upload_id", "chunks_stored", "alerts_created"}
      {"status": "error", "stage": "chunk"|"embed"|"chroma", "message"}

    Mirrors the original /upload body exactly: Chroma is written first so a
    failure leaves no orphaned SQLite rows; all analysis-table writes share one
    transaction; correlation runs on committed data; alerts are derived from the
    same aggregated outputs and stored in a second transaction. file_hash and
    upload_id are computed when not supplied so the service is self-contained.
    """
    if file_hash is None:
        file_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    if upload_id is None:
        upload_id = str(uuid.uuid4())

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    metadata = {
        "filename": filename,
        "source_file": filename,
        "timestamp": now,
        "upload_id": upload_id,
    }

    # Parse & chunk first (no DB writes yet)
    chunks = chunk_text(text)
    if not chunks:
        return {"status": "error", "stage": "chunk", "message": "Failed to chunk text"}

    embeddings = embedder.embed_chunks(chunks)
    if not embeddings:
        return {"status": "error", "stage": "embed", "message": "Failed to generate embeddings"}

    chunk_metadatas = []
    chunk_ids = []
    for i, chunk_text_content in enumerate(chunks):
        meta = metadata.copy()
        meta["chunk_index"] = i
        chunk_id = f"chunk_{upload_id}_{i}"
        meta["chunk_id"] = chunk_id
        chunk_ids.append(chunk_id)
        clean_meta = {k: v for k, v in meta.items() if isinstance(v, (str, int, float, bool))}
        chunk_metadatas.append(clean_meta)

    # Write to ChromaDB FIRST. If this fails, nothing else is written
    # so a retry won't create duplicate/orphaned SQLite rows.
    success = vector_store.store_embeddings(chunks, embeddings, chunk_metadatas, ids=chunk_ids)
    if not success:
        return {"status": "error", "stage": "chroma", "message": "Failed to store in ChromaDB"}

    # ChromaDB write succeeded — now populate the SQLite analysis tables.
    # All writes for this upload run in a single transaction: if any row
    # fails, the whole upload is rolled back rather than left half-ingested.
    agg_mitre = []
    agg_timeline = []
    upload_iocs = set()  # IOC values actually observed in THIS upload
    with sqlite_store.transaction() as conn:
        for i, chunk_text_content in enumerate(chunks):
            chunk_id = chunk_ids[i]

            # 1. Store raw chunk
            sqlite_store.store_log_chunk(chunk_id, upload_id, filename, chunk_text_content, conn=conn)

            # 2. Extract and store IOCs
            chunk_iocs = extract_iocs(chunk_text_content)
            for ioc_type, ioc_list in chunk_iocs.items():
                if ioc_type == "error": continue
                for ioc_val in ioc_list:
                    single_type = _IOC_TYPE_MAP.get(ioc_type, ioc_type)
                    sqlite_store.store_ioc(ioc_val, single_type, chunk_id, conn=conn)
                    upload_iocs.add(ioc_val)

            # 3. MITRE mapping
            mitre_matches = map_to_mitre(chunk_text_content)
            agg_mitre.extend(mitre_matches)
            for match in mitre_matches:
                sqlite_store.store_mitre_mapping(chunk_id, match["technique"], match["tactic"], match.get("confidence", "UNKNOWN"), conn=conn)

            # 4. Timeline generation — same pipeline as /query and /timeline
            timeline_events = generate_timeline(chunk_text_content, mitre_matches)
            agg_timeline.extend(timeline_events)
            for ev in timeline_events:
                sqlite_store.store_timeline_event(chunk_id, ev["timestamp"], ev["description"], ev["severity"], conn=conn)

        sqlite_store.store_file_upload(file_hash, upload_id, filename, conn=conn)

    # Compute global correlation across all ingested logs (reads committed data)
    all_iocs = sqlite_store.get_all_extracted_iocs()
    global_correlations = correlate_iocs(all_iocs, sqlite_store)
    sqlite_store.store_global_correlation(global_correlations)

    # Generate real-time alerts from THIS upload's analysis outputs. The
    # correlation map spans all uploads, so scope the correlation-derived IOC
    # alerts to IOCs actually seen in this upload — otherwise every upload
    # re-fires HIGH_RISK_IOC / BRUTE_FORCE_SUCCESS for every previously-seen
    # high-risk IOC. (Timeline / MITRE alerts are already this-upload-scoped.)
    upload_correlations = {k: v for k, v in global_correlations.items() if k in upload_iocs}
    alerts = build_alerts(agg_timeline, agg_mitre, upload_correlations,
                          source=filename, upload_id=upload_id)
    # store_alert is idempotent (INSERT OR IGNORE on the unique index), so a
    # repeat (alert_type, ioc_value) is skipped; count only rows actually stored.
    stored = 0
    if alerts:
        with sqlite_store.transaction() as conn:
            for a in alerts:
                stored += sqlite_store.store_alert(a, conn=conn) or 0

    return {"status": "ok", "upload_id": upload_id,
            "chunks_stored": len(chunks), "alerts_created": stored}
