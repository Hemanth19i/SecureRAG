"""Unit tests for rag.retriever — fusion + rerank logic, fully offline.

The cross-encoder is never loaded here: rerank is tested with an injected stub
model, and the fallback path is tested by monkeypatching the lazy loader to None.
A real-model check lives behind @pytest.mark.integration.
"""
import pytest

from rag.retriever import reciprocal_rank_fusion, bm25_rank, rerank, hybrid_rank


def test_rrf_rewards_agreement_across_rankings():
    fused = reciprocal_rank_fusion([["a", "b", "c"], ["b", "c", "a"]])
    assert fused[0] == "b"           # high in both -> wins
    assert set(fused) == {"a", "b", "c"}


def test_rrf_is_deterministic():
    rankings = [["x", "y"], ["y", "x"]]
    assert reciprocal_rank_fusion(rankings) == reciprocal_rank_fusion(rankings)


def test_bm25_ranks_keyword_match_first():
    ids = ["x", "y", "z"]
    texts = ["the cat sat on the mat", "ransomware encrypted the files", "a normal log line"]
    assert bm25_rank(ids, texts, "ransomware encryption")[0] == "y"


def test_bm25_empty_corpus():
    assert bm25_rank([], [], "anything") == []


def test_hybrid_without_rerank_is_pure_fusion():
    ids = ["a", "b", "c"]
    text_by_id = {"a": "alpha", "b": "ransomware encrypted files", "c": "gamma"}
    out = hybrid_rank("ransomware", ids, text_by_id, ["a", "b", "c"], use_rerank=False)
    assert set(out) == {"a", "b", "c"}
    assert out.index("b") < out.index("c")   # BM25 boosts 'b'


class _StubReranker:
    """Deterministic offline reranker: scores docs containing 'WIN' highest."""

    def predict(self, pairs):
        return [1.0 if "WIN" in doc else 0.0 for _q, doc in pairs]


def test_hybrid_rerank_promotes_scored_doc():
    ids = ["a", "b", "c"]
    text_by_id = {"a": "nothing here", "b": "the WIN marker", "c": "also nothing"}
    out = hybrid_rank("q", ids, text_by_id, ["a", "c", "b"], use_rerank=True,
                      reranker=_StubReranker())
    assert out[0] == "b"


def test_rerank_falls_back_when_no_model(monkeypatch):
    import rag.retriever as r
    monkeypatch.setattr(r, "_get_reranker", lambda: None)
    out = r.rerank("q", ["a", "b", "c"], {"a": "x", "b": "y", "c": "z"}, model=None)
    assert out == ["a", "b", "c"]   # input order preserved


@pytest.mark.integration
def test_real_cross_encoder_reranks():
    from rag.retriever import rerank as real_rerank, _get_reranker
    if _get_reranker() is None:
        pytest.skip("cross-encoder model unavailable")
    text_by_id = {
        "a": "the weather is sunny and mild today",
        "b": "ransomware encrypted all files and dropped a ransom note",
    }
    out = real_rerank("ransomware file encryption attack", ["a", "b"], text_by_id)
    assert out[0] == "b"
