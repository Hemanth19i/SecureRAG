import os
import uuid
import time
import logging
import traceback
import chromadb

logger = logging.getLogger(__name__)

class VectorStore:
    def __init__(self, persist_directory: str = "./chroma_store"):
        self.persist_directory = persist_directory
        self.client = None
        self.collection = None

        try:
            self._init_client()
        except Exception as e:
            if "database is locked" in str(e).lower() or "sqlite" in str(e).lower():
                logger.warning("ChromaDB locked, waiting 2 seconds to retry...")
                time.sleep(2)
                try:
                    self._init_client()
                except Exception as retry_e:
                    logger.error("Failed to initialize VectorStore after retry: %s", retry_e)
                    traceback.print_exc()
            else:
                logger.error("Error initializing VectorStore: %s", e)
                traceback.print_exc()

    def _init_client(self):
        logger.debug("=== CHROMA INIT ===")
        logger.debug("Persist directory: %s", os.path.abspath(self.persist_directory))

        self.client = chromadb.PersistentClient(path=self.persist_directory)
        self.collection = self.client.get_or_create_collection(
            name="securerag_logs"
        )

        logger.debug("Collection name: %s", self.collection.name)
        logger.debug("Collection count: %s", self.collection.count())

    def cleanup(self, reset: bool = False):
        """
        Proper cleanup method. Never call reset() on startup.
        Only resets if explicitly requested.
        """
        if reset and self.client:
            self.client.reset()

    def store_embeddings(self, chunks: list[str], embeddings: list[list[float]], metadata: list[dict] = None, ids: list[str] = None):
        try:
            if not self.collection:
                return False

            if not metadata:
                metadata = [{"chunk_index": i} for i in range(len(chunks))]

            if not ids:
                ids = [f"chunk_{str(uuid.uuid4())}" for i in range(len(chunks))]

            logger.debug("Collection count before: %s", self.collection.count())

            self.collection.add(
                documents=chunks,
                embeddings=embeddings,
                metadatas=metadata,
                ids=ids
            )

            logger.debug("Collection count after: %s", self.collection.count())
            return True
        except Exception as e:
            logger.error("Error storing embeddings: %s", e)
            traceback.print_exc()
            return False


    def query_similar(self, query_embedding: list[float], top_k: int = 5):
        try:
            if not self.collection:
                return {"documents": [], "metadatas": [], "distances": []}

            logger.debug("=== QUERY_SIMILAR DEBUG ===")
            logger.debug("Collection name: %s", self.collection.name)
            logger.debug("Collection count: %s", self.collection.count())
            logger.debug("Embedding length: %s", len(query_embedding))

            actual_k = min(top_k, self.collection.count())
            if actual_k == 0:
                return {"documents": [], "metadatas": [], "distances": []}

            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=actual_k
            )

            return results

        except Exception as e:
            logger.error("Error querying similar embeddings: %s", e)
            traceback.print_exc()
            return {"documents": [], "metadatas": [], "distances": []}

    def get_all_chunks(self):
        try:
            if not self.collection:
                return {"documents": [], "metadatas": []}
            return self.collection.get(include=["documents", "metadatas"])
        except Exception as e:
            logger.error("Error getting all chunks: %s", e)
            traceback.print_exc()
            return {"documents": [], "metadatas": []}
