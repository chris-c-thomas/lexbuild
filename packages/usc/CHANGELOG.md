# @law2md/usc

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
