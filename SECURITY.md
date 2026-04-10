# Security Policy

## Supported Versions

| Package / App | Supported |
| --- | --- |
| `@lexbuild/cli` | Latest release |
| `@lexbuild/core` | Latest release |
| `@lexbuild/usc` | Latest release |
| `@lexbuild/ecfr` | Latest release |
| `@lexbuild/fr` | Latest release |
| `@lexbuild/mcp` | Latest release |
| `@lexbuild/astro` | Latest release |
| `@lexbuild/api` | Latest release |

All packages and apps in the monorepo use lockstep versioning and remain in sync at all times. Only the latest release receives security patches.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

To report a vulnerability, email [security@lexbuild.dev](mailto:security@lexbuild.dev) with:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof of concept
- The affected package(s) and version(s)
- Any suggested fix, if available

You should receive an acknowledgment within 72 hours. We will work with you to understand the issue and coordinate a fix and disclosure timeline. We aim to release patches for confirmed vulnerabilities within 14 days of acknowledgment.

If you do not receive a response within 72 hours, please follow up on the same thread.

## Scope

The following are in scope for security reports:

- Published npm packages (`@lexbuild/cli`, `@lexbuild/core`, `@lexbuild/usc`, `@lexbuild/ecfr`, `@lexbuild/fr`, `@lexbuild/mcp`)
- The Data API at `lexbuild.dev/api`
- The web application at `lexbuild.dev`
- The MCP server (`@lexbuild/mcp`) and its interaction with AI agents

The following are out of scope:

- Upstream government data sources (uscode.house.gov, ecfr.gov, federalregister.gov)
- Third-party services (Cloudflare, Meilisearch Cloud, npm registry)
- Denial of service attacks against the production infrastructure
- Social engineering or phishing attempts
- Reports from automated scanners without a demonstrated exploit

## Security Model

### Data API

- The content database is opened in **read-only** mode. No mutation endpoints exist.
- API key authentication via `Authorization: Bearer` header, `X-API-Key` header, or query parameter.
- Rate limiting is enforced per key (or per IP for anonymous requests) using a sliding window algorithm.
- API keys are stored as hashed values. Validation is designed to avoid timing-based enumeration.

### MCP Server

- All tools are read-only and idempotent.
- Untrusted legal content is wrapped with boundary markers and control characters are stripped to mitigate prompt injection.
- Response size is capped (default 256 KB, configurable via `LEXBUILD_MCP_MAX_RESPONSE_BYTES`).
- Outbound requests are restricted to a configured API host to prevent SSRF.

### Web Application

- Rendered behind Cloudflare WAF and Caddy reverse proxy.
- Markdown content is sanitized before rendering.
- Search credentials are not exposed to browser code; search requests are proxied through the application.

## Disclosure Policy

We follow coordinated disclosure. After a fix is released, we will:

1. Publish a patched version to npm.
2. Credit the reporter (unless anonymity is requested).
3. Document the fix in the relevant changelog.

## Dependencies

We monitor dependencies with Dependabot and address known vulnerabilities promptly. If you discover a vulnerability in a transitive dependency that affects LexBuild, please report it using the process above.
