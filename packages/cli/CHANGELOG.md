# @lexbuild/cli

## 1.0.0

### Major Changes

- First stable release. Converts all 54 titles of the U.S. Code from USLM XML to structured Markdown optimized for AI, RAG pipelines, and semantic search.

### Patch Changes

- Updated dependencies
  - @lexbuild/core@1.0.0
  - @lexbuild/usc@1.0.0

## 0.8.0

### Minor Changes

- Cleanup repo

### Patch Changes

- Updated dependencies
  - @lexbuild/core@0.8.0
  - @lexbuild/usc@0.8.0

## 0.7.0

### Minor Changes

- lexbuild convert --all now scans --input-dir for whatever usc{NN}.xml

### Patch Changes

- Updated dependencies
  - @lexbuild/core@0.7.0
  - @lexbuild/usc@0.7.0

## 0.6.2

### Patch Changes

- Cleanup files in project
- Updated dependencies
  - @lexbuild/core@0.6.2
  - @lexbuild/usc@0.6.2

## 0.6.1

### Patch Changes

- Enhance downloader for when all titles are downloaded
- Updated dependencies
  - @lexbuild/core@0.6.1
  - @lexbuild/usc@0.6.1

## 0.6.0

### Minor Changes

- 529f4bf: CLI TUI formatting fixes

### Patch Changes

- Updated dependencies [529f4bf]
  - @lexbuild/usc@0.6.0
  - @lexbuild/core@0.6.0

## 0.5.0

### Minor Changes

- 3a29a8e: Add `--titles` multi-select option to download and convert commands. Supports ranges (`1-5`), comma-separated lists

### Patch Changes

- Updated dependencies [3a29a8e]
  - @lexbuild/core@0.5.0
  - @lexbuild/usc@0.5.0

## 0.4.1

### Patch Changes

- Add chalk, ora, and cli-table3 for polished terminal output with spinners and formatted
- Updated dependencies
  - @lexbuild/core@0.4.1
  - @lexbuild/usc@0.4.1

## 0.4.0

### Minor Changes

- Phase 4: Polish and Publish — snapshot tests, title-level README generation, CI/CD, documentation polish

### Patch Changes

- Updated dependencies
  - @lexbuild/core@0.4.0
  - @lexbuild/usc@0.4.0

## 0.3.0

### Minor Changes

- Phase 3: Scale & Download
  - feat(usc): OLRC downloader with zip extraction and release point support
  - feat(cli): `lexbuild download` command with `--title`, `--all`, `--release-point`
  - feat(usc,cli): `--dry-run` mode for convert command
  - feat(usc,cli): peak memory and token reporting in convert output
  - feat(core,usc): handle appendix titles with separate output directories
  - feat(usc): disambiguate duplicate section numbers with `-2` suffix
  - feat(usc): status edge cases (repealed, reserved, transferred) in frontmatter and `_meta.json`

### Patch Changes

- Updated dependencies
  - @lexbuild/core@0.3.0
  - @lexbuild/usc@0.3.0

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
  - @lexbuild/core@0.2.0
  - @lexbuild/usc@0.2.0

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
  - @lexbuild/core@0.1.0
  - @lexbuild/usc@0.1.0
