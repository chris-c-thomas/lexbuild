---
title: "Search Endpoint"
description: "Full-text search across U.S. Code, CFR, and Federal Register documents with faceted filtering and highlights."
order: 5
---

# Search Endpoint

The search endpoint provides full-text search across all three sources (USC, CFR, and Federal Register) with faceted filtering, relevance ranking, and highlighted snippets. Search is powered by Meilisearch.

## Basic Search

```
GET /api/search
```

**Required parameter:**

| Parameter | Type | Description |
|---|---|---|
| `q` | string | Search query text (1-500 characters) |

```bash
curl "https://lexbuild.dev/api/search?q=environmental+protection"
```

```json
{
  "data": {
    "hits": [
      {
        "id": "usc-t42-s4321",
        "source": "usc",
        "identifier": "/us/usc/t42/s4321",
        "heading": "Congressional declaration of purpose",
        "title_number": 42,
        "title_name": "The Public Health and Welfare",
        "status": "in_force",
        "url": "/usc/title-42/chapter-55/section-4321",
        "hierarchy": ["Title 42", "Chapter 55"],
        "highlights": {
          "heading": "Congressional declaration of purpose",
          "body": "...national policy which will encourage productive and enjoyable harmony between man and his <mark>environment</mark>; to promote efforts which will prevent or eliminate damage to the <mark>environment</mark>..."
        }
      }
    ],
    "query": "environmental protection",
    "processing_time_ms": 12,
    "estimated_total_hits": 4523
  },
  "facets": {
    "source": {
      "usc": 1245,
      "ecfr": 2891,
      "fr": 387
    },
    "status": {
      "in_force": 4102,
      "repealed": 312,
      "transferred": 109
    }
  },
  "meta": {
    "api_version": "v1",
    "timestamp": "2026-04-04T12:00:00.000Z"
  },
  "pagination": {
    "total": 4523,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

## Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `q` | string | *(required)* | Search query text |
| `source` | string | -- | Filter by source: `usc`, `cfr`, or `fr` |
| `title_number` | integer | -- | Filter by title number (USC and CFR) |
| `document_type` | string | -- | Filter FR documents: `rule`, `proposed_rule`, `notice`, `presidential_document` |
| `agency` | string | -- | Filter by agency name |
| `status` | string | -- | Filter by document status |
| `date_from` | string | -- | Publication date range start (YYYY-MM-DD, FR only) |
| `date_to` | string | -- | Publication date range end (YYYY-MM-DD, FR only) |
| `sort` | string | `relevance` | Sort order (see [Sorting](#sorting)) |
| `limit` | integer | `20` | Results per page (1-100) |
| `offset` | integer | `0` | Number of results to skip |
| `facets` | string | `source,status` | Comma-separated facet fields (see [Facets](#facets)) |
| `highlight` | boolean | `true` | Include highlighted snippets in results |

## Filtering

Combine filters to narrow results to a specific source, title, or document type:

```bash
# Search CFR only
curl "https://lexbuild.dev/api/search?q=securities+fraud&source=cfr"

# Search within a specific title
curl "https://lexbuild.dev/api/search?q=disclosure&source=cfr&title_number=17"

# Search FR rules from a date range
curl "https://lexbuild.dev/api/search?q=emissions&source=fr&document_type=rule&date_from=2025-01-01&date_to=2025-12-31"
```

## Facets

Facets provide count distributions for fields across the result set. By default, the `source` and `status` facets are included. You can request additional facets:

```bash
curl "https://lexbuild.dev/api/search?q=banking&facets=source,document_type,agency"
```

**Available facets:**

| Facet | Description |
|---|---|
| `source` | Document source distribution (usc, cfr, fr) |
| `status` | Document status distribution |
| `title_number` | Title number distribution |
| `document_type` | FR document type distribution |
| `agency` | Agency name distribution |
| `publication_date` | Publication date distribution |
| `granularity` | Document granularity distribution |

Facet response example:

```json
{
  "facets": {
    "source": {
      "usc": 42,
      "ecfr": 318,
      "fr": 87
    },
    "document_type": {
      "rule": 45,
      "notice": 31,
      "proposed_rule": 11
    }
  }
}
```

## Sorting

By default, results are sorted by relevance (best match first). You can sort by other fields:

| Sort Value | Description |
|---|---|
| `relevance` | Best match first (default) |
| `publication_date` | Oldest first (FR documents) |
| `-publication_date` | Newest first (FR documents) |
| `title_number` | Ascending title number |
| `identifier` | Alphabetical identifier |
| `document_number` | FR document number |

Prefix a field with `-` for descending order.

```bash
# Search FR documents, newest first
curl "https://lexbuild.dev/api/search?q=climate&source=fr&sort=-publication_date"
```

## Highlights

When `highlight=true` (the default), each hit includes a `highlights` object with HTML `<mark>` tags around matching terms:

```json
{
  "highlights": {
    "heading": "Congressional declaration of <mark>environmental</mark> policy",
    "body": "...efforts which will prevent or eliminate damage to the <mark>environment</mark> and biosphere..."
  }
}
```

The body highlight is cropped to approximately 200 characters around the best matching passage. To disable highlights:

```bash
curl "https://lexbuild.dev/api/search?q=copyright&highlight=false"
```

## Hit Response Shape

Each hit in the `data.hits` array contains:

| Field | Type | Description |
|---|---|---|
| `id` | string | Internal document ID |
| `source` | string | Source identifier (`usc`, `cfr`, or `fr`) |
| `identifier` | string | Canonical document identifier |
| `heading` | string | Document heading/title |
| `title_number` | number or null | Title number (USC/CFR) |
| `title_name` | string or null | Title name (USC/CFR) |
| `status` | string | Document status |
| `url` | string | Relative URL to the document on the web |
| `document_type` | string or null | FR document type |
| `publication_date` | string or null | FR publication date |
| `hierarchy` | string[] | Breadcrumb hierarchy labels |
| `highlights` | object or null | Highlighted snippets (when enabled) |

## Error Handling

If the search service is unavailable, the API returns a `503 Service Unavailable` response:

```json
{
  "error": {
    "status": 503,
    "code": "REQUEST_ERROR",
    "message": "Search service unavailable: Connection refused"
  }
}
```
