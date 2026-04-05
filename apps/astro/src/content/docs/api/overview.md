---
title: "API Overview"
description: "Introduction to the LexBuild Data API, including base URL, supported sources, key features, and a quick start example."
order: 1
---

# API Overview

The LexBuild Data API provides programmatic access to over one million structured U.S. legal documents. You can retrieve individual sections, list and filter collections, search across sources, and browse hierarchical structures -- all through a standard REST interface.

**Base URL:** `https://lexbuild.dev/api`

All endpoints are prefixed with `/api/`. There is no version prefix in the URL -- new sources and fields are added without breaking existing responses.

## Supported Sources

The API serves three sources of U.S. federal law:

| Source | Path Prefix | Description |
|---|---|---|
| **U.S. Code** (USC) | `/api/usc/` | General and permanent federal statutes organized into 54 titles |
| **Code of Federal Regulations** (CFR) | `/api/cfr/` | Federal agency regulations organized into 50 titles |
| **Federal Register** (FR) | `/api/fr/` | Daily journal of the U.S. government: rules, proposed rules, notices, and presidential documents |

## Key Features

- **Content negotiation** -- Get responses as JSON (default), raw Markdown with YAML frontmatter, or stripped plaintext. Use the `Accept` header or `?format=` query parameter.
- **Pagination** -- Offset-based pagination with configurable limits, totals, and a `next` link for easy traversal.
- **Filtering and sorting** -- Source-specific filters (title number, agency, document type, date ranges) and multi-field sorting.
- **Field selection** -- Request only metadata, only the body, or specific fields to reduce response size.
- **Full-text search** -- Cross-source search with faceted filtering, highlighting, and relevance ranking.
- **ETag caching** -- Every document response includes an `ETag` header. Send `If-None-Match` to get a `304 Not Modified` when the content has not changed.
- **Rate limiting** -- Tiered rate limits with transparent `X-RateLimit-*` headers on every response.

## Quick Example

Fetch U.S. Code Title 1, Section 1 as JSON:

```bash
curl https://lexbuild.dev/api/usc/documents/t1/s1
```

```json
{
  "data": {
    "id": "usc-t1-s1",
    "identifier": "/us/usc/t1/s1",
    "source": "usc",
    "metadata": {
      "identifier": "/us/usc/t1/s1",
      "source": "usc",
      "display_title": "1 U.S.C. SS 1 - Words denoting number, gender, and so forth",
      "title_number": 1,
      "title_name": "General Provisions",
      "section_number": "1",
      "section_name": "Words denoting number, gender, and so forth",
      "chapter_number": "1",
      "chapter_name": "Rules of Construction",
      "legal_status": "law",
      "positive_law": true,
      "status": "in_force"
    },
    "body": "In determining the meaning of any Act of Congress..."
  },
  "meta": {
    "api_version": "v1",
    "format_version": "1.0",
    "timestamp": "2026-04-04T12:00:00.000Z"
  }
}
```

## Interactive Documentation

The API includes a built-in interactive reference powered by Scalar. You can browse all endpoints, see request/response schemas, and test requests directly in your browser:

- **API Reference UI:** [lexbuild.dev/api/docs](https://lexbuild.dev/api/docs)
- **OpenAPI Spec:** [lexbuild.dev/api/openapi.json](https://lexbuild.dev/api/openapi.json)

The OpenAPI 3.1 spec can be imported into tools like Postman, Insomnia, or any OpenAPI-compatible client.

## Response Envelope

All JSON responses follow a consistent envelope structure:

```json
{
  "data": { },
  "meta": {
    "api_version": "v1",
    "format_version": "1.0",
    "timestamp": "2026-04-04T12:00:00.000Z"
  }
}
```

Collection endpoints add a `pagination` object:

```json
{
  "data": [ ],
  "meta": { },
  "pagination": {
    "total": 1542,
    "limit": 20,
    "offset": 0,
    "has_more": true,
    "next": "/api/usc/documents?offset=20&limit=20"
  }
}
```

## Next Steps

- [Authentication](/docs/api/authentication) -- API keys and rate limits
- [Document Endpoints](/docs/api/endpoints/documents) -- Retrieve and list documents
- [Search](/docs/api/endpoints/search) -- Full-text search across all sources
- [Content Negotiation](/docs/api/content-negotiation) -- JSON, Markdown, and plaintext formats
