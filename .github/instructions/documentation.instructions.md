---
applyTo: "**/*.{md,mdx}"
---

# Documentation Instructions

These instructions apply to documentation, guides, READMEs, changelogs, and `CLAUDE.md` files.

Generated legal corpus files under `downloads/`, `output/`, `output-chapter/`, `output-part/`, `output-title/`, and `apps/astro/content/` are not documentation and should not be edited unless the task explicitly targets generated artifacts.

- Prefer the nearest authoritative source before rewriting prose:
  - repo-wide context: `README.md`, `CLAUDE.md`
  - package or app context: the closest `CLAUDE.md`, `README.md`, and `package.json`
- Keep prose direct, factual, and technical. Avoid filler, hype, and marketing language.
- Use `LexBuild` in prose. Use `lexbuild` only for package names, commands, URLs, paths, and code identifiers.
- Keep commands, ports, package names, and workspace filters aligned with the current repo state:
  - Node.js `>=22`
  - pnpm `>=10`
  - workspace names like `@lexbuild/astro`, `@lexbuild/api`, and `@lexbuild/mcp`
  - current CLI commands including USC, eCFR, FR, `enrich-fr`, `ingest`, and `api-key`
- Prefer linking readers to the relevant package or app `CLAUDE.md` when deep implementation detail already exists there instead of duplicating that content.
- If you add, remove, or reorder docs pages in `apps/astro/src/content/docs/`, also update `apps/astro/src/lib/docs-nav.ts`.
- Docs pages in `apps/astro/src/content/docs/` must keep valid content-collection frontmatter:
  - `title: string`
  - `description: string`
  - `order: number` when ordering matters
  - optional `badge`
  - optional `hidden`
- Keep terminology consistent across docs:
  - `U.S. Code`
  - `eCFR`
  - `Federal Register`
  - `Data API`
  - `MCP server`
  - `Astro app` or `web app` as appropriate
- When documenting search, reflect the current architecture:
  - Astro provides the browser UI
  - Meilisearch powers indexing and retrieval
  - the API provides proxy behavior
- For API and MCP docs, use the current public surface names and routes:
  - API paths use `/api/`
  - CFR endpoints use `/api/cfr/`
  - the interactive API reference lives in the docs site
- Update examples and surrounding prose together. Do not change commands in one place and leave contradictory text nearby.