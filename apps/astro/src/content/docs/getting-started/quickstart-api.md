---
title: "API Quickstart"
description: "Make your first API call to the LexBuild Data API and retrieve legal content as JSON or Markdown."
order: 4
---

# API Quickstart

Make your first API call to the LexBuild Data API and retrieve legal content as JSON, Markdown, or plaintext.

## Base URL

```
https://lexbuild.dev/api
```

All endpoints are prefixed with `/api/`. No authentication is required for read-only access.

## Your First Request

Retrieve a single U.S. Code section as JSON:

```bash
curl https://lexbuild.dev/api/usc/documents/1-1
```

This returns the document for 1 USC Section 1 ("Words denoting number, gender, and so forth"):

```json
{
  "data": {
    "identifier": "/us/usc/t1/s1",
    "heading": "1 USC \u00a7 1 - Words denoting number, gender, and so forth",
    "source": "usc",
    "title_number": 1,
    "section_number": "1",
    "granularity": "section",
    "body": "# \u00a7 1. Words denoting number, gender, and so forth\n\n...",
    "token_estimate": 1250
  }
}
```

## Content Negotiation

Request the same document as Markdown:

```bash
curl https://lexbuild.dev/api/usc/documents/1-1 \
  -H "Accept: text/markdown"
```

Or use the `format` query parameter:

```bash
curl "https://lexbuild.dev/api/usc/documents/1-1?format=markdown"
```

Supported formats:

| Format | Accept Header | Query Param |
|---|---|---|
| JSON | `application/json` (default) | `?format=json` |
| Markdown | `text/markdown` | `?format=markdown` |
| Plain text | `text/plain` | `?format=plaintext` |

## Browse Available Sources

List all available sources with document counts:

```bash
curl https://lexbuild.dev/api/sources
```

```json
{
  "data": [
    { "id": "usc", "name": "U.S. Code", "document_count": 60421 },
    { "id": "cfr", "name": "Code of Federal Regulations", "document_count": 232847 },
    { "id": "fr", "name": "Federal Register", "document_count": 785000 }
  ]
}
```

## List Documents

List USC documents with pagination:

```bash
curl "https://lexbuild.dev/api/usc/documents?limit=5"
```

Filter by title:

```bash
curl "https://lexbuild.dev/api/usc/documents?title_number=18&limit=5"
```

## Search

Search across all sources:

```bash
curl "https://lexbuild.dev/api/search?q=environmental+protection&limit=5"
```

Filter search results by source:

```bash
curl "https://lexbuild.dev/api/search?q=securities+fraud&source=cfr&limit=5"
```

> [!TIP]
> The interactive API reference with request builder is available at [lexbuild.dev/api/docs](https://lexbuild.dev/api/docs).

## Next Steps

- [API Overview](/docs/api/overview) -- Base URL, key concepts, response structure
- [Authentication](/docs/api/authentication) -- API keys, rate limits, tiers
- [Documents Endpoint](/docs/api/endpoints/documents) -- Full document retrieval and filtering
- [Content Negotiation](/docs/api/content-negotiation) -- JSON, Markdown, and plaintext responses
