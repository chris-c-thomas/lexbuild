# @law2md/usc

## 0.2.0

### Minor Changes

- abf4e13: Phase 2: Content Fidelity
  - Fix extra blank lines in multi-paragraph content blocks
  - Cross-reference link resolver with register/resolve/fallback and two-pass wiring
  - XHTML table conversion to Markdown pipe tables
  - USLM layout table conversion for TOC structures and tabular notes
  - Notes filtering with --no-include-notes, --include-editorial-notes, --include-statutory-notes, --include-amendments
  - \_meta.json sidecar index generation at title and chapter levels
  - Chapter-level granularity mode (--granularity chapter)
  - Fix collector zone ordering bug (table/layout/toc checked before normal handlers)
  - E2E verified against Title 1 (39 sections) and Title 5 (1162 sections)

### Patch Changes

- Updated dependencies [abf4e13]
  - @law2md/core@0.2.0

## 0.1.0

### Minor Changes

- Phase 1: Foundation — initial implementation
  - SAX streaming XML parser with namespace normalization
  - AST node types and stack-based builder with section-emit pattern
  - Markdown renderer with bold inline numbering, cross-reference link modes, notes, and blockquotes
  - YAML frontmatter generator with format versioning
  - USC converter pipeline: XML → parse → build → render → write section files
  - CLI `convert` command with output directory, link style, and source credit options
  - E2E verified against Title 1 (39 sections, 3 chapters)

### Patch Changes

- Updated dependencies
  - @law2md/core@0.1.0
