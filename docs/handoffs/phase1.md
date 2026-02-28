# Phase 1 — Complete

**Date**: 2026-02-28
**Branch**: `dev`
**Status**: All Phase 1 exit criteria met

---

## Summary

Phase 1 delivered the full foundation: monorepo scaffold, SAX streaming parser, AST builder with section-emit pattern, Markdown renderer, YAML frontmatter generator, USC converter pipeline, and CLI `convert` command. E2E verified against real Title 1 XML (39 sections, 3 chapters, 0.02s).

## Test Coverage

| Package | Tests | Files |
|---------|-------|-------|
| `@law2md/core` | 77 | 7 test files |
| `@law2md/usc` | 6 | 2 test files |
| `law2md` (CLI) | 3 | 1 test file |
| **Total** | **86** | **10 test files** |

All 12 turbo tasks (build/test/lint/typecheck × 3 packages) pass cleanly.

## Architecture Implemented

```
usc01.xml → ReadStream → XMLParser (saxes) → ASTBuilder → onEmit(section) →
  renderDocument(section, frontmatter) → writeFile(title-NN/chapter-NN/section-N.md)
```

### @law2md/core

| Module | File | Purpose |
|--------|------|---------|
| XML Parser | `src/xml/parser.ts` | Wraps saxes with namespace normalization, typed events |
| Namespace | `src/xml/namespace.ts` | USLM/XHTML/DC namespace constants, element classification sets |
| AST Types | `src/ast/types.ts` | LevelNode, ContentNode, InlineNode, NoteNode, etc. + context types |
| AST Builder | `src/ast/builder.ts` | Stack-based XML→AST, section-emit pattern, metadata extraction |
| Renderer | `src/markdown/renderer.ts` | AST→Markdown, bold inline numbering, refs, notes, blockquotes |
| Frontmatter | `src/markdown/frontmatter.ts` | FrontmatterData→YAML with format_version and generator |

### @law2md/usc

| Module | File | Purpose |
|--------|------|---------|
| Converter | `src/converter.ts` | Full pipeline orchestrator: parse → build → render → write |

### law2md (CLI)

| Module | File | Purpose |
|--------|------|---------|
| Entry | `src/index.ts` | Commander setup, version, help |
| Convert | `src/commands/convert.ts` | `law2md convert <input>` with output/linkStyle/sourceCredits options |

## Bugs Found and Fixed During E2E

1. **Quoted content sections emitted as files** — `<section>` inside `<quotedContent>` (quoted bills in notes) were emitted as standalone files. Fixed via `quotedContentDepth` tracking in builder.
2. **Cross-heading note headings empty** — `<heading><b>Editorial Notes</b></heading>` pattern lost text to inline frames. Fixed with `bubbleTextToCollector()` in builder.

## Fixtures

| Path | Purpose |
|------|---------|
| `fixtures/xml/` | Full USC XML files (gitignored, user-provided) |
| `fixtures/fragments/simple-section.xml` | Minimal title/chapter/section for unit tests |
| `fixtures/fragments/section-with-subsections.xml` | Section 7 with (a)(b)(c) subsections |
| `fixtures/expected/section-2.md` | Expected output snapshot: simple section |
| `fixtures/expected/section-7.md` | Expected output snapshot: section with subsections + notes |

## Known Limitations (Phase 2 scope)

- **Extra blank lines**: Multiple `<p>` elements inside `<content>` produce extra paragraph breaks
- **Cross-reference links**: Only plaintext mode implemented; relative/canonical link resolution needs link resolver
- **Tables**: XHTML `<table>` and USLM `<layout>` elements are skipped (ignored frames)
- **TOC**: `<toc>` elements are skipped
- **`_meta.json`**: Not yet generated
- **README.md**: Title/chapter README files not yet generated
- **Notes filtering**: All notes are included; `--include-notes` / `--include-amendments` flags not yet wired
- **Chapter-level granularity**: Only section-level output is implemented

---

## Resolved Design Decisions

Documented in CLAUDE.md and DEVELOPMENT_PLAN.md:

| Decision | Resolution |
|----------|-----------|
| Footnotes | Markdown `[^N]` style |
| Appendix titles | Separate directories (`title-05-appendix/`) |
| Token estimation | `tiktoken` with `cl100k_base` encoding |
| Table of Disposition | Exclude from section output, include in title README |
| Linting | ESLint + Prettier from the start |
| Package manager | pnpm (not npm) |

## Key Schema Findings

- Schema is intentionally permissive: any `<level>` inside any `<level>`, `<content>` allows `##any` namespace
- `<continuation>` is interstitial (between same-level siblings), not just "after sub-levels"
- Additional elements: `<article>`, `<subarticle>`, `<preliminary>`, `<statutoryNote>`, `<editorialNote>`, `<changeNote>`, `<shortTitle>`, `<checkBox>`
- StatusEnum has 18 values (repealed, transferred, omitted, reserved, etc.)
- `@portion` on `<ref>` is composable with `@idref` for recursive references
- CSS uses 12pt indent per hierarchy level; `<term>` renders as small-caps (we use bold)

## Technical Notes

- **pnpm 10.30.3** with `pnpm.onlyBuiltDependencies: ["esbuild"]`
- **No TS project references** — tsup handles cross-package resolution via `workspace:*`
- **@types/node** in both root and per-package devDependencies
- **ESLint**: flat config, typescript-eslint strict + prettier; `no-non-null-assertion` off in test files
- **Prettier**: printWidth 100, double quotes, trailing commas; ignores `docs/reference/`, `*.md`, `fixtures/xml/`

## User Preferences

- Prefers checking in before starting major work phases
- Wants scaffold verified before feature implementation
- Uses pnpm, not npm
