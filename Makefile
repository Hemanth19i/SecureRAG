.PHONY: install-dev test test-integration lint cov security

install-dev:
	cd server && pip install -r requirements.txt -r requirements-dev.txt

test:
	cd server && python -m pytest

test-integration:
	cd server && python -m pytest -m integration

lint:
	cd server && python -m ruff check .

cov:
	cd server && python -m pytest --cov=intelligence --cov=api --cov-report=term-missing

security:
	cd server && python -m bandit -r api intelligence rag eval app.py run_production.py wsgi.py --severity-level medium
	cd server && python -m pip_audit -r requirements.txt --ignore-vuln CVE-2026-45829 --ignore-vuln PYSEC-2025-217 --ignore-vuln CVE-2026-1839
