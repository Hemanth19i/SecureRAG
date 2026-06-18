"""Retrieval evaluation harness — Recall@K and MRR over a labeled set.

Measures the REAL retrieval stack (SentenceTransformer embeddings + ChromaDB)
against server/eval/eval_set.json. Relevance is exact: a query is "hit" at rank
r if the retrieved chunk id at r equals the query's target id.

Run locally (downloads/loads the embedding model on first use):

    cd server
    python eval/recall_eval.py                 # semantic (baseline)
    python eval/recall_eval.py --mode hybrid   # BM25 + RRF (Part B)
    python eval/recall_eval.py --mode rerank   # BM25 + RRF + cross-encoder (Part B)

This is a local/offline measurement tool, not part of the CI test run.
"""
import os
import sys
import json
import argparse
import tempfile

# Make the server package importable when run as a script.
SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

from rag.embedder import Embedder
from rag.vectorstore import VectorStore

EVAL_SET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "eval_set.json")
KS = (1, 3, 5)


def load_eval_set(path=EVAL_SET):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def evaluate(retriever, queries, ks=KS):
    """retriever(query_str) -> list of chunk ids, best first. Returns metrics."""
    hits = {k: 0 for k in ks}
    rr_sum = 0.0
    for q in queries:
        ranked = retriever(q["query"]) or []
        target = q["target"]
        rank = next((i + 1 for i, cid in enumerate(ranked) if cid == target), None)
        rr_sum += (1.0 / rank) if rank else 0.0
        for k in ks:
            if target in ranked[:k]:
                hits[k] += 1
    n = len(queries) or 1
    metrics = {f"recall@{k}": round(hits[k] / n, 3) for k in ks}
    metrics["mrr"] = round(rr_sum / n, 3)
    metrics["n"] = len(queries)
    return metrics


def build_corpus_store(corpus, embedder, persist_dir):
    """Embed + store every corpus entry under its own id."""
    vs = VectorStore(persist_directory=persist_dir)
    texts = [c["text"] for c in corpus]
    ids = [c["id"] for c in corpus]
    embeddings = embedder.embed_chunks(texts)
    vs.store_embeddings(texts, embeddings, [{"id": i} for i in ids], ids=ids)
    return vs


def make_retriever(mode, corpus, embedder, vs):
    """Return a retriever(query)->ranked ids for the given mode.

    'semantic' is the baseline. 'hybrid' / 'rerank' are wired in Part B via
    rag.retriever; they raise a clear message until that lands.
    """
    n = len(corpus)
    id_by_index = [c["id"] for c in corpus]
    text_by_id = {c["id"]: c["text"] for c in corpus}

    def semantic(query):
        qe = embedder.embed_query(query)
        res = vs.query_similar(qe, top_k=n)
        return (res.get("ids") or [[]])[0]

    if mode == "semantic":
        return semantic

    # Part B hooks (kept here so the harness already supports before/after).
    try:
        from rag.retriever import hybrid_rank  # noqa: F401
    except Exception:
        raise SystemExit(
            f"mode='{mode}' needs rag.retriever (Part B). Run --mode semantic for the baseline."
        )
    from rag.retriever import hybrid_rank

    def hybrid(query):
        sem_ids = semantic(query)
        return hybrid_rank(
            query, id_by_index, text_by_id, sem_ids,
            use_rerank=(mode == "rerank"),
        )

    return hybrid


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", default="semantic", choices=["semantic", "hybrid", "rerank"])
    args = parser.parse_args()

    data = load_eval_set()
    corpus, queries = data["corpus"], data["queries"]
    embedder = Embedder()
    tmp = tempfile.mkdtemp(prefix="recall_eval_")
    vs = build_corpus_store(corpus, embedder, tmp)

    retriever = make_retriever(args.mode, corpus, embedder, vs)
    metrics = evaluate(retriever, queries)

    print(f"\nSecureRAG retrieval eval  |  mode={args.mode}  corpus={len(corpus)}  queries={metrics['n']}")
    print("-" * 56)
    for k in KS:
        print(f"  Recall@{k}: {metrics[f'recall@{k}']:.3f}")
    print(f"  MRR:       {metrics['mrr']:.3f}")
    print("-" * 56)
    return metrics


if __name__ == "__main__":
    main()
