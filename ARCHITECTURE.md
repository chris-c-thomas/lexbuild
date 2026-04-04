# Architecture

LexBuild converts U.S. legal source XML into structured Markdown. The CLI downloads source data, routes it through source-specific parsers and a shared core engine, and writes per-section `.md` files with YAML frontmatter.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ @lexbuild/cli - PIPELINE ORCHESTRATION                                       │
|                                                                              |
│ Download → Parse → Convert → Write                                           │
└──────────────────────────┬───────────────────────────────────────────────────┘
                           │
                      CLI DEPENDS ON
                           │
    ┌──────────────────────┼──────────────────────┐
    ▼                      ▼                      ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ SOURCE DATA          │  │ CORE ENGINE          │  │ OUTPUT               │
│                      │  │ @lexbuild/core       │  │                      │
│ ┌──────────────────┐ │  │ ┌──────────────────┐ │  │ ┌──────────────────┐ │
│ │ USLM 1.0 XML     │ │  │ │ SAX parse        │ │  │ │ Structured       │ │
│ │ OLRC bulk data   │ │  │ │ → typed AST      │ │  │ │ Markdown         │ │
│ └──────────────────┘ │  │ │ → render         │ │  │ │ + YAML           │ │
│ ┌──────────────────┐ │  │ │ Frontmatter      │ │  │ │ frontmatter      │ │
│ │ eCFR XML         │ │  │ │ Link resolution  │ │  │ │ per-section      │ │
│ │ ecfr.gov / bulk  │ │  │ │ Metadata         │ │  │ │ .md files        │ │
│ └──────────────────┘ │  │ │ File I/O         │ │  │ └──────────────────┘ │
│ ┌──────────────────┐ │  │ └──────────────────┘ │  │                      │
│ │ FR XML + JSON    │ │  │                      │  │                      │
│ │ API / bulk data  │ │  └──────────┬───────────┘  └──────────────────────┘
│ └──────────────────┘ │             │
│ ┌──────────────────┐ │        PARSERS USE
│ │ Future source    │ │             ▼
│ │ any legal schema │ │   ┌────────────────────────────────────────────┐
│ └──────────────────┘ │   │ SOURCE PACKAGES                            │
└──────────────────────┘   │                                            │
                           │ ┌────────────────────────────────────────┐ │
                           │ │ @lexbuild/usc       USLM → AST builder │ │
                           │ │ @lexbuild/ecfr      eCFR → AST builder │ │
                           │ │ @lexbuild/fr        FR → AST + enrich  │ │
                           │ │ @lexbuild/<source>                     │ │
                           │ └────────────────────────────────────────┘ │
                           └────────────────────────────────────────────┘
```

## Three Layers

### Layer 1: Core Infrastructure

[`@lexbuild/core`](packages/core/) provides format-agnostic building blocks shared by all source packages:

- **XML Parser** — Streaming SAX parser (via `saxes`) that keeps memory bounded even for 100MB+ XML files
- **AST Types** — Typed node hierarchy: levels, content, inline, notes, tables, TOC
- **Markdown Renderer** — AST → Markdown conversion with configurable heading offsets, link styles, and note filtering
- **Frontmatter Generator** — Ordered YAML frontmatter from structured metadata
- **Link Resolver** — Cross-reference resolution with relative paths, canonical URLs, or plaintext fallbacks
- **Resilient File I/O** — `writeFile`/`mkdir` wrappers with exponential backoff on file descriptor exhaustion

### Layer 2: Source Packages

Each source package handles one XML format's complete pipeline: download, parse, build AST, and convert to Markdown. Source packages depend only on core, never on each other.

| Package | Source | XML Format | Download Sources |
|---------|--------|------------|-----------------|
| [`@lexbuild/usc`](packages/usc/) | U.S. Code | USLM 1.0 | OLRC bulk zip |
| [`@lexbuild/ecfr`](packages/ecfr/) | Code of Federal Regulations | eCFR GPO/SGML | eCFR API, govinfo bulk |
| [`@lexbuild/fr`](packages/fr/) | Federal Register | FR GPO/SGML + JSON | FederalRegister.gov API, govinfo bulk |

Each source package provides:

- **Downloader** — Fetches source data from official APIs or bulk endpoints
- **AST Builder** — SAX event handler that constructs typed AST nodes from the source's XML schema
- **Converter** — Orchestrates the pipeline: discover files → parse XML → build AST → render Markdown → write output

`@lexbuild/fr` additionally provides an **enricher** that patches YAML frontmatter in existing `.md` files with metadata from the FederalRegister.gov API, without re-parsing XML or re-rendering Markdown.

### Layer 3: Applications & CLI

| Package | Purpose |
|---------|---------|
| [`@lexbuild/cli`](packages/cli/) | Published npm binary. Thin orchestration layer that delegates to source packages. |
| [`apps/astro/`](apps/astro/) | Web application at [lexbuild.dev](https://lexbuild.dev). Consumes `.md` output files — no code dependency on any `@lexbuild/*` package. |

## Conversion Pipeline

The core pipeline is the same for every source:

```
Source XML → SAX events → Source-specific AST Builder → Typed AST nodes
  → Core Markdown Renderer → YAML frontmatter + Markdown body → .md file
```

1. **Download** — Fetch XML (and optionally JSON metadata) from official sources
2. **Parse** — Stream XML through the SAX parser, emitting events to a source-specific AST builder
3. **Build AST** — The builder maintains a stack of frames, constructing typed nodes. When a complete unit (section, document) closes, it emits the subtree via callback and releases memory.
4. **Render** — The core renderer walks the AST and produces Markdown with YAML frontmatter. Link resolution, note filtering, and heading offsets are applied at this stage.
5. **Write** — Output files are written to a date-based (FR) or hierarchy-based (USC, eCFR) directory structure with `_meta.json` sidecar indexes.

## Dependency Graph

```
@lexbuild/cli
  ├── @lexbuild/usc  → @lexbuild/core
  ├── @lexbuild/ecfr → @lexbuild/core
  └── @lexbuild/fr   → @lexbuild/core

apps/astro (no package dependencies — consumes output files only)
```

Source packages are independent — they never import from each other. ESLint `no-restricted-imports` rules enforce this boundary. Adding a new source means creating a new `@lexbuild/<source>` package that depends only on core.

## Adding New Sources

The multi-source architecture is proven by three independent implementations with completely different XML schemas. Adding a new source follows the established pattern:

1. Create `packages/<source>/` with a dependency on `@lexbuild/core`
2. Implement a SAX-based AST builder for the source's XML schema
3. Implement download and convert functions
4. Add CLI commands (`download-<source>`, `convert-<source>`)
5. Register the package in changesets and ESLint boundary rules

See [`docs/development/extending.md`](docs/development/extending.md) for the full walkthrough.

## Further Reading

- [`docs/architecture/`](docs/architecture/) — Detailed architecture documentation
- [`docs/packages/`](docs/packages/) — Per-package documentation
- [`docs/reference/cli-reference.md`](docs/reference/cli-reference.md) — Complete CLI reference
