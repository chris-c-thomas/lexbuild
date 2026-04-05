---
title: "Sources and Stats Endpoints"
description: "Retrieve source metadata, corpus-wide statistics, and API health status from the LexBuild API."
order: 6
---

# Sources and Stats Endpoints

These endpoints provide metadata about the available content sources, corpus-wide statistics, and API health status. They are useful for understanding the scope of the data and monitoring the service.

## List Sources

```
GET /api/sources
```

Returns metadata about all content sources, including live document counts, available filters, and hierarchy structure.

```bash
curl https://lexbuild.dev/api/sources
```

```json
{
  "data": [
    {
      "id": "usc",
      "name": "United States Code",
      "short_name": "USC",
      "description": "General and permanent federal statutes organized into 54 titles.",
      "url_prefix": "/usc",
      "hierarchy": ["title", "chapter", "section"],
      "filterable_fields": ["title_number", "chapter_number", "status", "positive_law", "legal_status"],
      "sortable_fields": ["title_number", "section_number", "identifier", "last_updated"],
      "has_titles": true,
      "document_count": 59832
    },
    {
      "id": "cfr",
      "name": "Code of Federal Regulations",
      "short_name": "CFR",
      "description": "Federal agency regulations organized into 50 titles.",
      "url_prefix": "/cfr",
      "hierarchy": ["title", "chapter", "part", "section"],
      "filterable_fields": ["title_number", "chapter_number", "part_number", "agency", "status", "legal_status"],
      "sortable_fields": ["title_number", "section_number", "identifier", "last_updated"],
      "has_titles": true,
      "document_count": 213456
    },
    {
      "id": "fr",
      "name": "Federal Register",
      "short_name": "FR",
      "description": "Daily journal of the U.S. government: rules, proposed rules, notices, and presidential documents.",
      "url_prefix": "/fr",
      "hierarchy": ["year", "month", "document"],
      "filterable_fields": ["document_type", "agency", "publication_date", "effective_date"],
      "sortable_fields": ["publication_date", "document_number", "identifier"],
      "has_titles": false,
      "document_count": 748201
    }
  ],
  "meta": {
    "api_version": "v1",
    "timestamp": "2026-04-04T12:00:00.000Z"
  }
}
```

Each source object tells you:

- **`hierarchy`** -- The browsing levels available for that source. USC and CFR use title/chapter/section; FR uses year/month/document.
- **`filterable_fields`** -- Fields you can use as query parameters on the source's document listing endpoint.
- **`sortable_fields`** -- Fields you can use with the `sort` parameter.
- **`has_titles`** -- Whether the source supports the `/titles` hierarchy endpoints.
- **`document_count`** -- Live count of documents in the database for that source.

## Corpus Statistics

```
GET /api/stats
```

Returns aggregate statistics across the entire corpus, broken down by source.

```bash
curl https://lexbuild.dev/api/stats
```

```json
{
  "data": {
    "total_documents": 1021489,
    "sources": {
      "usc": {
        "document_count": 59832,
        "title_count": 54,
        "last_updated": "2026-03-15"
      },
      "cfr": {
        "document_count": 213456,
        "title_count": 50,
        "last_updated": "2026-04-01"
      },
      "fr": {
        "document_count": 748201,
        "date_range": {
          "earliest": "2000-01-03",
          "latest": "2026-04-03"
        },
        "document_types": {
          "rule": 142301,
          "proposed_rule": 87654,
          "notice": 489123,
          "presidential_document": 29123
        }
      }
    },
    "database": {
      "schema_version": 1
    }
  },
  "meta": {
    "api_version": "v1",
    "timestamp": "2026-04-04T12:00:00.000Z"
  }
}
```

The stats response provides:

- **`total_documents`** -- Total number of documents across all sources.
- **USC/CFR stats** -- Document count, number of distinct titles, and the most recent `last_updated` date.
- **FR stats** -- Document count, date range of publications, and document counts by type (rule, proposed_rule, notice, presidential_document).
- **`database.schema_version`** -- Internal schema version of the content database.

This endpoint is cached aggressively (up to 24 hours at the CDN layer) since the underlying data changes only when the content database is rebuilt.

## Health Check

```
GET /api/health
```

Returns the API health status, database connectivity, and uptime. Useful for monitoring and infrastructure checks.

```bash
curl https://lexbuild.dev/api/health
```

```json
{
  "status": "ok",
  "version": "0.8.0",
  "database": {
    "connected": true,
    "documents": 1021489,
    "schema_version": 1
  },
  "uptime": 345621.234
}
```

| Field | Description |
|---|---|
| `status` | Overall health: `ok`, `degraded`, or `error` |
| `version` | API package version |
| `database.connected` | Whether the SQLite database is accessible |
| `database.documents` | Total document count in the database |
| `database.schema_version` | Content database schema version |
| `uptime` | Server uptime in seconds |

The health endpoint returns `"status": "error"` when the database connection fails. The HTTP status code is always 200, even in degraded states, so monitoring systems should check the `status` field in the response body.
