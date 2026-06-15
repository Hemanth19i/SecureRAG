\# Agents.md



\## Project: SecureRAG



SecureRAG is an AI-powered cybersecurity log analysis platform combining:



\* Flask Backend

\* React Frontend

\* ChromaDB Vector Database

\* SQLite SIEM Storage

\* IOC Extraction

\* IOC Correlation Engine

\* MITRE ATT\&CK Mapping

\* Timeline Generation

\* LLM Analysis Layer



\---



\## Agent: Ingestion Agent



Responsibilities:



\* Process uploaded logs

\* Chunk log files

\* Generate embeddings

\* Store chunks in ChromaDB

\* Store metadata in SQLite



Success Criteria:



\* Uploaded logs appear in ChromaDB

\* Uploaded logs appear in SQLite



\---



\## Agent: IOC Agent



Responsibilities:



\* Extract IPs

\* Extract Domains

\* Extract Hashes

\* Extract CVEs

\* Extract Emails



Success Criteria:



\* Accurate IOC extraction

\* Store IOCs in SQLite



\---



\## Agent: Correlation Agent



Responsibilities:



\* Link related IOCs

\* Identify attacker infrastructure

\* Track repeated indicators



Success Criteria:



\* Correct IOC relationships

\* Reduced false correlations



\---



\## Agent: MITRE Agent



Responsibilities:



\* Map attack activity to MITRE ATT\&CK techniques

\* Generate ATT\&CK summaries



Success Criteria:



\* Accurate ATT\&CK mappings



\---



\## Agent: Reporting Agent



Responsibilities:



\* Generate analyst reports

\* Create executive summaries

\* Produce remediation recommendations



Success Criteria:



\* Clear and actionable reports



\---



\## Current Priority



1\. Upload Pipeline

2\. SQLite Ingestion

3\. Chroma Synchronization

4\. Retrieval Validation

5\. Correlation Accuracy



Do not add new features until ingestion is verified.



