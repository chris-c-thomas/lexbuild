---
"@law2md/core": minor
"@law2md/usc": minor
"law2md": minor
---

Phase 2: Content Fidelity

- Fix extra blank lines in multi-paragraph content blocks
- Cross-reference link resolver with register/resolve/fallback and two-pass wiring
- XHTML table conversion to Markdown pipe tables
- USLM layout table conversion for TOC structures and tabular notes
- Notes filtering with --no-include-notes, --include-editorial-notes, --include-statutory-notes, --include-amendments
- _meta.json sidecar index generation at title and chapter levels
- Chapter-level granularity mode (--granularity chapter)
- Fix collector zone ordering bug (table/layout/toc checked before normal handlers)
- E2E verified against Title 1 (39 sections) and Title 5 (1162 sections)
