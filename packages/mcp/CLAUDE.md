# CLAUDE.md — @lexbuild/mcp

## Package Overview

`@lexbuild/mcp` is a Model Context Protocol server that exposes the LexBuild legal corpus to AI agents. It is a thin, typed adapter over the LexBuild Data API — no direct SQLite access, no XML parsing. It supports two transports: stdio (local installs) and Streamable HTTP (hosted at `mcp.lexbuild.dev`).

## Monorepo Integration

- **Published to npm** as `@lexbuild/mcp` — included in changesets, independently versioned (not in the `fixed` group)
- **Fully independent** — no dependency on `@lexbuild/core` or any source package. ESLint boundary rules enforce this.
- **Two bin entrypoints**: `lexbuild-mcp` (stdio) and `lexbuild-mcp-http` (HTTP)

## Module Structure

```
src/
├── index.ts                    # Barrel exports
├── config.ts                   # Zod-validated env config
├── config.test.ts
├── server/
│   ├── create-server.ts        # McpServer factory, wires tools/resources/prompts
│   └── errors.ts               # McpServerError class with typed codes
├── bin/
│   ├── stdio.ts                # Stdio transport entrypoint
│   └── http.ts                 # HTTP server entrypoint
├── api/
│   ├── client.ts               # Typed Data API client (fetch-based)
│   ├── types.ts                # API response interfaces
│   └── client.test.ts
├── tools/
│   ├── register.ts             # Wires all tools to McpServer
│   ├── search-laws.ts          # search_laws: full-text search
│   ├── get-section.ts          # get_section: fetch one section
│   ├── list-titles.ts          # list_titles: enumerate titles/years
│   ├── get-title.ts            # get_title: title/year detail
│   ├── get-federal-register-document.ts  # get_federal_register_document
│   ├── guards.ts               # Response budget enforcement
│   ├── sanitize.ts             # Injection defense markers
│   ├── guards.test.ts
│   └── sanitize.test.ts
├── resources/
│   ├── register.ts             # Resource template registration
│   ├── uri.ts                  # lexbuild:// URI parser
│   └── uri.test.ts
├── prompts/
│   ├── register.ts             # Prompt registration
│   ├── cite-statute.ts         # Bluebook citation prompt
│   └── summarize-section.ts    # Section summary prompt
├── transport/
│   └── http.ts                 # Hono + WebStandardStreamableHTTPServerTransport
├── security/
│   └── rate-limit.ts           # In-memory sliding window rate limiter
└── lib/
    └── logger.ts               # Logger interface (console impl, pino-compatible)
```

## Design Decisions

1. **No `@lexbuild/core` dependency**: The MCP server is a thin API client. Shared types like `SourceType` are defined locally. This keeps the npm package small and the architecture clean.
2. **Data API wrapper, not direct DB access**: Auth, rate limits, caching, and schema contracts are reused from the Data API. One extra network hop over loopback is negligible.
3. **Console logger, not pino**: v1 uses a thin `Logger` interface writing JSON to stderr. The interface is pino-compatible so swapping is non-breaking.
4. **Auth is optional**: Works without an API key (anonymous rate limits). Keys unlock higher rate tiers.
5. **`WebStandardStreamableHTTPServerTransport`**: Chosen over the Node.js-specific variant for Hono compatibility (web standard `Request`/`Response`).

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `LEXBUILD_API_URL` | No | `https://api.lexbuild.dev` | Data API base URL |
| `LEXBUILD_API_KEY` | No | — | Optional API key for higher rate limits |
| `LEXBUILD_MCP_HTTP_PORT` | No | `3030` | HTTP transport port |
| `LEXBUILD_MCP_HTTP_HOST` | No | `127.0.0.1` | HTTP transport bind address |
| `LEXBUILD_MCP_MAX_RESPONSE_BYTES` | No | `256000` | Response size cap (bytes) |
| `LEXBUILD_MCP_RATE_LIMIT_PER_MIN` | No | `60` | Anonymous rate limit |
| `LEXBUILD_MCP_LOG_LEVEL` | No | `info` | Log level |
| `LEXBUILD_MCP_ENV` | No | `production` | Environment |

## Port Assignment

- **3030**: MCP HTTP server (after 4321 Astro, 4322 API, 7700 Meilisearch, 3001 Uptime Kuma)

## Common Pitfalls

- **`exactOptionalPropertyTypes`**: Optional properties that may receive `undefined` values must be typed as `prop?: T | undefined`, not just `prop?: T`. This affects function parameters passed through from Zod schemas.
- **CFR API path**: The Data API uses `/api/cfr/` (not `/api/ecfr/`) for CFR endpoints. The `URL_TO_DB_SOURCE` mapping in the API handles the translation.
- **Stdio transport logs to stderr**: All logging goes to `console.error` to avoid corrupting the stdout JSON-RPC stream.
- **SSRF protection**: The API client validates that all requests go to the configured `LEXBUILD_API_URL` host only.
- **Response budget**: Tool responses are checked against `LEXBUILD_MCP_MAX_RESPONSE_BYTES` after JSON serialization. Oversized responses throw `McpServerError` with code `response_too_large`.
