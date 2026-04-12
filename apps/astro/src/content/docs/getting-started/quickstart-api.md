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

For regulatory content, the API route surface uses `/api/ecfr/...` and `source=ecfr`, while
canonical document identifiers remain in the `/us/cfr/...` namespace.

## Your First Request

Retrieve a single U.S. Code section as JSON:

```bash
curl https://lexbuild.dev/api/usc/documents/t1%2Fs1
```

This returns the document for 1 USC Section 1 ("Words denoting number, gender, and so forth"):

```json
{
  "data": {
    "id": "us-usc-t1-s1",
    "identifier": "/us/usc/t1/s1",
    "source": "usc",
    "metadata": {
      "identifier": "/us/usc/t1/s1",
      "source": "usc",
      "display_title": "1 U.S.C. 1 - Words denoting number, gender, and so forth",
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
    "timestamp": "2026-04-11T00:00:00.000Z"
  }
}
```

## Content Negotiation

Request the same document as Markdown:

```bash
curl https://lexbuild.dev/api/usc/documents/t1%2Fs1 \
  -H "Accept: text/markdown"
```

Or use the `format` query parameter:

```bash
curl "https://lexbuild.dev/api/usc/documents/t1%2Fs1?format=markdown"
```

Supported formats:

| Format | Accept Header | Query Param |
|---|---|---|
| JSON | `application/json` (default) | `?format=json` |
| Markdown | `text/markdown` | `?format=markdown` |
| Plain text | `text/plain` | `?format=text` |

## Browse Available Sources

List all available sources with document counts:

```bash
curl https://lexbuild.dev/api/sources
```

```json
{
  "data": [
    { "id": "usc", "name": "United States Code", "url_prefix": "/usc", "document_count": 60421 },
    { "id": "ecfr", "name": "eCFR", "url_prefix": "/ecfr", "document_count": 232847 },
    { "id": "fr", "name": "Federal Register", "url_prefix": "/fr", "document_count": 785000 }
  ],
  "meta": {
    "api_version": "v1",
    "timestamp": "2026-04-11T00:00:00.000Z"
  }
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
curl "https://lexbuild.dev/api/search?q=securities+fraud&source=ecfr&limit=5"
```

> [!TIP]
> The interactive API reference with request builder is available at [lexbuild.dev/docs/api](https://lexbuild.dev/docs/api).

## Next Steps

- [API Overview](/docs/api/overview) -- Base URL, key concepts, response structure
- [Authentication](/docs/api/authentication) -- API keys, rate limits, tiers
- [Documents Endpoint](/docs/api/endpoints/documents) -- Full document retrieval and filtering
- [Content Negotiation](/docs/api/content-negotiation) -- JSON, Markdown, and plaintext responses
