"""Hybrid retrieval (semantic + BM25 via RRF) with optional cross-encoder rerank.

Design for CI/offline safety:
- BM25 (rank_bm25) is pure-Python and deterministic — always available.
- Reciprocal Rank Fusion is a pure function (unit-tested with stubbed rankings).
- The cross-encoder reranker (sentence-transformers CrossEncoder) is imported and
  loaded LAZILY and cached, only when reranking is actually requested. It is never
  imported at module load, so importing this module never triggers a model
  download. If it can't load, callers transparently fall back to fusion-only.

Gated at the call site by env flags RAG_HYBRID / RAG_RERANK (default off).
"""
import os
import re
import logging

logger = logging.getLogger(__name__)

_WORD = re.compile(r"[a-z0-9]+")

# Lazy reranker cache.
_RERANKER = None
_RERANKER_LOADED = False
RERANKER_MODEL = os.getenv("RAG_RERANK_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")


def _tokenize(text):
    return _WORD.findall((text or "").lower())


def reciprocal_rank_fusion(rankings, k=60):
    """Fuse ranked id lists via RRF (score = sum 1/(k + rank)). Returns ids
    ordered by descending fused score. Pure and deterministic."""
    scores = {}
    for ranking in rankings:
        for rank, cid in enumerate(ranking):
            scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + rank + 1)
    return [cid for cid, _ in sorted(scores.items(), key=lambda kv: kv[1], reverse=True)]


def bm25_rank(doc_ids, doc_texts, query, top_n=None):
    """Keyword (BM25) ranking. Returns doc ids best-first. Pure, no model."""
    from rank_bm25 import BM25Okapi

    if not doc_ids:
        return []
    bm25 = BM25Okapi([_tokenize(t) for t in doc_texts])
    scores = bm25.get_scores(_tokenize(query))
    order = sorted(range(len(doc_ids)), key=lambda i: scores[i], reverse=True)
    ranked = [doc_ids[i] for i in order]
    return ranked[:top_n] if top_n else ranked


def _get_reranker():
    """Lazily load + cache the cross-encoder; return None if it can't load."""
    global _RERANKER, _RERANKER_LOADED
    if _RERANKER_LOADED:
        return _RERANKER
    _RERANKER_LOADED = True
    try:
        from sentence_transformers import CrossEncoder
        _RERANKER = CrossEncoder(RERANKER_MODEL)
    except Exception as e:  # pragma: no cover - depends on model availability
        logger.warning("Reranker unavailable (%s); falling back to fusion-only.", e)
        _RERANKER = None
    return _RERANKER


def rerank(query, ids, text_by_id, top_n=None, model=None):
    """Reorder candidate ids by cross-encoder relevance. Falls back to the input
    order if no reranker is available. `model` is injectable for testing."""
    candidates = ids[:top_n] if top_n else list(ids)
    if not candidates:
        return candidates
    if model is None:
        model = _get_reranker()
    if model is None:
        return candidates
    try:
        scores = model.predict([(query, text_by_id.get(cid, "")) for cid in candidates])
    except Exception as e:  # pragma: no cover
        logger.warning("Rerank scoring failed (%s); keeping fused order.", e)
        return candidates
    order = sorted(range(len(candidates)), key=lambda i: scores[i], reverse=True)
    return [candidates[i] for i in order]


def hybrid_rank(query, doc_ids, text_by_id, semantic_ids, use_rerank=False,
                k_rrf=60, rerank_top_n=10, reranker=None):
    """Fuse semantic + BM25 rankings via RRF; optionally rerank the fused top-N
    with a cross-encoder. Returns ids best-first. `text_by_id` maps id -> text."""
    doc_texts = [text_by_id.get(cid, "") for cid in doc_ids]
    bm25_ids = bm25_rank(doc_ids, doc_texts, query)
    fused = reciprocal_rank_fusion([list(semantic_ids), bm25_ids], k=k_rrf)
    if not use_rerank:
        return fused
    head = rerank(query, fused, text_by_id, top_n=rerank_top_n, model=reranker)
    head_set = set(head)
    return head + [cid for cid in fused if cid not in head_set]
