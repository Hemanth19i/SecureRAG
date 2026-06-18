.PHONY: install-dev test test-integration lint cov

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
