---
title: "Security"
description: "Security measures in the LexBuild MCP server: injection defense, response budgets, rate limiting, and SSRF protection."
order: 5
---

# Security

The LexBuild MCP server implements several layers of defense to protect both the AI model's context and the underlying infrastructure.

## Injection Defense

All legal text returned by tools is wrapped with boundary markers:

```
<!-- LEXBUILD UNTRUSTED CONTENT BEGIN -->
[legal text here]
<!-- LEXBUILD UNTRUSTED CONTENT END -->
```

These markers help AI models distinguish between trusted tool output (metadata, identifiers) and untrusted legal content that could contain adversarial text. Control characters (ANSI escapes, null bytes) are stripped from all text content before it reaches the model.

## Response Budget

Every tool response is checked against a configurable size limit (default: 256 KB) after JSON serialization. If a response would exceed the budget, the server returns an error rather than flooding the model's context with an oversized payload.

This protects against edge cases like extremely long legal sections. The budget can be adjusted via the `LEXBUILD_MCP_MAX_RESPONSE_BYTES` environment variable.

## Rate Limiting

The MCP server enforces per-session rate limits to prevent abuse:

| Tier | Limit | Description |
|---|---|---|
| Anonymous | 60 req/min | No API key required |
| With API key | Higher limits | Set via `LEXBUILD_API_KEY` environment variable |

Rate limiting is applied in-process using a sliding window algorithm. The hosted endpoint at `mcp.lexbuild.dev` has an additional Cloudflare WAF rate limit as an outer envelope.

When the rate limit is exceeded, the server returns a JSON-RPC error with code `-32000` and a `Retry-After` header.

## SSRF Protection

The MCP server's API client validates that all outbound requests go to the configured `LEXBUILD_API_URL` host only. This prevents server-side request forgery if a crafted identifier or parameter attempts to redirect requests to an internal or external host.

## Authentication

Authentication is optional. The MCP server works without an API key, subject to the anonymous rate limit. Providing a `LEXBUILD_API_KEY` unlocks higher rate tiers on the Data API.

The API key is passed as an environment variable in your MCP client configuration and is never exposed to the AI model or included in tool responses.

## Read-Only Access

All five tools are annotated as read-only and idempotent. The MCP server cannot modify, create, or delete any legal content. It is a pure read adapter over the [LexBuild Data API](/docs/api/overview).
