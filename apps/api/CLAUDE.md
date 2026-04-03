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
├── middleware/            # Rate limiting, auth, error handling, caching
├── routes/               # Route modules by source
│   ├── health.ts         # GET /api/v1/health
│   ├── sources.ts        # GET /api/v1/sources
│   ├── usc.ts            # USC endpoints
│   ├── cfr.ts            # CFR endpoints (eCFR-sourced)
│   ├── fr.ts             # FR endpoints
│   └── search.ts         # Cross-source search
├── db/                   # SQLite database layer
│   ├── client.ts         # Database connection management
│   ├── schema.ts         # Schema creation + migrations
│   └── queries.ts        # Prepared statement wrappers
├── schemas/              # Zod schemas for request/response validation
│   ├── documents.ts      # Document response schemas
│   ├── search.ts         # Search request/response schemas
│   ├── pagination.ts     # Shared pagination schemas
│   └── errors.ts         # Error response schemas
└── lib/                  # Utilities
    ├── content-negotiation.ts
    ├── etag.ts
    ├── markdown-strip.ts  # Markdown to plaintext conversion
    └── constants.ts
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4322` | HTTP server port |
| `DATABASE_PATH` | `./data/lexbuild.db` | Path to SQLite database file |
| `MEILI_URL` | `http://127.0.0.1:7700` | Meilisearch endpoint for search proxy |
| `MEILI_SEARCH_KEY` | — | Meilisearch search-only API key |
| `API_RATE_LIMIT` | `100` | Requests per minute per IP |

## Database

- **Engine**: SQLite via `better-sqlite3` (synchronous, native bindings)
- **Schema**: Shared with `@lexbuild/cli` ingest command via `@lexbuild/core/db/schema`
- **Location**: Configurable via `DATABASE_PATH`, default `./data/lexbuild.db`
- **Population**: The CLI `ingest` command writes to the database; the API only reads

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

## Common Pitfalls

- **`better-sqlite3` requires build approval**: Must be listed in root `package.json` under `pnpm.onlyBuiltDependencies`. Without it, `pnpm install` skips native compilation and the module fails at runtime.
- **`better-sqlite3` is platform-specific**: macOS binaries won't work on Linux. The VPS must run `pnpm install` or `pnpm rebuild better-sqlite3` after deployment.
