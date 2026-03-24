# Architecture

LexBuild is a layered monorepo that separates format-agnostic infrastructure from source-specific conversion logic. The architecture is designed to scale horizontally — each new legal source becomes its own package while sharing a common core.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 3: Applications & CLI                                        │
│                                                                     │
│  @lexbuild/cli                        apps/astro                    │
│  ┌──────────────────────────┐         ┌──────────────────────────┐  │
│  │  download-usc            │         │  Astro 6 SSR site        │  │
│  │  convert-usc             │         │  (lexbuild.dev)          │  │
│  │  download-ecfr           │         │                          │  │
│  │  convert-ecfr            │         │  Consumes output files,  │  │
│  │  list-release-points     │         │  not packages            │  │
│  └──────────┬───────────────┘         └──────────────────────────┘  │
│             │                                                       │
├─────────────┼───────────────────────────────────────────────────────┤
│  Layer 2:   │ Source Packages                                       │
│             │                                                       │
│  ┌──────────┴──────────┐  ┌─────────────────────┐  ┌────────────┐  │
│  │  @lexbuild/usc      │  │  @lexbuild/ecfr     │  │  future    │  │
│  │                     │  │                     │  │  packages  │  │
│  │  OLRC downloader    │  │  eCFR API/govinfo   │  │  ...       │  │
│  │  Conversion pipeline│  │  downloader         │  │            │  │
│  │  (uses core's       │  │  EcfrASTBuilder     │  │            │  │
│  │   ASTBuilder)       │  │  Conversion pipeline│  │            │  │
│  └──────────┬──────────┘  └──────────┬──────────┘  └─────┬──────┘  │
│             │                        │                    │         │
├─────────────┼────────────────────────┼────────────────────┼─────────┤
│  Layer 1:   │ Core Infrastructure    │                    │         │
│             │                        │                    │         │
│  ┌──────────┴────────────────────────┴────────────────────┴──────┐  │
│  │  @lexbuild/core                                              │  │
│  │                                                              │  │
│  │  XML Parser (SAX)  ·  AST Builder (USLM)  ·  AST Types      │  │
│  │  Markdown Renderer ·  Frontmatter Generator                  │  │
│  │  Link Resolver     ·  Resilient File I/O                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Three layers:**

1. **Core Infrastructure** (`@lexbuild/core`) — Format-agnostic XML parsing, AST construction, Markdown rendering, frontmatter generation, cross-reference link resolution, and resilient file I/O. Shared by all source packages.

2. **Source Packages** (`@lexbuild/usc`, `@lexbuild/ecfr`) — Source-specific conversion logic. Each package orchestrates the pipeline for its source's XML format: download, parse, build AST, render, write files. Source packages depend only on core, never on each other.

3. **Applications & CLI** (`@lexbuild/cli`, `apps/astro/`) — User-facing tools. The CLI delegates all heavy lifting to source packages. The Astro app consumes the converted output files directly — it has no code dependency on any `@lexbuild/*` package.

For the full architecture documentation, see [`docs/architecture/`](docs/architecture/)
