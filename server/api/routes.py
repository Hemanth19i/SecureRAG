import uuid
import logging
import traceback
from datetime import datetime
import hashlib
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from rag.chunker import chunk_text
from rag.embedder import Embedder
from intelligence.ioc_extractor import extract_iocs
from intelligence.gemini_analyzer import analyze_threat, generate_incident_report
from intelligence.mitre_mapper import map_to_mitre, build_kill_chain
from intelligence.timeline_gen import generate_timeline, format_timeline_string
from intelligence.correlator import correlate_iocs, get_correlation_summary, generate_analyst_insights
from intelligence.attack_graph import build_attack_graph

logger = logging.getLogger(__name__)

api_bp = Blueprint('api', __name__)
embedder = Embedder()

@api_bp.route('/debug/chunks', methods=['GET'])
@jwt_required()
def debug_chunks():
    claims = get_jwt()
    if claims.get("role") != "ADMIN":
        return jsonify({"error": "Admin privileges required"}), 403

    from flask import current_app

    logger.debug("=== DEBUG CHUNKS ===")
    logger.debug("Collection object: %s", current_app.vector_store.collection)
    logger.debug("Collection count: %s", current_app.vector_store.collection.count())

    all_data = current_app.vector_store.collection.get(
        include=["documents", "metadatas"]
    )

    return jsonify({
        "total_chunks": len(all_data.get("documents", [])),
        "metadatas": all_data.get("metadatas", []),
        "documents_preview": [d[:80] for d in all_data.get("documents", [])]
    }), 200

@api_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_log():
    claims = get_jwt()
    if claims.get("role") != "ADMIN":
        return jsonify({"error": "Admin privileges required"}), 403
    try:
        file = request.files.get('file')
        if not file:
            return jsonify({"error": "No file provided"}), 400

        text = file.read().decode('utf-8')

        # Calculate SHA256 file fingerprint
        file_hash = hashlib.sha256(text.encode('utf-8')).hexdigest()

        # Check for duplicates
        existing_upload_id = current_app.sqlite_store.check_file_exists(file_hash)
        if existing_upload_id:
            return jsonify({
                "error": "File already ingested",
                "upload_id": existing_upload_id
            }), 409

        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # We need an upload ID for the DB
        upload_id = str(uuid.uuid4())

        metadata = {
            "filename": file.filename,
            "source_file": file.filename,
            "timestamp": now,
            "upload_id": upload_id
        }


# Parse & chunk first (no DB writes yet)
        chunks = chunk_text(text)
        if not chunks:
            return jsonify({"error": "Failed to chunk text"}), 500

        embeddings = embedder.embed_chunks(chunks)
        if not embeddings:
            return jsonify({"error": "Failed to generate embeddings"}), 500

        chunk_metadatas = []
        chunk_ids = []
        for i, chunk_text_content in enumerate(chunks):
            meta = metadata.copy()
            meta['chunk_index'] = i
            chunk_id = f"chunk_{upload_id}_{i}"
            meta['chunk_id'] = chunk_id
            chunk_ids.append(chunk_id)
            clean_meta = {k: v for k, v in meta.items() if isinstance(v, (str, int, float, bool))}
            chunk_metadatas.append(clean_meta)

        # Write to ChromaDB FIRST. If this fails, nothing else is written
        # so a retry won't create duplicate/orphaned SQLite rows.
        success = current_app.vector_store.store_embeddings(chunks, embeddings, chunk_metadatas, ids=chunk_ids)
        if not success:
            return jsonify({"error": "Failed to store in ChromaDB"}), 500

        # ChromaDB write succeeded — now populate the SQLite analysis tables.
        # All writes for this upload run in a single transaction: if any row
        # fails, the whole upload is rolled back rather than left half-ingested.
        sqlite = current_app.sqlite_store
        with sqlite.transaction() as conn:
            for i, chunk_text_content in enumerate(chunks):
                chunk_id = chunk_ids[i]

                # 1. Store raw chunk
                sqlite.store_log_chunk(chunk_id, upload_id, file.filename, chunk_text_content, conn=conn)

                # 2. Extract and store IOCs
                chunk_iocs = extract_iocs(chunk_text_content)
                for ioc_type, ioc_list in chunk_iocs.items():
                    if ioc_type == "error": continue
                    for ioc_val in ioc_list:
                        TYPE_MAP = {"ips": "ip", "hashes": "hash", "cves": "cve", "domains": "domain", "emails": "email", "ipv6": "ipv6", "urls": "url"}
                        single_type = TYPE_MAP.get(ioc_type, ioc_type)
                        sqlite.store_ioc(ioc_val, single_type, chunk_id, conn=conn)

                # 3. MITRE mapping
                mitre_matches = map_to_mitre(chunk_text_content)
                for match in mitre_matches:
                    sqlite.store_mitre_mapping(chunk_id, match["technique"], match["tactic"], match.get("confidence", "UNKNOWN"), conn=conn)

                # 4. Timeline generation — same pipeline as /query and /timeline
                timeline_events = generate_timeline(chunk_text_content, mitre_matches)
                for ev in timeline_events:
                    sqlite.store_timeline_event(chunk_id, ev["timestamp"], ev["description"], ev["severity"], conn=conn)

            sqlite.store_file_upload(file_hash, upload_id, file.filename, conn=conn)

        # Compute global correlation across all ingested logs (reads committed data)
        all_iocs = sqlite.get_all_extracted_iocs()
        global_correlations = correlate_iocs(all_iocs, sqlite)
        sqlite.store_global_correlation(global_correlations)

        return jsonify({"message": "File uploaded successfully", "chunks_stored": len(chunks)}), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@api_bp.route('/correlate', methods=['POST'])
@jwt_required()
def correlate_endpoint():
    claims = get_jwt()
    if claims.get("role") not in ["ADMIN", "ANALYST"]:
        return jsonify({"error": "Insufficient privileges. Require ADMIN or ANALYST"}), 403
    try:
        correlations = current_app.sqlite_store.get_global_correlation()
        summary = get_correlation_summary(correlations)
        insights = generate_analyst_insights(correlations)

        high_risk = [ioc for ioc, d in correlations.items() if d['risk_level'] == 'HIGH']

        return jsonify({
            "correlations": correlations,
            "summary": summary,
            "high_risk_iocs": high_risk,
            "analyst_insights": insights
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@api_bp.route('/mitre-map', methods=['POST'])
@jwt_required()
def mitre_map():
    claims = get_jwt()
    if claims.get("role") not in ["ADMIN", "ANALYST"]:
        return jsonify({"error": "Insufficient privileges. Require ADMIN or ANALYST"}), 403
    try:
        data = request.json
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400

        text = data['text']
        techniques = map_to_mitre(text)
        kill_chain = build_kill_chain(techniques)

        return jsonify({
            "techniques": techniques,
            "kill_chain": kill_chain,
            "total_techniques": len(techniques)
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@api_bp.route('/timeline', methods=['POST'])
@jwt_required()
def timeline_endpoint():
    claims = get_jwt()
    if claims.get("role") not in ["ADMIN", "ANALYST"]:
        return jsonify({"error": "Insufficient privileges. Require ADMIN or ANALYST"}), 403
    try:
        data = request.json
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400

        text = data['text']
        mitre_results = map_to_mitre(text)
        timeline = generate_timeline(text, mitre_results)
        summary = format_timeline_string(timeline)

        return jsonify({
            "timeline": timeline,
            "summary": summary,
            "total_events": len(timeline)
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@api_bp.route('/query', methods=['POST'])
@jwt_required()
def query_system():
    claims = get_jwt()
    if claims.get("role") not in ["ADMIN", "ANALYST"]:
        return jsonify({"error": "Insufficient privileges. Require ADMIN or ANALYST"}), 403
    try:
        data = request.json
        if not data or 'query' not in data:
            return jsonify({"error": "No query provided"}), 400

        query_text = data['query']
        top_k = data.get('top_k', 5)

        query_embedding = embedder.embed_query(query_text)
        if not query_embedding:
            return jsonify({"error": "Failed to embed query"}), 500

        results = current_app.vector_store.query_similar(query_embedding, top_k)
        logger.debug("=== RAW QUERY RESULTS ===")
        logger.debug("%s", results)

        chunks = []
        if results and results.get('documents') and len(results['documents']) > 0:
            for i in range(len(results['documents'][0])):
                chunks.append({
                    "document": results['documents'][0][i],
                    "metadata": results['metadatas'][0][i] if results.get('metadatas') else {},
                    "distance": results['distances'][0][i] if results.get('distances') else 0.0
                })

        chunk_texts = [c["document"] for c in chunks]
        logger.debug("=== RETRIEVED CHUNKS === count=%s", len(chunk_texts))
        for i, c in enumerate(chunk_texts):
            logger.debug("Chunk %s: %s", i + 1, c[:150])
        combined_text = "\n".join(chunk_texts)

        # Extract IoCs
        iocs = extract_iocs(combined_text)

        # Fetch pre-computed Global Correlation
        correlations = current_app.sqlite_store.get_global_correlation()

        # Map to MITRE
        mitre_results = map_to_mitre(combined_text)
        mitre = {
            "techniques": mitre_results,
            "kill_chain": build_kill_chain(mitre_results)
        }

        # Generate Timeline
        timeline_events = generate_timeline(combined_text, mitre_results)
        timeline = {
            "events": timeline_events,
            "summary": format_timeline_string(timeline_events)
        }

        # Analyze threat with Gemini
        analysis = analyze_threat(
            query=query_text,
            chunks=chunk_texts,
            correlations=correlations,
            mitre=mitre,
            timeline=timeline
        )

        return jsonify({
            "status": "success",
            "analysis": analysis,
            "iocs": iocs,
            "correlation": {
                "details": correlations,
                "summary": get_correlation_summary(correlations),
                "analyst_insights": generate_analyst_insights(correlations)
            },
            "mitre": mitre,
            "timeline": timeline,
            "chunks_used": len(chunk_texts),
            "query": query_text
        }), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
@api_bp.route('/stats', methods=['GET'])
@jwt_required()
def stats_endpoint():
    claims = get_jwt()
    if claims.get("role") not in ["ADMIN", "ANALYST"]:
        return jsonify({"error": "Insufficient privileges. Require ADMIN or ANALYST"}), 403
    try:
        sqlite = current_app.sqlite_store
        return jsonify({
            "readouts": sqlite.get_dashboard_readouts(),
            "evidence": sqlite.get_evidence_log()
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@api_bp.route('/attack-graph', methods=['GET'])
@jwt_required()
def attack_graph_endpoint():
    claims = get_jwt()
    if claims.get("role") not in ["ADMIN", "ANALYST"]:
        return jsonify({"error": "Insufficient privileges. Require ADMIN or ANALYST"}), 403
    try:
        upload_id = request.args.get('upload_id')
        if not upload_id:
            return jsonify({"error": "upload_id query parameter is required"}), 400

        graph = build_attack_graph(current_app.sqlite_store, upload_id)
        if graph is None:
            return jsonify({"error": "Upload not found"}), 404

        return jsonify(graph), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@api_bp.route('/report', methods=['POST'])
@jwt_required()
def report_endpoint():
    claims = get_jwt()
    if claims.get("role") not in ["ADMIN", "ANALYST"]:
        return jsonify({"error": "Insufficient privileges. Require ADMIN or ANALYST"}), 403
    try:
        data = request.json
        if not data or 'analysis' not in data:
            return jsonify({"error": "No analysis object provided"}), 400

        report_text = generate_incident_report(data['analysis'])
        return jsonify({"report": report_text}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@api_bp.route('/cases', methods=['POST'])
@jwt_required()
def create_case_endpoint():
    claims = get_jwt()
    if claims.get("role") not in ["ADMIN", "ANALYST"]:
        return jsonify({"error": "Insufficient privileges. Require ADMIN or ANALYST"}), 403
    try:
        data = request.json or {}
        snapshot = data.get('snapshot')
        # Pull severity/summary/query from the investigation snapshot when not
        # supplied explicitly. snapshot mirrors the POST /query response shape.
        analysis = snapshot.get('analysis') if isinstance(snapshot, dict) else None
        analysis = analysis if isinstance(analysis, dict) else {}
        query = data.get('query') or (snapshot.get('query') if isinstance(snapshot, dict) else "") or ""
        title = data.get('title') or (query[:80] if query else None)
        if not title:
            return jsonify({"error": "A title or query is required"}), 400

        severity = (data.get('severity') or analysis.get('severity') or "LOW").upper()
        summary = data.get('summary') or analysis.get('summary') or ""
        assigned_to = data.get('assigned_to')
        created_by = get_jwt_identity()
        case_id = str(uuid.uuid4())

        sqlite = current_app.sqlite_store
        with sqlite.transaction() as conn:
            sqlite.create_case(
                case_id, title, created_by,
                severity=severity, summary=summary, query=query,
                snapshot=snapshot, assigned_to=assigned_to, conn=conn,
            )

        return jsonify({"case": sqlite.get_case(case_id)}), 201
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@api_bp.route('/cases', methods=['GET'])
@jwt_required()
def list_cases_endpoint():
    claims = get_jwt()
    if claims.get("role") not in ["ADMIN", "ANALYST"]:
        return jsonify({"error": "Insufficient privileges. Require ADMIN or ANALYST"}), 403
    try:
        sqlite = current_app.sqlite_store
        cases = sqlite.get_cases(
            status=request.args.get('status'),
            severity=request.args.get('severity'),
            assigned_to=request.args.get('assigned_to'),
        )
        return jsonify({"cases": cases, "total": len(cases)}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@api_bp.route('/cases/<case_id>', methods=['GET'])
@jwt_required()
def get_case_endpoint(case_id):
    claims = get_jwt()
    if claims.get("role") not in ["ADMIN", "ANALYST"]:
        return jsonify({"error": "Insufficient privileges. Require ADMIN or ANALYST"}), 403
    try:
        case = current_app.sqlite_store.get_case(case_id)
        if case is None:
            return jsonify({"error": "Case not found"}), 404
        return jsonify(case), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@api_bp.route('/cases/<case_id>', methods=['PATCH'])
@jwt_required()
def update_case_endpoint(case_id):
    claims = get_jwt()
    if claims.get("role") not in ["ADMIN", "ANALYST"]:
        return jsonify({"error": "Insufficient privileges. Require ADMIN or ANALYST"}), 403
    try:
        data = request.json or {}
        ALLOWED_STATUS = {"OPEN", "IN_PROGRESS", "CLOSED"}
        ALLOWED_SEVERITY = {"CRITICAL", "HIGH", "MEDIUM", "LOW"}

        updates = {}
        if "status" in data:
            status = str(data["status"]).upper()
            if status not in ALLOWED_STATUS:
                return jsonify({"error": "Invalid status. Use OPEN, IN_PROGRESS or CLOSED"}), 400
            updates["status"] = status
        if "severity" in data:
            severity = str(data["severity"]).upper()
            if severity not in ALLOWED_SEVERITY:
                return jsonify({"error": "Invalid severity. Use CRITICAL, HIGH, MEDIUM or LOW"}), 400
            updates["severity"] = severity
        if "title" in data:
            title = str(data["title"]).strip()
            if not title:
                return jsonify({"error": "Title cannot be empty"}), 400
            updates["title"] = title
        if "assigned_to" in data:
            # Empty/null clears the assignee (stored as ""); a string assigns it.
            updates["assigned_to"] = (data.get("assigned_to") or "")

        if not updates:
            return jsonify({"error": "No updatable fields provided"}), 400

        sqlite = current_app.sqlite_store
        with sqlite.transaction() as conn:
            affected = sqlite.update_case(case_id, conn=conn, **updates)

        if affected == 0:
            return jsonify({"error": "Case not found"}), 404

        return jsonify({"case": sqlite.get_case(case_id)}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
