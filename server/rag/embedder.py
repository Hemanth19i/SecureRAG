import logging
import traceback
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

class Embedder:
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        try:
            self.model = SentenceTransformer(model_name)
        except Exception as e:
            logger.error("Error initializing Embedder: %s", e)
            self.model = None

    def embed_chunks(self, chunks: list[str]) -> list[list[float]]:
        try:
            if not self.model or not chunks:
                return []
            embeddings = self.model.encode(chunks)
            return embeddings.tolist()
        except Exception as e:
            logger.error("Error embedding chunks: %s", e)
            traceback.print_exc()
            return []

    def embed_query(self, query: str) -> list[float]:
        try:
            if not self.model or not query:
                return []
            embedding = self.model.encode([query])[0]
            return embedding.tolist()
        except Exception as e:
            logger.error("Error embedding query: %s", e)
            traceback.print_exc()
            return []
