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
from intelligence.threat_intel import get_enrichment
from intelligence.alerts import build_alerts
from intelligence.ingest import ingest_text

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

        # Delegate the full pipeline (chunk -> embed -> Chroma -> SQLite ->
        # correlate -> alerts) to the reusable ingestion service. file_hash is
        # passed through so it isn't recomputed.
        result = ingest_text(
            text, file.filename,
            sqlite_store=current_app.sqlite_store,
            vector_store=current_app.vector_store,
            embedder=embedder,
            file_hash=file_hash,
        )
        if result["status"] == "error":
            return jsonify({"error": result["message"]}), 500

        return jsonify({"message": "File uploaded successfully", "chunks_stored": result["chunks_stored"]}), 200

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

@api_bp.route('/cases/<case_id>/notes', methods=['POST'])
@jwt_required()
def add_case_note_endpoint(case_id):
    claims = get_jwt()
    if claims.get("role") not in ["ADMIN", "ANALYST"]:
        return jsonify({"error": "Insufficient privileges. Require ADMIN or ANALYST"}), 403
    try:
        data = request.json or {}
        body = str(data.get("body", "")).strip()
        if not body:
            return jsonify({"error": "Note body is required"}), 400

        sqlite = current_app.sqlite_store
        if sqlite.get_case(case_id) is None:
            return jsonify({"error": "Case not found"}), 404

        author = get_jwt_identity()
        with sqlite.transaction() as conn:
            sqlite.add_case_note(case_id, author, body, conn=conn)

        return jsonify({"notes": sqlite.get_case_notes(case_id)}), 201
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@api_bp.route('/cases/<case_id>/notes', methods=['GET'])
@jwt_required()
def list_case_notes_endpoint(case_id):
    claims = get_jwt()
    if claims.get("role") not in ["ADMIN", "ANALYST"]:
        return jsonify({"error": "Insufficient privileges. Require ADMIN or ANALYST"}), 403
    try:
        notes = current_app.sqlite_store.get_case_notes(case_id)
        return jsonify({"notes": notes, "total": len(notes)}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@api_bp.route('/enrich', methods=['GET'])
@jwt_required()
def enrich_endpoint():
    claims = get_jwt()
    if claims.get("role") not in ["ADMIN", "ANALYST"]:
        return jsonify({"error": "Insufficient privileges. Require ADMIN or ANALYST"}), 403
    try:
        value = request.args.get('value')
        if not value:
            return jsonify({"error": "value query parameter is required"}), 400

        # Cache-first; threat_intel handles TTL, negative caching, missing key,
        # provider failures, and unsupported IOC types without raising.
        result = get_enrichment(current_app.sqlite_store, value)
        return jsonify(result), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@api_bp.route('/alerts', methods=['GET'])
@jwt_required()
def list_alerts_endpoint():
    claims = get_jwt()
    if claims.get("role") not in ["ADMIN", "ANALYST"]:
        return jsonify({"error": "Insufficient privileges. Require ADMIN or ANALYST"}), 403
    try:
        try:
            since = int(request.args.get('since', 0))
        except (TypeError, ValueError):
            since = 0
        try:
            limit = int(request.args.get('limit', 50))
        except (TypeError, ValueError):
            limit = 50
        limit = max(1, min(limit, 200))

        alerts = current_app.sqlite_store.get_alerts(since_id=since, limit=limit)
        cursor = alerts[0]["alert_id"] if alerts else since
        return jsonify({"alerts": alerts, "total": len(alerts), "cursor": cursor}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@api_bp.route('/alerts/<int:alert_id>', methods=['PATCH'])
@jwt_required()
def update_alert_endpoint(alert_id):
    claims = get_jwt()
    if claims.get("role") not in ["ADMIN", "ANALYST"]:
        return jsonify({"error": "Insufficient privileges. Require ADMIN or ANALYST"}), 403
    try:
        data = request.json or {}
        if "acknowledged" not in data:
            return jsonify({"error": "No updatable fields provided"}), 400
        if not bool(data.get("acknowledged")):
            return jsonify({"error": "Only acknowledged=true is supported"}), 400

        sqlite = current_app.sqlite_store
        with sqlite.transaction() as conn:
            affected = sqlite.ack_alert(alert_id, conn=conn)

        if affected == 0:
            return jsonify({"error": "Alert not found"}), 404

        return jsonify({"alert_id": alert_id, "acknowledged": True}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
