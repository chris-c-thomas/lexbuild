---
title: "Pagination and Sorting"
description: "How pagination, sorting, and field selection work on LexBuild API listing endpoints."
order: 8
---

# Pagination and Sorting

Listing endpoints return paginated results with consistent pagination metadata. You can control page size, skip results, sort by different fields, and select specific response fields.

## Offset Pagination

All listing endpoints use offset-based pagination with `limit` and `offset` query parameters.

| Parameter | Type | Default | Range | Description |
|---|---|---|---|---|
| `limit` | integer | `20` | 1-100 | Number of results to return |
| `offset` | integer | `0` | 0+ | Number of results to skip |

```bash
# First page (20 results)
curl "https://lexbuild.dev/api/usc/documents?title_number=42"

# Second page
curl "https://lexbuild.dev/api/usc/documents?title_number=42&offset=20"

# Larger page size
curl "https://lexbuild.dev/api/usc/documents?title_number=42&limit=100"
```

## Pagination Metadata

Every listing response includes a `pagination` object:

```json
{
  "data": [ ... ],
  "meta": { ... },
  "pagination": {
    "total": 1542,
    "limit": 20,
    "offset": 0,
    "has_more": true,
    "next": "/api/usc/documents?title_number=42&sort=identifier&offset=20&limit=20"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `total` | number | Total number of documents matching the query |
| `limit` | number | Number of results per page (echoed from the request) |
| `offset` | number | Current offset (echoed from the request) |
| `has_more` | boolean | Whether there are more results beyond the current page |
| `next` | string or null | Full path to the next page, or `null` if there are no more results |

The `next` field provides a ready-to-use URL for the next page. You can use it to iterate through results without manually computing offsets:

```bash
# Follow the next link to page through results
curl "https://lexbuild.dev$(curl -s 'https://lexbuild.dev/api/usc/documents?title_number=42' | jq -r '.pagination.next')"
```

## Cursor Pagination

As an alternative to offset-based pagination, listing endpoints also accept a `cursor` parameter for keyset pagination. The cursor value is the last document's sort key from the previous page.

```bash
# First page
curl "https://lexbuild.dev/api/usc/documents?title_number=42&limit=20"

# Next page using cursor (value of the last document's sort field)
curl "https://lexbuild.dev/api/usc/documents?title_number=42&limit=20&cursor=/us/usc/t42/s1320"
```

Cursor pagination is more efficient than large offsets for deep result sets, since it does not require the database to skip over previously seen rows.

## Sorting

Use the `sort` parameter to control the order of results. Prefix a field name with `-` for descending order.

```bash
# Sort by title number ascending
curl "https://lexbuild.dev/api/usc/documents?sort=title_number"

# Sort by title number descending
curl "https://lexbuild.dev/api/usc/documents?sort=-title_number"

# Sort FR documents by newest publication date
curl "https://lexbuild.dev/api/fr/documents?sort=-publication_date"
```

### Default Sort Order

Each source has a different default sort:

| Source | Default Sort | Description |
|---|---|---|
| USC | `identifier` | Canonical identifier (title/section order) |
| CFR | `identifier` | Canonical identifier (title/section order) |
| FR | `-publication_date` | Newest documents first |

### Available Sort Fields

The sort fields vary by source. Use the [sources endpoint](/docs/api/endpoints/sources) to see the `sortable_fields` for each source.

**USC and CFR:**

| Field | Description |
|---|---|
| `identifier` | Canonical document identifier |
| `title_number` | Title number |
| `section_number` | Section number |
| `last_updated` | Last update date |

**Federal Register:**

| Field | Description |
|---|---|
| `publication_date` | Publication date |
| `document_number` | FR document number |
| `identifier` | Canonical document identifier |

## Field Selection

Use the `fields` query parameter to control which metadata fields are included in the response. This works on both listing endpoints and single-document endpoints.

### Preset Values

| Value | Effect |
|---|---|
| *(omitted)* | All metadata fields and body (single document) or all metadata (listings) |
| `metadata` | All metadata fields, no body |
| `body` | Body content only, minimal metadata |

### Custom Field Lists

Pass a comma-separated list of field names to include only those fields:

```bash
curl "https://lexbuild.dev/api/usc/documents/t1/s1?fields=section_name,status,legal_status"
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
      "section_name": "Words denoting number, gender, and so forth",
      "status": "in_force",
      "legal_status": "law"
    }
  },
  "meta": { ... }
}
```

The `identifier` and `source` fields are always included regardless of the field selection.

To include the body in a custom field list, add `body` as one of the fields:

```bash
curl "https://lexbuild.dev/api/usc/documents/t1/s1?fields=section_name,body"
```

### Available Metadata Fields

Fields available depend on the source. Common fields across all sources:

| Field | Description |
|---|---|
| `identifier` | Canonical identifier (always included) |
| `source` | Source identifier (always included) |
| `display_title` | Human-readable document title |
| `legal_status` | Legal status classification |
| `status` | Document status (in_force, repealed, etc.) |
| `last_updated` | Last update date |

**USC-specific fields:** `title_number`, `title_name`, `section_number`, `section_name`, `chapter_number`, `chapter_name`, `subchapter_number`, `subchapter_name`, `positive_law`, `currency`, `source_credit`

**CFR-specific fields:** `title_number`, `title_name`, `section_number`, `section_name`, `chapter_number`, `chapter_name`, `part_number`, `part_name`, `agency`, `authority`, `regulatory_source`, `cfr_part`, `cfr_subpart`

**FR-specific fields:** `document_number`, `document_type`, `publication_date`, `agency`, `agencies`, `fr_citation`, `fr_volume`, `effective_date`, `comments_close_date`, `fr_action`, `docket_ids`, `cfr_references`
