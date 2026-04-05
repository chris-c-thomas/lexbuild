---
title: "Document Endpoints"
description: "Retrieve and list U.S. Code, CFR, and Federal Register documents from the LexBuild API."
order: 3
---

# Document Endpoints

Document endpoints let you retrieve individual legal documents and list collections with filtering and sorting. Each source has its own pair of endpoints following the same pattern.

## U.S. Code

### List USC Documents

```
GET /api/usc/documents
```

Returns a paginated list of USC sections with optional filtering and sorting.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `title_number` | integer | Filter by title number (e.g., `1`, `42`) |
| `chapter_number` | string | Filter by chapter number |
| `status` | string | Filter by status (e.g., `in_force`, `repealed`) |
| `positive_law` | boolean | Filter by positive law status |
| `legal_status` | string | Filter by legal status |
| `sort` | string | Sort field. Prefix with `-` for descending. Default: `identifier` |
| `fields` | string | Field selection (see [field selection](#field-selection)) |
| `limit` | integer | Results per page (1-100, default: 20) |
| `offset` | integer | Number of results to skip (default: 0) |

**Example -- list sections in Title 17:**

```bash
curl "https://lexbuild.dev/api/usc/documents?title_number=17&limit=5"
```

```json
{
  "data": [
    {
      "id": "usc-t17-s101",
      "identifier": "/us/usc/t17/s101",
      "source": "usc",
      "metadata": {
        "display_title": "17 U.S.C. SS 101 - Definitions",
        "title_number": 17,
        "title_name": "Copyrights",
        "section_number": "101",
        "section_name": "Definitions",
        "chapter_number": "1",
        "chapter_name": "Subject Matter and Scope of Copyright",
        "legal_status": "law",
        "positive_law": true,
        "status": "in_force"
      }
    }
  ],
  "meta": {
    "api_version": "v1",
    "format_version": "1.0",
    "timestamp": "2026-04-04T12:00:00.000Z"
  },
  "pagination": {
    "total": 463,
    "limit": 5,
    "offset": 0,
    "has_more": true,
    "next": "/api/usc/documents?title_number=17&sort=identifier&offset=5&limit=5"
  }
}
```

### Get a Single USC Document

```
GET /api/usc/documents/{identifier}
```

Retrieves a single USC section by its identifier. You can use either the shorthand form or the full canonical identifier.

**Identifier formats:**

| Format | Example | Description |
|---|---|---|
| Shorthand | `t1/s1` | Title prefix + section prefix |
| Full (URL-encoded) | `%2Fus%2Fusc%2Ft1%2Fs1` | Canonical `/us/usc/t1/s1` identifier |

**Example:**

```bash
curl https://lexbuild.dev/api/usc/documents/t17/s106
```

```json
{
  "data": {
    "id": "usc-t17-s106",
    "identifier": "/us/usc/t17/s106",
    "source": "usc",
    "metadata": {
      "identifier": "/us/usc/t17/s106",
      "source": "usc",
      "display_title": "17 U.S.C. SS 106 - Exclusive rights in copyrighted works",
      "title_number": 17,
      "section_number": "106",
      "section_name": "Exclusive rights in copyrighted works",
      "chapter_number": "1",
      "chapter_name": "Subject Matter and Scope of Copyright",
      "legal_status": "law",
      "positive_law": true,
      "status": "in_force",
      "source_credit": "Office of the Law Revision Counsel"
    },
    "body": "Subject to sections 107 through 122, the owner of copyright..."
  },
  "meta": {
    "api_version": "v1",
    "format_version": "1.0",
    "timestamp": "2026-04-04T12:00:00.000Z"
  }
}
```

## Code of Federal Regulations

### List CFR Documents

```
GET /api/cfr/documents
```

Returns a paginated list of CFR sections with optional filtering and sorting.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `title_number` | integer | Filter by title number (e.g., `17`, `40`) |
| `chapter_number` | string | Filter by chapter number |
| `part_number` | string | Filter by part number |
| `agency` | string | Filter by agency name |
| `status` | string | Filter by status |
| `legal_status` | string | Filter by legal status |
| `sort` | string | Sort field. Default: `identifier` |
| `fields` | string | Field selection |
| `limit` | integer | Results per page (1-100, default: 20) |
| `offset` | integer | Number of results to skip (default: 0) |

**Example -- list CFR sections from the SEC (Title 17):**

```bash
curl "https://lexbuild.dev/api/cfr/documents?title_number=17&limit=3"
```

### Get a Single CFR Document

```
GET /api/cfr/documents/{identifier}
```

Retrieves a single CFR section. Identifiers follow the same shorthand and full-form patterns.

**Example:**

```bash
curl https://lexbuild.dev/api/cfr/documents/t17/s240.10b-5
```

CFR metadata includes additional regulatory fields:

```json
{
  "data": {
    "id": "cfr-t17-s240-10b-5",
    "identifier": "/us/cfr/t17/s240.10b-5",
    "source": "cfr",
    "metadata": {
      "identifier": "/us/cfr/t17/s240.10b-5",
      "source": "cfr",
      "display_title": "17 CFR SS 240.10b-5 - Employment of manipulative and deceptive devices",
      "title_number": 17,
      "part_number": "240",
      "agency": "Securities and Exchange Commission",
      "authority": "15 U.S.C. 78a et seq.",
      "status": "in_force"
    },
    "body": "It shall be unlawful for any person..."
  },
  "meta": {
    "api_version": "v1",
    "format_version": "1.0",
    "timestamp": "2026-04-04T12:00:00.000Z"
  }
}
```

## Federal Register

### List FR Documents

```
GET /api/fr/documents
```

Returns a paginated list of Federal Register documents. FR documents default to reverse chronological order.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `document_type` | string | Filter by type: `rule`, `proposed_rule`, `notice`, `presidential_document` |
| `agency` | string | Filter by agency name |
| `date_from` | string | Publication date range start (YYYY-MM-DD) |
| `date_to` | string | Publication date range end (YYYY-MM-DD) |
| `effective_date_from` | string | Effective date range start (YYYY-MM-DD) |
| `effective_date_to` | string | Effective date range end (YYYY-MM-DD) |
| `sort` | string | Sort field. Default: `-publication_date` (newest first) |
| `fields` | string | Field selection |
| `limit` | integer | Results per page (1-100, default: 20) |
| `offset` | integer | Number of results to skip (default: 0) |

**Example -- list recent EPA rules:**

```bash
curl "https://lexbuild.dev/api/fr/documents?agency=Environmental+Protection+Agency&document_type=rule&limit=5"
```

### Get a Single FR Document

```
GET /api/fr/documents/{identifier}
```

FR documents are identified by their document number.

**Example:**

```bash
curl https://lexbuild.dev/api/fr/documents/2026-06029
```

FR metadata includes publication-specific fields:

```json
{
  "data": {
    "id": "fr-2026-06029",
    "identifier": "/us/fr/2026-06029",
    "source": "fr",
    "metadata": {
      "identifier": "/us/fr/2026-06029",
      "source": "fr",
      "document_number": "2026-06029",
      "document_type": "rule",
      "publication_date": "2026-03-20",
      "agency": "Environmental Protection Agency",
      "agencies": ["Environmental Protection Agency"],
      "fr_citation": "91 FR 12345",
      "effective_date": "2026-05-19",
      "comments_close_date": null,
      "docket_ids": ["EPA-HQ-OAR-2024-0001"],
      "cfr_references": [{"title": 40, "parts": ["60"]}]
    },
    "body": "AGENCY: Environmental Protection Agency..."
  },
  "meta": {
    "api_version": "v1",
    "format_version": "1.0",
    "timestamp": "2026-04-04T12:00:00.000Z"
  }
}
```

## Content Negotiation

Single-document endpoints support content negotiation. You can request JSON, raw Markdown, or stripped plaintext:

```bash
# JSON (default)
curl https://lexbuild.dev/api/usc/documents/t1/s1

# Raw Markdown with YAML frontmatter
curl -H "Accept: text/markdown" https://lexbuild.dev/api/usc/documents/t1/s1

# Plaintext (Markdown formatting stripped)
curl "https://lexbuild.dev/api/usc/documents/t1/s1?format=text"
```

See [Content Negotiation](/docs/api/content-negotiation) for full details.

## Field Selection

Use the `fields` query parameter to control which parts of the response are returned:

| Value | Effect |
|---|---|
| *(omitted)* | Returns all metadata and body |
| `metadata` | Returns all metadata, no body |
| `body` | Returns body only, minimal metadata |
| `title_name,section_name` | Returns only the specified fields (plus `identifier` and `source`, which are always included) |

```bash
# Get only metadata, skip the body
curl "https://lexbuild.dev/api/usc/documents/t1/s1?fields=metadata"

# Get specific fields
curl "https://lexbuild.dev/api/usc/documents/t1/s1?fields=section_name,status,legal_status"
```

## ETag Caching

Every single-document response includes an `ETag` header derived from the content hash. Send `If-None-Match` to avoid re-downloading unchanged content:

```bash
# First request
curl -i https://lexbuild.dev/api/usc/documents/t1/s1
# Response includes: ETag: "a1b2c3d4e5f6g7h8"

# Subsequent request with ETag
curl -H 'If-None-Match: "a1b2c3d4e5f6g7h8"' \
  https://lexbuild.dev/api/usc/documents/t1/s1
# Returns 304 Not Modified if content unchanged
```

## Error Responses

If a document is not found, the API returns a `404` with a structured error:

```json
{
  "error": {
    "status": 404,
    "code": "DOCUMENT_NOT_FOUND",
    "message": "No document found with identifier /us/usc/t1/s999"
  }
}
```

See [Error Handling](/docs/api/errors) for all error types.
