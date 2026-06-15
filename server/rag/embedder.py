import traceback
from sentence_transformers import SentenceTransformer

class Embedder:
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        try:
            self.model = SentenceTransformer(model_name)
        except Exception as e:
            print(f"Error initializing Embedder: {e}")
            self.model = None

    def embed_chunks(self, chunks: list[str]) -> list[list[float]]:
        try:
            if not self.model or not chunks:
                return []
            embeddings = self.model.encode(chunks)
            return embeddings.tolist()
        except Exception as e:
            print(f"Error embedding chunks: {e}")
            traceback.print_exc()
            return []

    def embed_query(self, query: str) -> list[float]:
        try:
            if not self.model or not query:
                return []
            embedding = self.model.encode([query])[0]
            return embedding.tolist()
        except Exception as e:
            print(f"Error embedding query: {e}")
            traceback.print_exc()
            return []
