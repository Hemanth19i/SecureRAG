import os
import uuid
import time
import traceback
import chromadb

class VectorStore:
    def __init__(self, persist_directory: str = "./chroma_store"):
        self.persist_directory = persist_directory
        self.client = None
        self.collection = None
        
        try:
            self._init_client()
        except Exception as e:
            if "database is locked" in str(e).lower() or "sqlite" in str(e).lower():
                print("ChromaDB locked, waiting 2 seconds to retry...")
                time.sleep(2)
                try:
                    self._init_client()
                except Exception as retry_e:
                    print(f"Failed to initialize VectorStore after retry: {retry_e}")
                    traceback.print_exc()
            else:
                print(f"Error initializing VectorStore: {e}")
                traceback.print_exc()

    def _init_client(self):
        print("\n=== CHROMA INIT ===")
        print("Persist directory:", os.path.abspath(self.persist_directory))

        self.client = chromadb.PersistentClient(path=self.persist_directory)
        self.collection = self.client.get_or_create_collection(
            name="securerag_logs"
        )

        print("Collection name:", self.collection.name)
        print("Collection count:", self.collection.count())
        print("===================\n")

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

            print("Collection count before:", self.collection.count())

            self.collection.add(
                documents=chunks,
                embeddings=embeddings,
                metadatas=metadata,
                ids=ids
            )
        
            print("Collection count after:", self.collection.count())
            return True
        except Exception as e:
            print(f"Error storing embeddings: {e}")
            traceback.print_exc()
            return False
       

    def query_similar(self, query_embedding: list[float], top_k: int = 5):
        try:
            if not self.collection:
                return {"documents": [], "metadatas": [], "distances": []}

            print("\n=== QUERY_SIMILAR DEBUG ===")
            print("Collection object:", self.collection)
            print("Collection name:", self.collection.name)
            print("Collection count:", self.collection.count())
            print("Embedding length:", len(query_embedding))
            print("===========================\n")

            actual_k = min(top_k, self.collection.count())
            if actual_k == 0:
                return {"documents": [], "metadatas": [], "distances": []}

            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=actual_k
            )

            return results

        except Exception as e:
            print(f"Error querying similar embeddings: {e}")
            traceback.print_exc()
            return {"documents": [], "metadatas": [], "distances": []}

    def get_all_chunks(self):
        try:
            if not self.collection:
                return {"documents": [], "metadatas": []}
            return self.collection.get(include=["documents", "metadatas"])
        except Exception as e:
            print(f"Error getting all chunks: {e}")
            traceback.print_exc()
            return {"documents": [], "metadatas": []}
