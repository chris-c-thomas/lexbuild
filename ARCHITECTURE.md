# Architecture

LexBuild is a layered monorepo that separates format-agnostic infrastructure from source-specific conversion logic. The architecture is designed to scale horizontally — each new legal source becomes its own package while sharing a common core.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Applications & CLI                              │
│                                                                        │
│  @lexbuild/cli                         apps/astro                      │
│  ┌───────────┐  ┌───────────┐          ┌──────────────────────┐        │
│  │ download  │  │ convert   │          │ Astro SSR site       │        │
│  └─────┬─────┘  └─────┬─────┘          │ (consumes output     │        │
│        │               │               │  files, not packages)│        │
│        │               │               └──────────────────────┘        │
├────────┼───────────────┼───────────────────────────────────────────────┤
│        │          Source Packages                                      │
│        │               │                                               │
│        ▼               ▼                                               │
│  ┌──────────┐   ┌─────────────────────────────┐                        │
│  │  OLRC    │   │    Conversion Pipeline       │   (future:            │
│  │  Client  │   │                              │    @lexbuild/cfr,     │
│  └──────────┘   │  Collect → Render → Write    │    @lexbuild/state-*) │
│  (@lexbuild/    │                              │                       │
│    usc)         └──────────┬───────────────────┘                       │
│                            │                                           │
├────────────────────────────┼───────────────────────────────────────────┤
│                       Core Infrastructure                              │
│                            │                                           │
│       ┌────────────────────┼───────────────────────┐                   │
│       ▼                    ▼                       ▼                   │
│  ┌──────────┐     ┌───────────────┐     ┌───────────────────┐          │
│  │   XML    │     │     AST       │     │    Markdown       │          │
│  │  Parser  │     │   Builder     │     │    Renderer       │          │
│  │  (SAX)   │     │  (section     │     │  + Frontmatter    │          │
│  │          │     │   emit)       │     │  + Link Resolver  │          │
│  └──────────┘     └───────────────┘     └───────────────────┘          │
│  (@lexbuild/core)   (@lexbuild/core)       (@lexbuild/core)            │
└────────────────────────────────────────────────────────────────────────┘
```

**Three layers:**

1. **Core Infrastructure** (`@lexbuild/core`) — Format-agnostic XML parsing, AST construction, Markdown rendering, frontmatter generation, and cross-reference link resolution. Shared by all source packages.

2. **Source Packages** (`@lexbuild/usc`, future `@lexbuild/cfr`, etc.) — Source-specific conversion logic. Each package orchestrates the pipeline for its source's XML format: download, parse, build AST, render, write files.

3. **Applications & CLI** (`@lexbuild/cli`, `apps/astro/`) — User-facing tools. The CLI delegates all heavy lifting to source packages. The Astro app consumes the converted output files directly.

For the full architecture documentation, see [`docs/architecture/`](docs/architecture/)
