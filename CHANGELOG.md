# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## [Unreleased]

### Added

#### Phase 1: Foundation — Scaffold

- **Monorepo scaffold** with pnpm workspaces, Turborepo pipeline (build/test/lint/typecheck/dev), and three packages: `@law2md/core`, `@law2md/usc`, `law2md` (CLI) ([`9f55906`](../../commit/9f55906))
- **TypeScript 5.x strict mode** with `tsup` (ESM-only) builds, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` ([`9f55906`](../../commit/9f55906))
- **ESLint** flat config with `typescript-eslint` strict + Prettier integration ([`9f55906`](../../commit/9f55906))
- **Vitest** per-package test configs with co-located test files ([`9f55906`](../../commit/9f55906))
- **Fixture directories**: `fixtures/xml/` (gitignored, user-provided USC XML), `fixtures/fragments/` (synthetic test XML), `fixtures/expected/` (output snapshots) ([`9f55906`](../../commit/9f55906))

#### Phase 1: Foundation — Core (`@law2md/core`)

- **XML Parser** (`src/xml/parser.ts`): streaming SAX parser wrapping `saxes` with namespace normalization — USLM default namespace elements emit bare names (`section`), other namespaces emit prefixed names (`xhtml:table`, `dc:title`). Supports `parseString()` and `parseStream()`. ([`120a553`](../../commit/120a553))
- **Namespace constants** (`src/xml/namespace.ts`): `USLM_NS`, `XHTML_NS`, `DC_NS`, `DCTERMS_NS`, `XSI_NS`, plus element classification sets (`LEVEL_ELEMENTS`, `CONTENT_ELEMENTS`, `INLINE_ELEMENTS`, `NOTE_ELEMENTS`, etc.) ([`120a553`](../../commit/120a553))
- **AST node types** (`src/ast/types.ts`): `LevelNode`, `ContentNode`, `InlineNode`, `NoteNode`, `SourceCreditNode`, `TableNode`, `TOCNode`, `NotesContainerNode`, `QuotedContentNode`, plus `AncestorInfo`, `DocumentMeta`, `EmitContext`, `FrontmatterData` context types ([`120a553`](../../commit/120a553))
- **AST Builder** (`src/ast/builder.ts`): stack-based XML-to-AST construction with section-emit pattern — emits completed section subtrees via callback for bounded memory usage. Handles levels, content blocks, inline formatting, refs, notes, source credits, quoted content, and metadata extraction from `<meta>`. ([`47cf7a9`](../../commit/47cf7a9))
- **Markdown Renderer** (`src/markdown/renderer.ts`): stateless AST-to-Markdown conversion with bold inline numbering for subsections (not headings), three cross-reference link modes (plaintext/canonical/relative), source credits after horizontal rule, notes with H2/H3 headings, and blockquote rendering for quoted content ([`9c7189d`](../../commit/9c7189d))
- **Frontmatter Generator** (`src/markdown/frontmatter.ts`): `FrontmatterData` to YAML serialization with controlled field ordering, `format_version` ("1.0.0"), and `generator` metadata ([`9c7189d`](../../commit/9c7189d))

#### Phase 1: Foundation — USC (`@law2md/usc`)

- **USC Converter** (`src/converter.ts`): full pipeline orchestrator for a single USC XML file — ReadStream → SAX parser → AST builder (emit at section) → Markdown renderer + frontmatter → file writer. Outputs to `usc/title-NN/chapter-NN/section-N.md`. Supports source credit toggling. Uses collect-then-write pattern to avoid async issues during SAX streaming. ([`eb22560`](../../commit/eb22560))

#### Phase 1: Foundation — CLI (`law2md`)

- **`law2md convert` command** (`src/commands/convert.ts`): accepts input XML path, output directory, link style, and source credit toggle. Validates input, reports timing and section count, supports verbose mode. ([`2147c05`](../../commit/2147c05))

#### Documentation

- **CLAUDE.md**: project overview, tech stack, build commands, code conventions, USLM schema reference, design decisions ([`11de6db`](../../commit/11de6db), [`28f3d6c`](../../commit/28f3d6c))
- **DEVELOPMENT_PLAN.md**: 4-phase plan, architecture, CLI spec, element mapping, risk register ([`11de6db`](../../commit/11de6db))
- **ARCHITECTURE.md**: system overview, package dependency graph, data flow, interface specs ([`11de6db`](../../commit/11de6db))
- **OUTPUT_FORMAT.md**: directory layout, frontmatter schema, content structure, notes rendering, RAG guidance ([`11de6db`](../../commit/11de6db))
- **XML_ELEMENT_REFERENCE.md**: element-by-element conversion reference with attributes and Markdown output ([`11de6db`](../../commit/11de6db), [`28f3d6c`](../../commit/28f3d6c))
- **EXTENDING.md**: guide for adding new legal source types ([`11de6db`](../../commit/11de6db))
- **USLM reference materials**: user guide PDF, XSD schemas (1.0, 1.0.15), CSS stylesheet, Dublin Core schemas ([`6f08a5a`](../../commit/6f08a5a))
- **Phase 1 handoff**: `docs/handoffs/phase1.md` with architecture summary, test coverage, bugs fixed, known limitations ([`fc60c65`](../../commit/fc60c65))

#### Test Fixtures

- `fixtures/fragments/simple-section.xml` — minimal title/chapter/section ([`120a553`](../../commit/120a553))
- `fixtures/fragments/section-with-subsections.xml` — section with (a)(b)(c) subsections ([`120a553`](../../commit/120a553))
- `fixtures/expected/section-2.md` — expected output snapshot for simple section ([`966b6f5`](../../commit/966b6f5))
- `fixtures/expected/section-7.md` — expected output snapshot for section with subsections + notes ([`966b6f5`](../../commit/966b6f5))

### Fixed

- **Quoted content sections emitted as standalone files**: `<section>` elements inside `<quotedContent>` (quoted bills in statutory notes) were being emitted as standalone Markdown files, causing overwrites. Fixed by tracking `quotedContentDepth` in the AST builder and suppressing emission when inside quotes. ([`966b6f5`](../../commit/966b6f5))
- **Cross-heading note headings empty**: `<heading><b>Editorial Notes</b></heading>` pattern caused empty heading text because the `<b>` inline element captured text in its own frame. Fixed by adding `bubbleTextToCollector()` that propagates text from inline frames up to parent heading/num collector frames. ([`966b6f5`](../../commit/966b6f5))

### Changed

- **Barrel exports cleaned up**: removed legacy `USLM_NAMESPACE` / `XHTML_NAMESPACE` / `DC_NAMESPACE` / `DCTERMS_NAMESPACE` aliases from `@law2md/core`. Use `USLM_NS`, `XHTML_NS`, `DC_NS`, `DCTERMS_NS` instead. ([`d42bb21`](../../commit/d42bb21))
