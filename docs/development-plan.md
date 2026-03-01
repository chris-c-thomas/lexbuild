# law2md Development Plan

## Overview

`law2md` is a CLI tool that converts official U.S. legislative XML (USLM schema) into clean, structured Markdown optimized for AI ingestion and RAG systems. The MVP targets the U.S. Code as published by the Office of the Law Revision Counsel (OLRC). The architecture is designed to extend to the Code of Federal Regulations (CFR), state statutes, and administrative codes in future phases.

---

## Problem Statement

Legal texts are among the most frequently cited sources in RAG-augmented AI systems, yet the canonical machine-readable formats (USLM XML, GPO XML) are dense, deeply nested, and laden with presentation markup that degrades retrieval quality. There is no production-grade, open-source pipeline that converts these sources into chunked, metadata-rich Markdown suitable for embedding and retrieval.

Key challenges:

- **Scale**: The full U.S. Code is 54 titles, some exceeding 100MB of XML (Title 26 - IRC, Title 42 - Public Health). Naive parsing will OOM or produce unchunkable monoliths.
- **Structural fidelity**: The USLM hierarchy (title > subtitle > chapter > subchapter > part > subpart > section > subsection > paragraph > subparagraph > clause > subclause > item > subitem > subsubitem) must be preserved for accurate legal citation.
- **Cross-references**: The U.S. Code is densely cross-referenced. References use a canonical URI scheme (`/us/usc/t{N}/s{N}`) that must be converted to navigable markdown links.
- **Notes taxonomy**: Editorial notes, statutory notes, amendment history, source credits, and cross-references each serve different purposes in legal analysis. Users need granular control over inclusion.
- **RAG optimization**: Output must include structured metadata (YAML frontmatter), predictable file paths, and content sized for typical embedding chunk windows (512-2048 tokens).

---

## Architecture

### Monorepo Structure (Turborepo)

```
law2md/
├── turbo.json
├── package.json                    # Root workspace config
├── tsconfig.base.json              # Shared TypeScript config
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Lint, typecheck, test
│       └── release.yml             # Changesets-based publish
├── packages/
│   ├── core/                       # @law2md/core
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── xml/
│   │       │   ├── parser.ts       # Streaming XML parser (SAX-based)
│   │       │   ├── namespace.ts    # USLM namespace constants
│   │       │   └── types.ts        # USLM element type definitions
│   │       ├── markdown/
│   │       │   ├── renderer.ts     # AST-to-Markdown converter
│   │       │   ├── frontmatter.ts  # YAML frontmatter generation
│   │       │   └── links.ts        # Cross-reference link resolver
│   │       ├── ast/
│   │       │   ├── types.ts        # Intermediate AST node types
│   │       │   ├── builder.ts      # XML-to-AST transformer
│   │       │   └── visitor.ts      # AST traversal utilities
│   │       ├── metadata/
│   │       │   ├── index-builder.ts  # Consolidated index generation
│   │       │   └── types.ts          # Metadata schema types
│   │       └── utils/
│   │           ├── text.ts         # Text normalization, whitespace handling
│   │           ├── citation.ts     # Legal citation formatting
│   │           └── identifier.ts   # USLM identifier parsing/manipulation
│   ├── usc/                        # @law2md/usc
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── converter.ts        # USC-specific conversion orchestrator
│   │       ├── downloader.ts       # OLRC download client
│   │       ├── elements/
│   │       │   ├── title.ts        # <title> element handler
│   │       │   ├── chapter.ts      # <chapter> element handler
│   │       │   ├── section.ts      # <section> element handler
│   │       │   ├── subsection.ts   # <subsection> and below
│   │       │   ├── notes.ts        # Note extraction and rendering
│   │       │   ├── toc.ts          # Table of contents extraction
│   │       │   └── table.ts        # HTML table / layout conversion
│   │       ├── config.ts           # USC-specific defaults
│   │       └── url-patterns.ts     # OLRC URL construction
│   └── cli/                        # law2md (the published CLI binary)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts            # CLI entry point
│           ├── commands/
│           │   ├── convert.ts      # `law2md convert` command
│           │   ├── download.ts     # `law2md download` command
│           │   └── index-cmd.ts    # `law2md index` command
│           ├── options.ts          # Shared CLI option definitions
│           └── logger.ts           # Structured logging (pino)
├── fixtures/                       # Test fixtures
│   ├── usc01.xml                   # Title 1 (small, good for testing)
│   ├── usc01-expected/             # Expected output snapshots
│   └── fragments/                  # Isolated XML fragments for unit tests
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CONTRIBUTING.md
│   ├── OUTPUT_FORMAT.md
│   └── EXTENDING.md
└── CLAUDE.md                       # Instructions for Claude Code
```

### Why Turborepo + Workspaces

The monorepo approach with npm workspaces (managed by Turborepo) provides:

- **Separation of concerns**: `@law2md/core` contains format-agnostic XML/AST/Markdown logic. `@law2md/usc` implements U.S. Code-specific element handlers. Future `@law2md/cfr` or `@law2md/ilcs` packages share the core without duplication.
- **Independent versioning**: Each package can version and publish independently via Changesets.
- **Incremental builds**: Turborepo caches build outputs. Changing a test fixture in `packages/usc` doesn't rebuild `packages/core`.
- **Single `law2md` CLI**: The `packages/cli` package re-exports commands from jurisdiction-specific packages and remains the sole published binary.

Trade-off: Turborepo adds configuration overhead. For a solo maintainer or small team, this is marginal. The benefit compounds as additional legal sources are added.

### Why NOT Lerna

Lerna is effectively in maintenance mode. Turborepo is actively developed by Vercel, has superior caching, and integrates cleanly with npm workspaces without requiring a separate tool for dependency hoisting.

---

## Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Runtime | Node.js >= 20 LTS | Native ESM, `fs/promises`, stable `stream` API |
| Language | TypeScript 5.x (strict mode) | Non-negotiable for a project with this many structural types |
| XML Parsing | `saxes` (SAX) + `@xmldom/xmldom` (DOM) | SAX for streaming large titles; DOM for small fragment inspection. `saxes` is the most spec-compliant SAX parser for Node. |
| CLI Framework | `commander` | Lightweight, zero-dep, well-typed. `yargs` is heavier than needed. |
| YAML | `yaml` (npm) | YAML 1.2 compliant, good TypeScript types |
| Schema Validation | `zod` | Runtime validation of config, CLI options, metadata schemas |
| HTTP Client | Native `fetch` (Node 20+) | No dependency needed for simple GET + zip download |
| Zip Handling | `yauzl` | Streaming zip extraction, low memory footprint |
| Logging | `pino` | Structured JSON logging, minimal overhead |
| Testing | `vitest` | Fast, ESM-native, good TypeScript integration |
| Build | `tsup` (esbuild-based) | Fast builds, ESM + CJS dual output |
| Monorepo | Turborepo + npm workspaces | See rationale above |
| Linting | `eslint` + `@typescript-eslint` | Standard |
| Formatting | `prettier` | Standard |
| Versioning | `@changesets/cli` | Monorepo-aware versioning and changelogs |

### Why `saxes` for XML Parsing

The U.S. Code titles range from ~100KB (Title 1) to 100MB+ (Title 26). DOM parsing loads the entire document into memory, which is acceptable for small titles but catastrophic for large ones. A SAX (event-driven) parser processes the XML as a stream, emitting events for element open/close/text. This allows:

- Constant memory usage regardless of title size
- Ability to emit output files as sections are completed (no need to hold entire title AST in memory)
- Clean abort on malformed XML without resource leaks

For cases where we need to inspect a small fragment (e.g., resolving a cross-reference target), `@xmldom/xmldom` provides a lightweight DOM parse of just that fragment.

---

## Output Format

### Directory Structure

```
output/
└── usc/
    └── title-01/
        ├── _meta.json                    # Title-level metadata index
        ├── README.md                     # Title overview + table of contents
        ├── chapter-01/
        │   ├── _meta.json                # Chapter metadata
        │   ├── README.md                 # Chapter overview + section TOC
        │   ├── section-1.md              # § 1 (section-level granularity)
        │   ├── section-2.md
        │   ├── section-3.md
        │   ├── section-4.md
        │   ├── section-5.md
        │   └── section-6.md
        ├── chapter-02/
        │   ├── _meta.json
        │   ├── README.md
        │   ├── section-101.md
        │   └── ...
        └── chapter-03/
            └── ...
```

When `--granularity chapter` is used, sections are inlined into chapter files instead of split:

```
output/
└── usc/
    └── title-01/
        ├── _meta.json
        ├── README.md
        ├── chapter-01.md               # All sections inline
        ├── chapter-02.md
        └── chapter-03.md
```

### YAML Frontmatter (per section file)

```yaml
---
identifier: /us/usc/t1/s1
title: "1 USC § 1 - Words denoting number, gender, and so forth"
title_number: 1
title_name: "General Provisions"
chapter_number: 1
chapter_name: "Rules of Construction"
section_number: 1
section_name: "Words denoting number, gender, and so forth"
positive_law: true
source_credit: "(July 30, 1947, ch. 388, 61 Stat. 633; June 25, 1948, ch. 645, § 6, 62 Stat. 859; Oct. 31, 1951, ch. 655, § 1, 65 Stat. 710; Pub. L. 112–231, § 2(a), Dec. 28, 2012, 126 Stat. 1619.)"
currency: "119-73"
last_updated: "2025-12-03"
---
```

### Consolidated Metadata Index (`_meta.json`)

```json
{
  "identifier": "/us/usc/t1",
  "title_number": 1,
  "title_name": "General Provisions",
  "positive_law": true,
  "currency": "119-73",
  "generated_at": "2025-02-26T12:00:00Z",
  "generator": "law2md@0.1.0",
  "chapters": [
    {
      "identifier": "/us/usc/t1/ch1",
      "number": 1,
      "name": "Rules of Construction",
      "sections": [
        {
          "identifier": "/us/usc/t1/s1",
          "number": 1,
          "name": "Words denoting number, gender, and so forth",
          "file": "chapter-01/section-1.md",
          "token_estimate": 850
        }
      ]
    }
  ]
}
```

The `token_estimate` field (approximate, using a 4-char-per-token heuristic) enables RAG pipelines to pre-filter chunks by size without reading file contents.

### Markdown Content Format

```markdown
# § 1. Words denoting number, gender, and so forth

In determining the meaning of any Act of Congress, unless the context
indicates otherwise—

**(a)** words importing the singular include and apply to several persons,
parties, or things;

**(b)** words importing the plural include the singular;

**(c)** words importing the masculine gender include the feminine as well;
...

---

**Source Credit**: (July 30, 1947, ch. 388, 61 Stat. 633; ...)

## Statutory Notes and Related Subsidiaries

### Amendments

**2012** — Pub. L. 112-231 struck out "or combatant combatant activity" ...
```

### Cross-Reference Links

Internal cross-references (within the same output corpus) are converted to relative Markdown links:

```markdown
See [section 285b of Title 2](../../title-02/chapter-09/section-285b.md)
```

Cross-references to titles not yet converted fall back to canonical URIs as plain text with a link to the OLRC website:

```markdown
See [42 USC § 1983](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section1983)
```

---

## CLI Interface

### Commands

```
law2md <command> [options]

Commands:
  law2md convert <input>    Convert XML source file(s) to Markdown
  law2md download           Download U.S. Code XML from OLRC
  law2md index <dir>        Generate/rebuild metadata indexes for output directory

Options:
  -V, --version             Output version number
  -h, --help                Display help
  --verbose                 Enable verbose logging
  --log-format <format>     Log format: "pretty" | "json" (default: "pretty")
```

### `law2md convert`

```
law2md convert <input> [options]

Arguments:
  input                          Path to XML file or directory of XML files

Options:
  -o, --output <dir>             Output directory (default: "./output")
  -g, --granularity <level>      Output granularity: "section" | "chapter" (default: "section")
  --source-type <type>           Source type: "usc" | "cfr" (default: "usc")
  --titles <list>                Comma-separated title numbers to convert (default: all)
  --include-notes                Include all notes (editorial + statutory)
  --include-editorial-notes      Include editorial notes only
  --include-statutory-notes      Include statutory notes only
  --include-amendments           Include amendment history notes
  --include-source-credits       Include source credit annotations (default: true)
  --include-toc                  Include table of contents in chapter/title files (default: true)
  --link-style <style>           Cross-ref style: "relative" | "canonical" | "plaintext" (default: "relative")
  --available-titles <list>      Titles available for relative linking (default: auto-detect from output dir)
  --concurrency <n>              Max concurrent file writes (default: 4)
  --dry-run                      Parse and report structure without writing files
```

### `law2md download`

```
law2md download [options]

Options:
  -o, --output <dir>             Download directory (default: "./downloads")
  --title <n>                    Download a single title (1-54)
  --all                          Download all titles
  --release-point <id>           Specific release point (default: current)
  --format <fmt>                 Download format: "xml" | "xhtml" (default: "xml")
```

### `law2md index`

```
law2md index <dir> [options]

Arguments:
  dir                            Output directory containing converted Markdown

Options:
  --format <fmt>                 Index format: "json" | "jsonl" (default: "json")
  --output <file>                Write consolidated index to file (default: <dir>/_index.json)
```

---

## Conversion Pipeline

### Phase 1: Parse

```
XML Input → SAX Stream → Element Events → AST Builder → Document AST
```

The SAX parser emits `openTag`, `closeTag`, `text`, and `cdata` events. The `ASTBuilder` maintains a stack of open nodes, constructing the tree incrementally. On `closeTag` for a `<section>` element, the completed section AST node is emitted to the next phase if operating in section-level granularity mode (this keeps memory bounded).

### Phase 2: Transform

```
Document AST → Element Handlers → Markdown AST
```

Each USLM element type has a registered handler in `packages/usc/src/elements/`. Handlers are responsible for:

1. Extracting semantic content (heading, num, content)
2. Resolving cross-references via the link resolver
3. Filtering notes based on CLI flags
4. Producing Markdown AST nodes (headings, paragraphs, lists, blockquotes, links, emphasis)

### Phase 3: Render

```
Markdown AST → Frontmatter Generator → Markdown Renderer → File Writer
```

The renderer serializes the Markdown AST to string, prepends YAML frontmatter, and writes to the output directory. The metadata index builder collects section metadata as files are written and produces `_meta.json` files at the end of each chapter and title.

### Phase 4: Index

```
Output Directory → Index Builder → _meta.json files + optional consolidated index
```

Can be run as part of `convert` or independently via `law2md index`.

---

## USLM Element Mapping

### Hierarchy → Markdown Headings

| USLM Element | Markdown Heading Level | Notes |
|---|---|---|
| `<title>` | `# Title N — Name` | Only in title-level README.md |
| `<chapter>` | `## Chapter N — Name` | In chapter README or inline |
| `<subchapter>` | `### Subchapter N — Name` | |
| `<part>` | `### Part N — Name` | |
| `<section>` | `# § N. Name` | H1 within its own file |
| `<subsection>` | Bold inline: `**(a)**` | Not a heading — inline formatting |
| `<paragraph>` | Bold inline: `**(1)**` | Indented under subsection |
| `<subparagraph>` | Bold inline: `**(A)**` | Further indented |
| `<clause>` | Bold inline: `**(i)**` | |
| `<subclause>` | Bold inline: `**(I)**` | |

### Content Elements

| USLM Element | Markdown Output |
|---|---|
| `<content>` | Plain paragraph text |
| `<chapeau>` | Paragraph preceding sub-levels |
| `<continuation>` | Paragraph following sub-levels |
| `<proviso>` | Paragraph, typically starting with "*Provided*" |
| `<quotedContent>` | Blockquote `>` |
| `<ref>` | Markdown link `[text](url)` |
| `<date>` | Plain text with ISO date preserved in data |
| `<b>` | `**bold**` |
| `<i>` | `*italic*` |
| `<term>` | `**term**` (when in definition context) |
| `<def>` | Definition paragraph with bolded term |
| `<sourceCredit>` | `**Source Credit**: (text)` after horizontal rule |
| `<note>` | Section under appropriate heading based on `@topic` |
| `<table>` (XHTML) | Markdown table or fenced HTML for complex tables |

### Notes Taxonomy

The `@topic` attribute on `<note>` elements determines the note category:

| Topic Value | Category | CLI Flag |
|---|---|---|
| `amendments` | Amendment History | `--include-amendments` |
| `effectiveDateOfAmendment` | Amendment History | `--include-amendments` |
| `codification` | Editorial Notes | `--include-editorial-notes` |
| `changeOfName` | Statutory Notes | `--include-statutory-notes` |
| `crossReferences` | Cross References | `--include-notes` |
| `regulations` | Statutory Notes | `--include-statutory-notes` |
| `miscellaneous` | Statutory Notes | `--include-statutory-notes` |
| `repeals` | Statutory Notes | `--include-statutory-notes` |
| `dispositionOfSections` | Editorial Notes | `--include-editorial-notes` |
| `enacting` | Title-level note | Always included in title README |

The `@role` attribute distinguishes `editorialNotes` from `statutoryNotes` cross-headings.

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal**: Monorepo scaffold, core XML parsing, basic section-level Markdown output for Title 1.

- [ ] Initialize Turborepo workspace with `core`, `usc`, `cli` packages
- [ ] Configure TypeScript (strict, ESM, path aliases)
- [ ] Configure tsup builds, vitest, eslint, prettier
- [ ] Implement SAX-based XML parser in `@law2md/core`
- [ ] Define USLM namespace constants and element type enums
- [ ] Define intermediate AST node types
- [ ] Implement AST builder (XML events → AST)
- [ ] Implement basic Markdown renderer (AST → string)
- [ ] Implement YAML frontmatter generation
- [ ] Implement section-level file writer
- [ ] Create `law2md convert` command (local file input only)
- [ ] Test with `usc01.xml` — verify section output matches expected

**Exit criteria**: `law2md convert usc01.xml -o ./output` produces correct section-level Markdown for all of Title 1 with frontmatter.

### Phase 2: Content Fidelity (Week 3-4)

**Goal**: Handle all USLM content elements, cross-references, notes, and tables.

- [ ] Implement handlers for all hierarchical levels (subsection through subsubitem)
- [ ] Implement `<chapeau>` / `<continuation>` / `<proviso>` handling
- [ ] Implement `<ref>` → Markdown link conversion with link resolver
- [ ] Implement `<quotedContent>` → blockquote
- [ ] Implement `<def>` / `<term>` → definition formatting
- [ ] Implement `<table>` (XHTML namespace) → Markdown table
- [ ] Implement `<layout>` (column-oriented) → Markdown table
- [ ] Implement note extraction with topic-based filtering
- [ ] Implement `<sourceCredit>` extraction
- [ ] Implement `--include-notes`, `--include-amendments`, etc. flags
- [ ] Implement chapter-level granularity mode
- [ ] Generate `_meta.json` index files
- [ ] Test with Title 1 (simple) and Title 5 (moderate complexity)

**Exit criteria**: All content elements in Title 1 and Title 5 render correctly. Notes are filterable. Cross-references resolve to relative links within the output.

### Phase 3: Scale & Download (Week 5-6)

**Goal**: Handle large titles (26, 42), add download capability, performance optimization.

- [ ] Implement streaming file output (emit sections as they complete, don't hold full title AST)
- [ ] Implement `law2md download` command
- [ ] URL pattern construction for OLRC release points
- [ ] Zip download and extraction via `yauzl`
- [ ] Current release point detection (scrape or hardcode with override)
- [ ] Implement `--concurrency` for parallel file writes
- [ ] Memory profiling with Title 26 (IRC) and Title 42
- [ ] Implement progress reporting (section count, elapsed time, memory)
- [ ] Implement `--dry-run` mode
- [ ] Handle edge cases: repealed sections, reserved sections, transferred sections
- [ ] Handle appendix titles (Title 5 Appendix, Title 11 Appendix)

**Exit criteria**: `law2md download --all && law2md convert ./downloads -o ./output` completes for all 54 titles without OOM. Title 26 processes in < 5 minutes on commodity hardware.

### Phase 4: Polish & Publish (Week 7-8)

**Goal**: Documentation, CI/CD, npm publish, GitHub release.

- [ ] Write comprehensive README.md with usage examples
- [ ] Write CONTRIBUTING.md
- [ ] Write OUTPUT_FORMAT.md (specification for downstream consumers)
- [ ] Write EXTENDING.md (guide for adding new source types)
- [ ] Implement `law2md index` command for standalone index generation
- [ ] Configure GitHub Actions CI (lint, typecheck, test on PR)
- [ ] Configure Changesets for versioning
- [ ] Configure npm publish workflow
- [ ] Add snapshot tests for output stability
- [ ] Add integration test that converts Title 1 end-to-end
- [ ] Publish `law2md` to npm registry
- [ ] Create GitHub release with changelog

**Exit criteria**: `npx law2md download --title 1 && npx law2md convert ./downloads/usc01.xml` works out of the box. All packages published to npm.

### Future Phases (Post-MVP)

- **CFR Support**: `@law2md/cfr` package for Code of Federal Regulations (USLM 2.x schema from GPO/govinfo)
- **State Statutes**: `@law2md/state-il`, etc. (state-specific XML/HTML parsers)
- **Incremental Updates**: Detect release point changes and only re-convert modified titles
- **MCP Server**: Expose as an MCP tool for AI agents to query legal text on demand
- **Embedding Pipeline**: Optional integration with embedding models (OpenAI, Cohere) to produce pre-computed vectors alongside Markdown
- **Diff Support**: Generate diffs between release points showing what changed

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OLRC changes download URL patterns | Medium | Medium | Abstract URL construction; add integration test that validates current URLs |
| Title 26 (IRC) has anomalous XML structures | High | Medium | `saxes` is spec-compliant; add fallback handling for malformed elements; log warnings |
| USLM schema version changes (1.0 → 2.0) | Low (short-term) | High | Abstract element handlers behind interface; schema version detection in parser |
| Cross-reference targets don't exist in output | High | Low | Graceful fallback to canonical URI + OLRC website link |
| Complex XHTML tables don't map to Markdown tables | High | Low | Fall back to fenced HTML `<table>` blocks for tables with colspan/rowspan |
| Memory pressure on Title 42 (~200MB XML) | Medium | High | Streaming SAX parser + incremental file emission; never hold full title AST |

---

## Performance Targets

| Metric | Target | Measurement |
|---|---|---|
| Title 1 conversion time | < 1 second | Wall clock, cold start |
| Title 26 conversion time | < 5 minutes | Wall clock, cold start |
| Full U.S. Code conversion | < 30 minutes | Wall clock, 4-core machine |
| Peak memory (any single title) | < 512 MB | RSS via `process.memoryUsage()` |
| Output correctness (Title 1) | 100% section coverage | Snapshot test comparison |

---

## Testing Strategy

### Unit Tests (vitest)

- XML parser: Feed known XML fragments, assert correct AST nodes
- Element handlers: Assert Markdown output for each USLM element type
- Frontmatter generator: Assert YAML structure and content
- Link resolver: Assert correct relative path computation
- Identifier parser: Assert correct decomposition of USLM identifiers

### Integration Tests

- Convert Title 1 end-to-end; snapshot-compare output directory
- Convert a synthetic "stress test" XML with all element types
- Verify `_meta.json` structure and completeness

### Smoke Tests (CI)

- Download Title 1 from OLRC (live network test, optional in CI)
- Convert and verify non-zero output with expected file count

---

## Resolved Decisions (formerly Open Questions)

1. **Table of Disposition handling**: Exclude from section-level output. Include in title-level README.md files where they provide useful context for the full title.

2. **Appendix titles**: Separate output directories. Titles with appendices (5, 11, 18, 28) produce a sibling directory, e.g., `title-05-appendix/`. Appendix content (`<compiledAct>`, `<courtRules>`, `<reorganizationPlan>`) is treated as a separate document with its own `_meta.json` and README.md.

3. **Footnotes**: Render as Markdown footnotes using `[^N]` syntax. `<ref class="footnoteRef">` maps to `[^N]` at the reference site, and `<note type="footnote">` maps to the `[^N]: footnote text` definition at the bottom of the section file.

4. **Token estimation**: Use `tiktoken` (the `tiktoken` npm package) for accurate token counts in `_meta.json`. The `cl100k_base` encoding (used by GPT-4 / Claude) provides precise estimates that downstream RAG pipelines can rely on for chunk planning. Added as a dependency of `@law2md/core`.
