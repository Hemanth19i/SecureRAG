import logging
import traceback
from intelligence.mitre_mapper import PHASE_ORDER, TECHNIQUE_PHASE

logger = logging.getLogger(__name__)


def build_attack_graph(sqlite_store, upload_id: str):
    """Build a nodes/edges attack graph for one upload from already-stored data.

    Node types: upload, plus each IOC's own ioc_type (ip/ipv6/domain/hash/cve/
    email/url), plus technique. Edge types: observed_in (IOC -> upload),
    correlates_with (IOC <-> IOC, co-occurrence within the upload),
    maps_to (upload -> technique), triggers (technique -> technique, chained
    in kill-chain phase order). Returns None if the upload_id doesn't exist.
    """
    try:
        upload = sqlite_store.get_upload_info(upload_id)
        if not upload:
            return None

        iocs = sqlite_store.get_iocs_for_upload(upload_id)
        techniques = sqlite_store.get_mitre_for_upload(upload_id)
        co_occurring = sqlite_store.get_co_occurring_iocs(upload_id)
        correlations = sqlite_store.get_global_correlation()

        nodes = []
        edges = []
        seen_ids = set()

        def add_node(node):
            if node["id"] not in seen_ids:
                seen_ids.add(node["id"])
                nodes.append(node)

        upload_node_id = f"upload:{upload['upload_id']}"
        add_node({"id": upload_node_id, "type": "upload", "label": upload["filename"]})

        for ioc in iocs:
            ioc_id = f"ioc:{ioc['ioc_value']}"
            node = {"id": ioc_id, "type": ioc["ioc_type"], "label": ioc["ioc_value"]}
            corr = correlations.get(ioc["ioc_value"])
            if corr:
                node["role"] = corr.get("role")
                node["risk_level"] = corr.get("risk_level")
            add_node(node)
            edges.append({"source": ioc_id, "target": upload_node_id, "type": "observed_in"})

        for pair in co_occurring:
            edges.append({
                "source": f"ioc:{pair['ioc_a']}",
                "target": f"ioc:{pair['ioc_b']}",
                "type": "correlates_with",
            })

        sorted_techniques = sorted(
            techniques,
            key=lambda t: PHASE_ORDER.get(TECHNIQUE_PHASE.get(t["technique_id"], ""), 99)
        )
        prev_tech_id = None
        for t in sorted_techniques:
            tech_id = f"technique:{t['technique_id']}"
            add_node({
                "id": tech_id,
                "type": "technique",
                "label": t["technique_id"],
                "tactic": t["tactic"],
                "confidence": t["confidence"],
            })
            edges.append({"source": upload_node_id, "target": tech_id, "type": "maps_to"})
            if prev_tech_id:
                edges.append({"source": prev_tech_id, "target": tech_id, "type": "triggers"})
            prev_tech_id = tech_id

        return {"nodes": nodes, "edges": edges}
    except Exception as e:
        logger.error("Error building attack graph: %s", e)
        traceback.print_exc()
        return {"nodes": [], "edges": []}
