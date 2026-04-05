---
title: "Authentication and Rate Limiting"
description: "How to authenticate with the LexBuild API using API keys, and how tiered rate limiting works."
order: 2
---

# Authentication and Rate Limiting

The LexBuild API is open for anonymous read access. All endpoints work without authentication, subject to the anonymous rate limit. API keys unlock higher rate limits for production integrations.

## Anonymous Access

You can start making requests immediately with no setup:

```bash
curl https://lexbuild.dev/api/usc/documents/t1/s1
```

Anonymous requests are rate limited to **100 requests per minute per IP address**.

## API Keys

For higher rate limits, include an API key with your requests. You can pass the key in one of three ways:

**Authorization header (recommended):**

```bash
curl -H "Authorization: Bearer lxb_your_key_here" \
  https://lexbuild.dev/api/usc/documents/t1/s1
```

**X-API-Key header:**

```bash
curl -H "X-API-Key: lxb_your_key_here" \
  https://lexbuild.dev/api/usc/documents/t1/s1
```

**Query parameter:**

```bash
curl "https://lexbuild.dev/api/usc/documents/t1/s1?api_key=lxb_your_key_here"
```

The `Authorization: Bearer` header is the recommended approach. Avoid passing keys in query parameters in production since URLs may be logged by intermediaries.

## Rate Limit Tiers

| Tier | Rate Limit | Window | Description |
|---|---|---|---|
| Anonymous | 100 req/min | 60 seconds | No API key required |
| Standard | 1,000 req/min | 60 seconds | Default tier for new keys |
| Elevated | 5,000 req/min | 60 seconds | Manually upgraded keys |
| Unlimited | No limit | -- | Internal and admin keys |

If you provide an API key that is invalid, expired, or revoked, the request is treated as anonymous rather than rejected. The API does not reveal key validity through error messages.

## Rate Limit Headers

Every response includes rate limit headers so you can monitor your usage:

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Maximum requests allowed in the current window |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the current window resets |
| `X-RateLimit-Policy` | Active policy tier (`anonymous`, `standard`, `elevated`, `unlimited`) |

Example response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1743782460
X-RateLimit-Policy: anonymous
```

## Handling Rate Limit Errors

When you exceed the rate limit, the API returns a `429 Too Many Requests` response with a `Retry-After` header:

```bash
curl -i https://lexbuild.dev/api/usc/documents/t1/s1
```

```
HTTP/2 429

Retry-After: 23
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1743782460
```

```json
{
  "error": {
    "status": 429,
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Retry after 23 seconds.",
    "retry_after": 23
  }
}
```

The `Retry-After` value is in seconds. Wait at least that long before retrying.

## Best Practices

- **Respect `Retry-After`** -- Do not retry immediately after a 429 response. Use the `Retry-After` value for your backoff.
- **Monitor `X-RateLimit-Remaining`** -- Throttle your requests proactively when the remaining count gets low rather than waiting to hit the limit.
- **Use ETag caching** -- Send `If-None-Match` headers with the `ETag` from previous responses. A `304 Not Modified` response does not count differently from a `200`, but it reduces bandwidth and processing time.
- **Select only the fields you need** -- Use the `?fields=` parameter to reduce response size and server load.

## API Reference

For a complete interactive reference with all endpoints, schemas, and a built-in request tester, visit the Scalar API docs:

[lexbuild.dev/api/docs](https://lexbuild.dev/api/docs)
