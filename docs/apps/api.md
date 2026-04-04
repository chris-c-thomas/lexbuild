# Data API

The [LexBuild API](https://lexbuild.dev/api/docs) is a REST API built with [Hono](https://hono.dev) for programmatic access to over one million U.S. legal documents. It serves the U.S. Code, Code of Federal Regulations, and Federal Register as JSON, Markdown, or plaintext from a SQLite database, with full text search powered by Meilisearch.

The API depends on `@lexbuild/core` for shared database schema types and key hashing utilities. It has no code dependency on source packages (`@lexbuild/usc`, `@lexbuild/ecfr`, `@lexbuild/fr`) or the CLI. It is a private package excluded from changesets and the main Turborepo build.

## Tech Stack

| Technology | Role |
|---|---|
| [Hono](https://hono.dev) | HTTP framework with middleware composition |
| [@hono/node-server](https://hono.dev/docs/getting-started/nodejs) | Node.js HTTP adapter |
| [Zod](https://zod.dev) + [@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) | Request validation and OpenAPI 3.1 spec generation |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | SQLite driver for content and key databases |
| [Meilisearch](https://www.meilisearch.com) | Full text search engine (proxied through the API) |
| [Scalar](https://scalar.com) | Interactive API reference UI |
| [tsup](https://tsup.egoist.dev) | ESM bundler (native bindings excluded) |

## Architecture

### Two-Database Design

The API uses two separate SQLite databases with different lifecycles:

**Content database** (`lexbuild.db`): Stores all document metadata, YAML frontmatter, and Markdown body text in a single denormalized `documents` table. Opened in read-only mode by the API. Rebuilt from scratch by the `lexbuild ingest` CLI command and transferred to the VPS via `deploy.sh --api-db`.

**Keys database** (`lexbuild-keys.db`): Stores API key hashes (PBKDF2), rate limit configurations, and usage tracking. Opened in read-write mode. Auto-created on first use and persists across content database rebuilds.

### Middleware Stack

Every request passes through five middleware layers in order:

1. **Request ID**: Assigns a UUID (or forwards `X-Request-ID` from the client) for tracing
2. **Request Logger**: Logs method, path, status, and response time
3. **CORS**: Allows all origins
4. **Error Handler**: Catches unhandled errors, logs stack traces for 500s, returns structured JSON
5. **Rate Limiter**: Validates API keys, applies tiered rate limits, sets `X-RateLimit-*` headers

### Source Registry

The API maps three content sources to URL prefixes: `/usc/` for U.S. Code, `/cfr/` for Code of Federal Regulations, and `/fr/` for Federal Register. The CFR mapping is notable because the database stores the source as `ecfr` (the data source) while the API uses `cfr` (the content type). The `toApiSource()` and `toDbSource()` helper functions in `lib/source-registry.ts` handle this translation.

### Search Proxy

The search endpoint (`/api/search`) proxies queries to a local Meilisearch instance rather than exposing Meilisearch directly. This provides a stable interface with Zod-validated parameters, source filtering (the API translates `cfr` to `ecfr` in Meilisearch filters), and structured responses with facet distributions and highlighted snippets.

## Endpoints

Full interactive documentation with request testers is available at [lexbuild.dev/api/docs](https://lexbuild.dev/api/docs).

### System

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check with database connection status and document count |
| GET | `/api/sources` | Source metadata with live document counts per source |
| GET | `/api/stats` | Corpus statistics: per-source document counts, title counts, date ranges, document type distributions |
| GET | `/api/openapi.json` | OpenAPI 3.1 specification |
| GET | `/api/docs` | Scalar API reference UI |

### Documents

| Method | Path | Description |
|---|---|---|
| GET | `/api/usc/documents` | Paginated listing of USC sections with filtering and sorting |
| GET | `/api/usc/documents/{identifier}` | Single USC section by identifier (e.g., `t1/s1`) |
| GET | `/api/cfr/documents` | Paginated listing of CFR sections with filtering and sorting |
| GET | `/api/cfr/documents/{identifier}` | Single CFR section by identifier (e.g., `t17/s240.10b-5`) |
| GET | `/api/fr/documents` | Paginated listing of FR documents with filtering and sorting |
| GET | `/api/fr/documents/{identifier}` | Single FR document by document number (e.g., `2026-06029`) |

Document retrieval supports three response formats:

| Format | Content-Type | Triggered By |
|---|---|---|
| JSON | `application/json` | Default, or `?format=json` |
| Markdown | `text/markdown` | `?format=markdown` or `Accept: text/markdown` |
| Plaintext | `text/plain` | `?format=text` or `Accept: text/plain` |

The JSON format returns a response envelope with metadata and body content. Use `?fields=metadata` for metadata only (no body) or `?fields=title_name,section_number` for specific fields. Responses include `ETag` headers derived from content hashes. Clients can send `If-None-Match` to receive 304 responses for unchanged content.

Listing endpoints support `?limit=` and `?offset=` for offset pagination, `?cursor=` for keyset pagination, source-specific filter parameters (e.g., `?title_number=1`, `?document_type=rule`, `?agency=EPA`), and `?sort=` with optional `-` prefix for descending order.

### Hierarchy

| Method | Path | Description |
|---|---|---|
| GET | `/api/usc/titles` | All USC titles with document and chapter counts |
| GET | `/api/usc/titles/{number}` | Title metadata and chapter listing |
| GET | `/api/cfr/titles` | All CFR titles with document and chapter counts |
| GET | `/api/cfr/titles/{number}` | Title metadata and chapter listing |
| GET | `/api/fr/years` | All publication years with document counts |
| GET | `/api/fr/years/{year}` | Month breakdown for a given year |
| GET | `/api/fr/years/{year}/{month}` | All documents published in a given month |

### Search

| Method | Path | Description |
|---|---|---|
| GET | `/api/search` | Full text search across all sources |

Search parameters include `?q=` (required query text), `?source=` (limit to one source), `?document_type=`, `?agency=`, `?date_from=`, `?date_to=`, `?facets=` (comma-separated list: `source`, `document_type`, `agency`, `status`), `?highlight=true|false`, and `?sort=` (relevance by default, or `publication_date`, `title_number`, `identifier`).

## Authentication and Rate Limiting

All endpoints are accessible without authentication at the anonymous tier (100 requests per minute per IP). Higher rate limits require an API key passed via the `X-API-Key` header or as a Bearer token.

| Tier | Rate Limit | Description |
|---|---|---|
| Anonymous | 100 req/min | No key required |
| Standard | 1,000 req/min | Default for new keys |
| Elevated | 5,000 req/min | Manually upgraded |
| Unlimited | No limit | Internal and admin use |

Rate limiting uses an in-memory sliding window counter. Every response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `X-RateLimit-Policy` headers. Exceeding the limit returns 429 with a `Retry-After` header.

API keys are managed via the CLI:

```bash
lexbuild api-key create --label "Research Project"
lexbuild api-key list
lexbuild api-key revoke --prefix lxb_a1b2c3d4
```

Keys use the `lxb_` prefix followed by 40 hex characters. The plaintext key is displayed once at creation. Keys are stored as PBKDF2 hashes in the keys database.

## Development

### Prerequisites

- Node.js >= 22, pnpm >= 10
- Built monorepo packages (`pnpm turbo build`)
- Converted content in `output/` (at least one source)

### Setup

```bash
# From the monorepo root
pnpm turbo build
node packages/cli/dist/index.js convert-usc --titles 1
node packages/cli/dist/index.js ingest ./output --db ./lexbuild.db
LEXBUILD_DB_PATH=./lexbuild.db pnpm turbo dev:api --filter=@lexbuild/api
```

Open [http://localhost:4322/api/docs](http://localhost:4322/api/docs) for the interactive API reference.

### Build

```bash
pnpm turbo build:api --filter=@lexbuild/api
node apps/api/dist/index.js
```

The app uses `build:api` (not `build`) to prevent inclusion in the default Turborepo build pipeline. This matches the pattern used by the Astro app.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `API_PORT` | `4322` | HTTP server port |
| `LEXBUILD_DB_PATH` | `./lexbuild.db` | Path to content database |
| `LEXBUILD_KEYS_DB_PATH` | `./lexbuild-keys.db` | Path to API keys database |
| `MEILI_URL` | `http://127.0.0.1:7700` | Meilisearch endpoint |
| `MEILI_MASTER_KEY` | — | Meilisearch master key |
| `MEILI_SEARCH_KEY` | — | Meilisearch search-only key |

## Module Structure

```
apps/api/src/
├── index.ts                   Entry point, server startup, graceful shutdown
├── app.ts                     Hono app factory (exported for testing)
├── middleware/
│   ├── request-id.ts          UUID request tracing
│   ├── request-logger.ts      Method/path/status/timing logs
│   ├── error-handler.ts       Global error boundary returning JSON
│   ├── cache-headers.ts       Configurable Cache-Control headers
│   └── rate-limit.ts          Sliding window rate limiter with API key validation
├── routes/
│   ├── health.ts              Health check endpoint
│   ├── sources.ts             Source metadata endpoint
│   ├── stats.ts               Corpus statistics endpoint
│   ├── usc.ts                 USC document and listing endpoints
│   ├── cfr.ts                 CFR document and listing endpoints
│   ├── fr.ts                  FR document and listing endpoints
│   ├── hierarchy.ts           Title, year, and month browsing endpoints
│   └── search.ts              Meilisearch search proxy
├── db/
│   ├── client.ts              Content database connection (read-only)
│   ├── queries.ts             Parameterized query builder with column allowlists
│   └── keys.ts                API key database, validation, and usage tracking
├── schemas/
│   ├── documents.ts           Document response and query schemas
│   ├── errors.ts              Error response schema
│   ├── filters.ts             Source-specific filter schemas
│   ├── pagination.ts          Pagination and collection response schemas
│   └── search.ts              Search query and result schemas
└── lib/
    ├── content-negotiation.ts Format resolution from Accept header or query param
    ├── markdown-strip.ts      Regex-based Markdown to plaintext conversion
    ├── source-registry.ts     Source configuration, API/DB source translation
    ├── documents.ts           Identifier resolution, metadata building, field selection
    └── listings.ts            Collection response envelope builder
```

## Deployment

The API runs as a PM2 process (`lexbuild-api`) on port 4322 behind Caddy, which proxies `/api/*` requests to it. Three deploy modes are available from the monorepo root:

| Command | Action |
|---|---|
| `./scripts/deploy.sh --api` | Code deploy: git pull, pnpm install, build, pm2 reload |
| `./scripts/deploy.sh --api-db` | Database sync: zstd compress, rsync, atomic stop/swap/start |
| `./scripts/deploy.sh --api-full` | Both code and database |

The database sync compresses the local SQLite file (~11 GB to ~1.5 GB with zstd), transfers it to `/srv/lexbuild/data/lexbuild.db` on the VPS, stops the API, replaces the file, and restarts.

## Key Design Decisions

**No version prefix**: Routes use `/api/` instead of `/api/v1/`. New content sources are additive and do not require breaking changes to existing endpoints.

**Section as the atomic unit**: The API serves individual sections (the smallest citable legal unit), matching the same atomic unit used by the conversion pipeline. Higher-level aggregation is provided through listing and hierarchy endpoints.

**Read-only content database**: The API never writes to the content database. The `lexbuild ingest` CLI command is the sole writer, and the database is transferred as a complete file rather than incrementally updated on the server.

**Separate keys database**: API keys persist independently of content rebuilds. The keys database is auto-created on first use and lives alongside the content database at `/srv/lexbuild/data/`.
