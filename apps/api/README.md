# LexBuild API

The REST API for [LexBuild](https://github.com/chris-c-thomas/LexBuild), providing structured access to over one million U.S. legal documents including the U.S. Code (54 titles), Code of Federal Regulations (50 titles), and Federal Register (rules, notices, and presidential documents dating back to 2000). Content is available as JSON with rich metadata, raw Markdown, or stripped plaintext, with full text search, faceted filtering, and paginated listings.

**Production:** [lexbuild.dev/docs/api](https://lexbuild.dev/docs/api) (interactive API reference)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Hono](https://hono.dev/) (lightweight, edge-compatible) |
| HTTP Server | `@hono/node-server` (Node.js adapter) |
| Validation | [Zod](https://zod.dev/) + `@hono/zod-openapi` (auto-generated OpenAPI 3.1 spec) |
| Content Database | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (SQLite, read-only) |
| Search | [Meilisearch](https://www.meilisearch.com/) client (search proxy) |
| API Docs | [Scalar](https://scalar.com/) via `@scalar/api-reference-react` (embedded in Astro app) |
| Build | [tsup](https://tsup.egoist.dev/) (bundled ESM, except native bindings) |
| Dev | [tsx](https://tsx.is/) (watch mode) |

## Prerequisites

- **Node.js** >= 22
- **pnpm** >= 10
- **Populated SQLite database** created by `lexbuild ingest` (see Local Development below)
- **Meilisearch** running on port 7700 (for the search endpoint; other endpoints work without it)

## Local Development

### 1. Build Packages and Convert Content

```bash
# From the monorepo root
pnpm turbo build
node packages/cli/dist/index.js convert-usc --all
node packages/cli/dist/index.js convert-ecfr --all
node packages/cli/dist/index.js convert-fr --all
```

### 2. Ingest Content into SQLite

```bash
node packages/cli/dist/index.js ingest ./output --db ./lexbuild.db
```

This walks all `.md` files in `output/`, parses their YAML frontmatter, and populates a SQLite database with metadata and content. With the full corpus (~1M documents), ingestion takes approximately four minutes.

### 3. Start the Dev Server

```bash
pnpm turbo dev:api --filter=@lexbuild/api
```

### 4. Open the API Reference

Navigate to [http://localhost:4321/docs/api](http://localhost:4321/docs/api) for the interactive API reference (requires the Astro dev server). The old `/api/docs` path redirects there automatically.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `API_PORT` | `4322` | HTTP server port |
| `LEXBUILD_DB_PATH` | `<monorepo-root>/lexbuild.db` | Path to SQLite content database (auto-detected) |
| `LEXBUILD_KEYS_DB_PATH` | `<monorepo-root>/lexbuild-keys.db` | Path to API keys database (auto-detected) |
| `MEILI_URL` | `http://127.0.0.1:7700` | Meilisearch endpoint for search proxy |
| `MEILI_MASTER_KEY` | — | Meilisearch master key |
| `MEILI_SEARCH_KEY` | — | Meilisearch search-only API key |

## Endpoints

Full interactive documentation is available at [`/docs/api`](https://lexbuild.dev/docs/api). The following table provides a quick reference.

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check with database stats |
| GET | `/api/sources` | Source metadata with live document counts |
| GET | `/api/stats` | Corpus-wide statistics |
| GET | `/api/search` | Cross-source full text search with faceted filtering |
| GET | `/api/openapi.json` | OpenAPI 3.1 specification |
| GET | `/api/docs` | 301 redirect to `/docs/api` |
| GET | `/api/usc/documents` | List and filter USC sections |
| GET | `/api/usc/documents/{identifier}` | Retrieve a single USC section |
| GET | `/api/usc/titles` | List all USC titles with document counts |
| GET | `/api/usc/titles/{number}` | Title detail with chapter listing |
| GET | `/api/cfr/documents` | List and filter CFR sections |
| GET | `/api/cfr/documents/{identifier}` | Retrieve a single CFR section |
| GET | `/api/cfr/titles` | List all CFR titles with document counts |
| GET | `/api/cfr/titles/{number}` | Title detail with chapter listing |
| GET | `/api/fr/documents` | List and filter FR documents |
| GET | `/api/fr/documents/{identifier}` | Retrieve a single FR document |
| GET | `/api/fr/years` | List all FR years with document counts |
| GET | `/api/fr/years/{year}` | Year detail with month listing |
| GET | `/api/fr/years/{year}/{month}` | Month detail with document listing |

Document endpoints support content negotiation (`?format=json|markdown|text` or `Accept` header), field selection (`?fields=metadata|body|field1,field2`), and ETag caching (`If-None-Match` returns 304). Listing endpoints support offset and cursor pagination, multi-field filtering, and configurable sort order.

## Authentication

All endpoints work without authentication at the anonymous rate limit (100 requests per minute per IP). For higher limits, pass an API key via the `X-API-Key` header or as a Bearer token in the `Authorization` header.

| Tier | Rate Limit | Description |
|---|---|---|
| Anonymous | 100 req/min | No API key required |
| Standard | 1,000 req/min | Default tier for new keys |
| Elevated | 5,000 req/min | Manually upgraded keys |
| Unlimited | No limit | Internal and admin keys |

Create and manage API keys with the CLI:

```bash
lexbuild api-key create --label "My Research Project"
lexbuild api-key list
lexbuild api-key revoke --prefix lxb_a1b2c3d4
```

Every response includes rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `X-RateLimit-Policy`.

## Architecture

The API uses two separate SQLite databases. The **content database** stores all document metadata and Markdown body text, opened in read-only mode. It is rebuilt from scratch by `lexbuild ingest` and can be replaced without affecting API keys. The **keys database** stores API key hashes, rate limits, and usage tracking. It persists across content rebuilds and is auto-created on first use.

Search is handled by proxying requests to a local Meilisearch instance. The API translates query parameters into Meilisearch filter expressions, forwards the query, and returns structured results with optional facet distributions and highlighted snippets.

The middleware stack processes every request in order: request ID assignment, request logging, CORS, error handling, and tiered rate limiting with API key validation.

## Build

```bash
pnpm turbo build:api --filter=@lexbuild/api
node apps/api/dist/index.js
```

This app is intentionally excluded from the default `pnpm turbo build` pipeline. It has no `build` script in `package.json`, only `build:api`. This prevents CI failures since the app requires a populated SQLite database that is not in git.

## Deployment

The API runs as a PM2 process (`lexbuild-api`) on port 4322. Caddy reverse proxies `/api/*` to it. Deploy from the monorepo root:

```bash
./scripts/deploy.sh --api          # Code only (git pull, build, pm2 reload)
./scripts/deploy.sh --api-db       # Sync content database to VPS
./scripts/deploy.sh --api-full     # Code and database together
```

The database sync compresses the SQLite file with zstd, transfers it via rsync, and performs an atomic stop/swap/start on the VPS.

## Monorepo Context

This is a private package (`"private": true`), excluded from npm publishing and changesets. It depends on `@lexbuild/core` for shared database schema types (`DocumentRow`, SQL constants, API key hashing utilities) and has no dependency on source packages (`@lexbuild/usc`, `@lexbuild/ecfr`, `@lexbuild/fr`) or the CLI.

## License

[MIT](https://github.com/chris-c-thomas/LexBuild/blob/main/LICENSE)
