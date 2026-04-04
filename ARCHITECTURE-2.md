# Architecture

LexBuild is an open-source TypeScript monorepo that converts official U.S. legal XML into structured, per-section Markdown optimized for AI ingestion, RAG pipelines, and semantic search. The project comprises five published npm packages and two applications: a CLI toolchain (`@lexbuild/cli`) that downloads and converts legal source data; a web explorer ([lexbuild.dev](https://lexbuild.dev)) for browsing, copying, and downloading converted content; and a REST Data API ([lexbuild.dev/api](https://lexbuild.dev/api/docs)) for programmatic access to the full corpus. The five packages and two applications are organized in three dependency layers.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                           LAYER 3: APPLICATIONS                               │
│                                                                               │
│     @lexbuild/cli              apps/astro                 apps/api            │
│  ┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐  │
│  │ CLI Toolchain     │      │ Web Explorer      │      │ Data API          │  │
│  │ npm: lexbuild     │      │ lexbuild.dev      │      │ lexbuild.dev/api  │  │
│  │                   │      │                   │      │                   │  │
│  │ Orchestrates      │      │ Reads .md files   │      │ Reads SQLite DB   │  │
│  │ download/convert/ │      │ from filesystem   │      │ built by CLI      │  │
│  │ ingest via source │      │                   │      │                   │  │
│  │ packages          │      │                   │      │                   │  │
│  └────────┬──────────┘      └───────────────────┘      └────────┬──────────┘  │
│           │                       ▲ .md output                   ▲ database   │
│           │                       │                              │            │
│           │       CLI produces output that apps consume:         │            │
│           │       • .md files + _meta.json → web app             │            │
│           │       • SQLite DB → Data API                         │            │
│           │       Data boundary only — not a code dependency     │            │
│           │                                                                   │
├───────────┼───────────────────────────────────────────────────────────────────┤
│                           LAYER 2: SOURCE PACKAGES                            │
│                                                                               │
│  ┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐  │
│  │ @lexbuild/usc     │      │ @lexbuild/ecfr    │      │ @lexbuild/fr      │  │
│  │                   │      │                   │      │                   │  │
│  │ U.S. Code         │      │ eCFR (CFR)        │      │ Federal Register  │  │
│  │ USLM 1.0 XML      │      │ GPO/SGML XML      │      │ GPO XML + JSON    │  │
│  └────────┬──────────┘      └────────┬──────────┘      └────────┬──────────┘  │
│           │                          │                          │             │
│           └──────────────────────────┼──────────────────────────┘             │
│                                      │ each imports                           │
├──────────────────────────────────────┼────────────────────────────────────────┤
│                        LAYER 1: CORE INFRASTRUCTURE                           │
│                                      ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ @lexbuild/core                                                          │  │
│  │                                                                         │  │
│  │ SAX parser · AST types · Markdown renderer · Frontmatter generator      │  │
│  │ Link resolver · Resilient file I/O · DB schema constants                │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
```

## Layer 1: Core Infrastructure

[`@lexbuild/core`](packages/core/) provides format-agnostic building blocks shared by all source packages:

- **XML Parser** — Streaming SAX parser (via `saxes`) that keeps memory bounded even for 100 MB+ XML files
- **AST Types** — Typed node hierarchy: levels, content, inline, notes, tables, TOC
- **Markdown Renderer** — AST-to-Markdown conversion with configurable heading offsets, link styles, and note filtering
- **Frontmatter Generator** — Ordered YAML frontmatter from structured metadata
- **Link Resolver** — Cross-reference resolution with relative paths, canonical URLs, or plaintext fallbacks
- **Resilient File I/O** — `writeFile`/`mkdir` wrappers with exponential backoff on file descriptor exhaustion
- **DB Schema** — Shared SQLite schema definitions used by both CLI (write) and API (read)

## Layer 2: Source Packages

Each source package handles one XML format's complete pipeline: download, parse, build AST, and convert to Markdown. Source packages depend only on `@lexbuild/core` and never on each other. ESLint `no-restricted-imports` rules enforce this boundary at build time.

| Package | Source | XML Format | Download Sources |
|---------|--------|------------|-----------------|
| [`@lexbuild/usc`](packages/usc/) | U.S. Code | USLM 1.0 | OLRC bulk zip |
| [`@lexbuild/ecfr`](packages/ecfr/) | Code of Federal Regulations | eCFR GPO/SGML | eCFR API, govinfo bulk |
| [`@lexbuild/fr`](packages/fr/) | Federal Register | FR GPO/SGML + JSON | FederalRegister.gov API, govinfo bulk |

Each source package provides:

- **Downloader** — Fetches source data from official APIs or bulk endpoints
- **AST Builder** — SAX event handler that constructs typed AST nodes from the source's XML schema
- **Converter** — Orchestrates the pipeline: discover files, parse XML, build AST, render Markdown, write output

`@lexbuild/fr` additionally provides an **enricher** that patches YAML frontmatter in existing `.md` files with metadata from the FederalRegister.gov API, without re-parsing XML or re-rendering Markdown.

## Layer 3: Applications

### CLI Toolchain (`@lexbuild/cli`)

[`packages/cli/`](packages/cli/) is the published npm binary (`lexbuild`). It orchestrates download, conversion, and ingestion by delegating to source packages and manages the API key database.

Commands follow a `{action}-{source}` pattern:

| Command | Description |
|---------|-------------|
| `download-usc`, `download-ecfr`, `download-fr` | Fetch source XML from official endpoints |
| `convert-usc`, `convert-ecfr`, `convert-fr` | Convert XML to structured Markdown |
| `enrich-fr` | Patch FR frontmatter with API metadata |
| `ingest` | Build SQLite database from Markdown output |
| `api-key` | Manage API keys (create, list, revoke, update) |
| `list-release-points` | List available USC release points |

### Web Explorer (`apps/astro/`)

[`apps/astro/`](apps/astro/) is the public website at [lexbuild.dev](https://lexbuild.dev). It is an Astro 6 SSR application built with React 19 islands, Tailwind CSS 4, and shadcn/ui.

The app has no code dependency on any `@lexbuild/*` package. It reads `.md` files and `_meta.json` sidecar indexes produced by the CLI, making it fully decoupled from the conversion pipeline. Content is gitignored — generated by the CLI and deployed separately.

Key capabilities:

- Hierarchical browsing at every granularity level (title, chapter, part, section)
- Sidebar navigation with virtualized section lists for large titles
- Full-text search across all sources via Meilisearch with source filter tabs
- Markdown source view and rendered HTML preview, switchable per section
- Copy-to-clipboard and direct `.md` download at every hierarchy level
- Syntax-highlighted YAML frontmatter panel
- Dark mode with system preference detection

### Data API (`apps/api/`)

[`apps/api/`](apps/api/) is the REST API at [lexbuild.dev/api](https://lexbuild.dev/api/docs). It is a Hono-based application that serves legal content programmatically from a SQLite database built by `lexbuild ingest`.

The API depends on `@lexbuild/core` for shared schema types and key hashing utilities but has no dependency on any source package. The content database is read-only from the API's perspective and can be rebuilt and replaced without touching the API keys database.

Key capabilities:

- Document retrieval with content negotiation (JSON, Markdown, plaintext)
- Paginated collection listings with multi-field filtering, sorting, and cursor-based pagination
- Hierarchy browsing for USC/CFR titles and FR years/months
- Cross-source full-text search proxied through Meilisearch with faceted filtering
- Field selection and ETag caching for conditional requests
- API key authentication with PBKDF2 hashing and tiered rate limiting
- OpenAPI 3.1 specification with interactive Scalar documentation

## How the Layers Connect

```
                    BUILD TIME                                RUNTIME
                  (code imports)                           (data flow)

                  @lexbuild/cli                            CLI output
                  ┌─────┬─────┐                       ┌──────┬──────┐
                  │     │     │                        │      │      │
                  ▼     ▼     ▼                        ▼      │      ▼
                usc   ecfr   fr                      .md      │   SQLite
                  │     │     │                     files      │     DB
                  └──┬──┘     │                        │      │      │
                     │       ─┘                        │      │      │
                     ▼                                 ▼      │      ▼
                   core                              Web      │    Data
                                                     app      │     API
                                                              │
                                                              ▼
                                                        Search index
                                                      (shared by both)
```

1. **Source packages import core** — they use its SAX parser, AST types, renderer, and file I/O utilities.
2. **CLI imports source packages** — it delegates download and convert commands to the appropriate source package.
3. **CLI produces output consumed by apps** — `.md` files and `_meta.json` indexes for the web app; SQLite database for the API. This is a data boundary, not a code dependency.
4. **The API imports core minimally** — for shared schema types and key hashing only. The web app has zero package dependencies.
5. **Search is shared** — both the web app and the API query the same Meilisearch index for full-text search.

## Conversion Pipeline

The core pipeline is identical for every source:

```
Source XML → SAX events → Source-specific AST Builder → Typed AST nodes
  → Core Markdown Renderer → YAML frontmatter + Markdown body → .md file
```

1. **Download** — Fetch XML (and optionally JSON metadata) from official government sources.
2. **Parse** — Stream XML through the SAX parser, emitting events to a source-specific AST builder.
3. **Build AST** — The builder maintains a stack of frames, constructing typed nodes. When a complete unit (section, document) closes, it emits the subtree via callback and releases memory. This bounds memory to the depth of the document hierarchy, not the total file size.
4. **Render** — The core renderer walks the AST and produces Markdown with YAML frontmatter. Link resolution, note filtering, and heading offsets are applied at this stage.
5. **Write** — Output files are written to a hierarchy-based (USC, eCFR) or date-based (FR) directory structure with `_meta.json` sidecar indexes at each level.

## Adding New Sources

The multi-source architecture is proven by three independent implementations across two completely different XML schemas (USLM 1.0 and GPO/SGML). Adding a new source follows the established pattern:

1. Create `packages/<source>/` with a single dependency on `@lexbuild/core`.
2. Implement a SAX-based AST builder for the source's XML schema.
3. Implement download and convert functions.
4. Add CLI commands (`download-<source>`, `convert-<source>`).
5. Register the package in changesets and ESLint boundary rules.

New sources automatically work with both existing apps. Once the CLI produces `.md` output and the database is rebuilt with `ingest`, the web app and the API serve the new content without any application code changes.

Planned sources include the annual CFR (govinfo bulk XML), Congressional Bills and BILLSTATUS, state statutes, and CourtListener opinions.

## Dependency Graph

```
@lexbuild/cli
  ├── @lexbuild/usc  → @lexbuild/core
  ├── @lexbuild/ecfr → @lexbuild/core
  └── @lexbuild/fr   → @lexbuild/core

apps/api   → @lexbuild/core (shared schema types and key hashing utilities only)
apps/astro    (no package dependencies — consumes CLI output files only)
```

Source packages are independent and never import from each other. Each new source becomes its own `@lexbuild/<source>` package following the same pattern.

## Further Reading

- [`docs/architecture/`](docs/architecture/) — Detailed architecture documentation
- [`docs/packages/`](docs/packages/) — Per-package documentation
- [`docs/apps/`](docs/apps/) — Application documentation
- [`docs/reference/cli-reference.md`](docs/reference/cli-reference.md) — Complete CLI reference
