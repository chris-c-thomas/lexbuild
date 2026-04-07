# CLAUDE.md — @lexbuild/api

## Package Overview

`apps/api/` is the LexBuild Data API — a Hono-powered REST API that serves structured U.S. legal content from a SQLite database. It provides programmatic access to USC, CFR (eCFR-sourced), and Federal Register documents as Markdown or JSON, with content negotiation, pagination, and search proxy capabilities.

## Monorepo Integration

- **`"private": true`** — excluded from changesets and npm publishing
- **No default `build` task** — uses `build:api` (same exclusion pattern as Astro app)
- **Depends on `@lexbuild/core`** for shared schema types (`DocumentRow`, SQL constants)
- **Does NOT depend on** `@lexbuild/usc`, `@lexbuild/ecfr`, `@lexbuild/fr`, or `@lexbuild/cli`

## Module Structure

```
src/
├── index.ts              # Hono app entry point + server startup
├── app.ts                # Hono app factory (exported for testing)
├── middleware/
│   ├── request-id.ts      # UUID request tracing
│   ├── request-logger.ts  # Method/path/status/timing logs
│   ├── error-handler.ts   # Global error boundary → JSON
│   ├── cache-headers.ts   # Configurable Cache-Control
│   └── rate-limit.ts      # In-memory sliding window, tiered API key limits
├── routes/
│   ├── health.ts          # GET /api/health
│   ├── sources.ts         # GET /api/sources
│   ├── usc.ts             # USC document + listing endpoints
│   ├── cfr.ts             # CFR document + listing endpoints
│   ├── fr.ts              # FR document + listing endpoints
│   ├── search.ts          # Meilisearch proxy with faceted filtering
│   ├── hierarchy.ts       # Title/year/month browsing
│   └── stats.ts           # Corpus-wide statistics
├── db/
│   ├── client.ts          # Content database connection (read-only)
│   ├── queries.ts         # Parameterized query builder with column allowlists
│   └── keys.ts            # API keys SQLite schema, validation, usage tracking
├── schemas/
│   ├── documents.ts       # Document response schemas
│   ├── search.ts          # Search request/response schemas
│   ├── pagination.ts      # Shared pagination schemas
│   ├── filters.ts         # Source-specific filter schemas (USC/CFR/FR)
│   └── errors.ts          # Error response schemas
└── lib/
    ├── content-negotiation.ts
    ├── markdown-strip.ts   # Markdown to plaintext conversion
    ├── source-registry.ts  # API_SOURCES config, URL_TO_DB_SOURCE mapping
    ├── documents.ts        # Identifier resolution, metadata building, field selection
    └── listings.ts         # Collection response envelope builder
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `API_PORT` | `4322` | HTTP server port |
| `LEXBUILD_DB_PATH` | `<monorepo-root>/lexbuild.db` | Path to SQLite content database (auto-detected) |
| `LEXBUILD_KEYS_DB_PATH` | `<monorepo-root>/lexbuild-keys.db` | Path to API keys database (auto-detected) |
| `MEILI_URL` | `http://127.0.0.1:7700` | Meilisearch endpoint for search proxy |
| `MEILI_MASTER_KEY` | — | Meilisearch master key |
| `MEILI_SEARCH_KEY` | — | Meilisearch search-only API key |

## Databases

Two separate SQLite databases:
- **Content DB** (`LEXBUILD_DB_PATH`): Read-only from API. Schema shared with CLI via `@lexbuild/core/db/schema`. Rebuilt by `lexbuild ingest`.
- **Keys DB** (`LEXBUILD_KEYS_DB_PATH`): Read-write. Stores API key hashes, rate limits, usage tracking. Persists across content re-ingestion. Auto-created on first use.

## Port Assignment

- **4321**: Astro app (production)
- **4322**: Data API

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Hono (lightweight, edge-compatible) |
| HTTP Server | `@hono/node-server` (Node.js adapter) |
| Validation | Zod + `@hono/zod-openapi` |
| Database | `better-sqlite3` (SQLite) |
| Search | Meilisearch client (search proxy) |
| Build | tsup (bundled, except native bindings) |
| Dev | tsx (watch mode) |

## Build and Run

```bash
# Build
pnpm turbo build:api --filter=@lexbuild/api

# Dev server with watch
pnpm turbo dev:api --filter=@lexbuild/api

# Production start (after build)
node apps/api/dist/index.js
```

## Ingest Command

The `lexbuild ingest` CLI command (in `packages/cli/`) populates the SQLite database:

```bash
lexbuild ingest ./output --db ./lexbuild.db                    # Full ingest
lexbuild ingest ./output --db ./lexbuild.db --source fr --incremental  # Incremental FR only
lexbuild ingest ./output --db ./lexbuild.db --prune            # Remove deleted files
```

- Uses SHA-256 content hashing for incremental change detection
- Batch upserts in SQLite transactions (default 1000 docs/batch)
- WAL mode for concurrent read access
- `gray-matter` with `{ cache: false }` to prevent memory leaks on 1M+ files

## Implemented Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check with DB stats |
| GET | `/api/sources` | Source metadata with live counts |
| GET | `/api/openapi.json` | OpenAPI 3.1 spec |
| GET | `/api/docs` | 301 redirect to `/docs/api` (Astro) |
| GET | `/api/stats` | Corpus-wide statistics |
| GET | `/api/search` | Cross-source Meilisearch proxy with facets |
| GET | `/api/usc/documents` | List/filter/sort USC sections |
| GET | `/api/usc/documents/{identifier}` | Single USC document |
| GET | `/api/usc/titles` | USC title listing with counts |
| GET | `/api/usc/titles/{number}` | Title detail + chapters |
| GET | `/api/cfr/documents` | List/filter/sort CFR sections |
| GET | `/api/cfr/documents/{identifier}` | Single CFR document |
| GET | `/api/cfr/titles` | CFR title listing with counts |
| GET | `/api/cfr/titles/{number}` | Title detail + chapters |
| GET | `/api/fr/documents` | List/filter/sort FR documents |
| GET | `/api/fr/documents/{identifier}` | Single FR document |
| GET | `/api/fr/years` | FR year listing with counts |
| GET | `/api/fr/years/{year}` | Year detail + months |
| GET | `/api/fr/years/{year}/{month}` | Month document listing |

Document endpoints support: content negotiation, field selection, ETag caching, per-source Cache-Control.
Listing endpoints support: offset/cursor pagination, multi-field filtering, sorting.
All endpoints: API key auth (optional), tiered rate limiting, X-RateLimit headers.

## Common Pitfalls

- **`better-sqlite3` requires build approval**: Must be listed in root `package.json` under `pnpm.onlyBuiltDependencies`. Without it, `pnpm install` skips native compilation and the module fails at runtime.
- **`better-sqlite3` is platform-specific**: macOS binaries won't work on Linux. The VPS must run `pnpm install` or `pnpm rebuild better-sqlite3` after deployment.
- **tsup `noExternal` regex overrides `external` array**: `noExternal: [/(.*)/]` with `external: ["better-sqlite3"]` does NOT work. Use a negative lookahead: `noExternal: [/^(?!better-sqlite3|bindings|file-uri-to-path|@lexbuild\/)/]`.
- **ESM bundle needs CJS shims for native modules**: The bundled ESM output needs `createRequire`, `__filename`, and `__dirname` provided via tsup `banner` for `better-sqlite3` and its `bindings` dependency to resolve native `.node` files.
- **`/api/docs` redirects to `/docs/api`**: The standalone Scalar API reference was moved to the Astro app. The Hono endpoint is a 301 redirect. `@scalar/hono-api-reference` is no longer used.
- **Hono `createMiddleware` + `noImplicitReturns`**: If the middleware catch block returns a Response, the try block must also have an explicit `return`. Use a named function returning `MiddlewareHandler` instead of arrow + `createMiddleware` to avoid this.
- **CFR source mapping**: API URL uses `/cfr/` but database stores `source = "ecfr"`. `URL_TO_DB_SOURCE` in `lib/source-registry.ts` handles this translation. Always use it for DB queries.
- **`noUncheckedIndexedAccess` on `URL_TO_DB_SOURCE`**: `URL_TO_DB_SOURCE["usc"]` returns `string | undefined`. Use `?? "usc"` fallback when passing to typed function params.
- **`exactOptionalPropertyTypes` on `cursor?: string`**: `string | undefined` (from Zod schema) can't be assigned to `cursor?: string`. Use `cursor?: string | undefined` on the receiving interface.
- **OpenAPIHono 404 return type unions**: `c.json(data, 404)` in a handler that also returns `c.json(data, 200)` creates `_status: 200 | 404` which fails type checking. Fix: throw `HTTPException(404)` instead (caught by error handler middleware), or pass explicit `200` status to `c.json()` on the success path.
- **Zod `.default()` doesn't narrow destructured type**: `sort: z.string().optional().default("identifier")` still types as `string | undefined` when destructured from `c.req.valid("query")`. Use `sort = "identifier"` in destructuring AND `sort ?? "identifier"` when passing to typed functions.
- **Keys DB is separate from content DB**: Never put in the same directory as content DB if content is rebuilt/replaced. Keys must persist.
- **VPS needs `build-essential`**: `better-sqlite3` has no prebuilt binaries for Node 25. `sudo apt-get install -y build-essential` is required once on the VPS.
- **First PM2 deploy uses `pm2 start`, not `pm2 reload`**: The deploy script's `--api` mode uses `pm2 reload` which fails for new processes. First deploy: `pm2 start apps/astro/ecosystem.config.cjs --only lexbuild-api && pm2 save`.
- **DB paths auto-resolve from monorepo root**: The entry point walks up from its own location to find `pnpm-workspace.yaml` and resolves `LEXBUILD_DB_PATH` and `LEXBUILD_KEYS_DB_PATH` defaults relative to that root. No inline env var needed for local dev.
- **API routes use `/api/` not `/api/v1/`**: Versioned prefix was removed since new sources are additive, not breaking.
