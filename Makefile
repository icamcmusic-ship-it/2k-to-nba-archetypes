WORKBOOK ?= data/2K_to_BBGM_Archetypes.xlsx

.PHONY: help deps regen test serve

help:
	@echo "make deps   - install the Python dependencies for the extractor"
	@echo "make regen  - regenerate docs/archetypes.js from \$$(WORKBOOK)"
	@echo "make test   - run the JS test suite (golden cases + diversity guard)"
	@echo "make serve  - serve docs/ at http://localhost:8000 for local testing"

deps:
	pip install -r requirements.txt

regen:
	python3 tools/extract_archetypes.py $(WORKBOOK)
	cp data/PlayerRatings_sample.csv docs/PlayerRatings_sample.csv

test:
	node tests/run.js

serve:
	cd docs && python3 -m http.server 8000
