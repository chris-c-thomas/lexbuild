---
title: "Error Handling"
description: "Error response format, status codes, and error types returned by the LexBuild API."
order: 9
---

# Error Handling

The LexBuild API returns structured JSON error responses for all error conditions. Every error follows a consistent format so you can handle them uniformly in your code.

## Error Response Format

All errors are returned as JSON with an `error` object:

```json
{
  "error": {
    "status": 404,
    "code": "DOCUMENT_NOT_FOUND",
    "message": "No document found with identifier /us/usc/t1/s999"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `status` | number | HTTP status code |
| `code` | string | Machine-readable error code |
| `message` | string | Human-readable error description |

Rate limit errors include an additional field:

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

## HTTP Status Codes

| Status | Meaning | When It Occurs |
|---|---|---|
| `400` | Bad Request | Invalid query parameters, malformed filters, or validation errors |
| `404` | Not Found | Document, title, year, or month does not exist |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server-side failure |
| `503` | Service Unavailable | Search service (Meilisearch) is unreachable |

## Error Codes

| Code | Status | Description |
|---|---|---|
| `DOCUMENT_NOT_FOUND` | 404 | The requested document identifier does not exist |
| `REQUEST_ERROR` | 400/404/503 | General request error (invalid params, missing resource, service unavailable) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests in the current window |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Common Error Scenarios

### Document Not Found

Requesting a document with an identifier that does not exist in the database:

```bash
curl https://lexbuild.dev/api/usc/documents/t1/s999
```

```
HTTP/2 404
```

```json
{
  "error": {
    "status": 404,
    "code": "DOCUMENT_NOT_FOUND",
    "message": "No document found with identifier /us/usc/t1/s999"
  }
}
```

### Title or Year Not Found

Requesting a hierarchy entry that does not exist:

```bash
curl https://lexbuild.dev/api/usc/titles/99
```

```json
{
  "error": {
    "status": 404,
    "code": "REQUEST_ERROR",
    "message": "No USC title 99 found"
  }
}
```

```bash
curl https://lexbuild.dev/api/fr/years/1990
```

```json
{
  "error": {
    "status": 404,
    "code": "REQUEST_ERROR",
    "message": "No FR documents found for year 1990"
  }
}
```

### Rate Limit Exceeded

Sending too many requests within the rate limit window:

```bash
curl -i https://lexbuild.dev/api/usc/documents/t1/s1
```

```
HTTP/2 429
Retry-After: 23
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1743782460
X-RateLimit-Policy: anonymous
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

The `Retry-After` header and `retry_after` field both indicate the number of seconds to wait before retrying.

### Search Service Unavailable

When the search backend (Meilisearch) is down or unreachable:

```bash
curl "https://lexbuild.dev/api/search?q=test"
```

```json
{
  "error": {
    "status": 503,
    "code": "REQUEST_ERROR",
    "message": "Search service unavailable: Connection refused"
  }
}
```

This only affects the search endpoint. Document, hierarchy, sources, and stats endpoints operate independently of the search service.

### Internal Server Error

For unexpected failures, the API returns a generic message without exposing internal details:

```json
{
  "error": {
    "status": 500,
    "code": "INTERNAL_ERROR",
    "message": "Internal server error"
  }
}
```

## Handling Errors in Code

Here is a pattern for handling API errors in JavaScript:

```javascript
async function fetchDocument(identifier) {
  const response = await fetch(
    `https://lexbuild.dev/api/usc/documents/${identifier}`
  );

  if (!response.ok) {
    const body = await response.json();
    const error = body.error;

    if (error.status === 404) {
      console.log(`Document not found: ${error.message}`);
      return null;
    }

    if (error.status === 429) {
      const retryAfter = error.retry_after ?? 60;
      console.log(`Rate limited. Retrying after ${retryAfter}s`);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return fetchDocument(identifier);
    }

    throw new Error(`API error ${error.status}: ${error.message}`);
  }

  return response.json();
}
```

And in Python:

```python
import requests
import time

def fetch_document(identifier):
    url = f"https://lexbuild.dev/api/usc/documents/{identifier}"
    response = requests.get(url)

    if response.status_code == 404:
        print(f"Document not found: {response.json()['error']['message']}")
        return None

    if response.status_code == 429:
        retry_after = response.json()["error"].get("retry_after", 60)
        print(f"Rate limited. Retrying after {retry_after}s")
        time.sleep(retry_after)
        return fetch_document(identifier)

    response.raise_for_status()
    return response.json()
```

## Tips

- **Always check the HTTP status code before parsing the response body.** A non-2xx response always contains an `error` object, never a `data` object.
- **Use the `code` field for programmatic branching**, not the `message` field. Messages are human-readable and may change.
- **For rate limiting, always respect `Retry-After`.** Do not implement a fixed retry interval -- the header tells you exactly how long to wait.
- **The search endpoint can return 503 independently** of other endpoints. If you get a 503 on search, the document and hierarchy endpoints are likely still working.
