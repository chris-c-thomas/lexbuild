---
applyTo: "apps/api/**/*.ts"
---

# Data API Instructions

These instructions apply to the LexBuild Data API in `apps/api/`.

- Read `apps/api/CLAUDE.md` before making structural or route-level changes.
- Preserve the current architecture:
  - Hono + `@hono/zod-openapi`
  - SQLite via `better-sqlite3`
  - shared schema/types from `@lexbuild/core`
  - Meilisearch proxy for search
- `apps/api` is private and intentionally excluded from the default monorepo build. Use `build:api` and `dev:api`; do not add a plain `build` script.
- Keep package boundaries intact:
  - allowed: `@lexbuild/core`
  - not allowed: `@lexbuild/usc`, `@lexbuild/ecfr`, `@lexbuild/fr`, `@lexbuild/cli`, or direct converter logic
- API routes live under `/api/`, not `/api/v1/`.
- CFR endpoints use `/api/cfr/` in the URL surface even though the stored source value is `ecfr`. Use the source-registry mapping rather than hardcoding assumptions.
- The interactive API reference lives in the Astro app. `/api/docs` should remain a redirect target, not a separate embedded docs system.
- Treat OpenAPI as a first-class contract. When changing route inputs or outputs, update the Zod schemas and keep the generated spec consistent.
- Prefer existing helpers for content negotiation, pagination, listings, and document metadata instead of re-implementing response shaping in route handlers.
- The content database is read-only from the API. API keys use a separate read-write SQLite database. Do not mix the two concerns.
- `better-sqlite3` is native and platform-specific. Avoid build or bundling changes that would break the existing native-module setup.
- Search changes should stay aligned with the Astro search client and current Meilisearch proxy behavior.
- Keep middleware ordering intentional. Request ID, logging, error handling, and rate limiting are part of the API contract and observability path.
