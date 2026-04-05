---
title: "Hierarchy Endpoints"
description: "Browse the structural hierarchy of USC titles, CFR titles, and Federal Register years and months."
order: 4
---

# Hierarchy Endpoints

Hierarchy endpoints let you browse the organizational structure of each source. USC and CFR are organized by title and chapter. The Federal Register is organized by year and month.

## U.S. Code Titles

### List All USC Titles

```
GET /api/usc/titles
```

Returns all 54 USC titles with document counts and chapter counts.

```bash
curl https://lexbuild.dev/api/usc/titles
```

```json
{
  "data": [
    {
      "title_number": 1,
      "title_name": "General Provisions",
      "document_count": 10,
      "chapter_count": 3,
      "positive_law": true,
      "url": "/api/usc/titles/1"
    },
    {
      "title_number": 2,
      "title_name": "The Congress",
      "document_count": 1437,
      "chapter_count": 65,
      "positive_law": false,
      "url": "/api/usc/titles/2"
    }
  ],
  "meta": {
    "api_version": "v1",
    "timestamp": "2026-04-04T12:00:00.000Z"
  }
}
```

### Get USC Title Detail

```
GET /api/usc/titles/{number}
```

Returns metadata for a single title along with its chapter listing.

```bash
curl https://lexbuild.dev/api/usc/titles/17
```

```json
{
  "data": {
    "title_number": 17,
    "title_name": "Copyrights",
    "document_count": 463,
    "positive_law": true,
    "chapters": [
      {
        "chapter_number": "1",
        "chapter_name": "Subject Matter and Scope of Copyright",
        "document_count": 26
      },
      {
        "chapter_number": "2",
        "chapter_name": "Copyright Ownership and Transfer",
        "document_count": 12
      }
    ]
  },
  "meta": {
    "api_version": "v1",
    "timestamp": "2026-04-04T12:00:00.000Z"
  }
}
```

If the title does not exist, the API returns a 404 error.

## CFR Titles

### List All CFR Titles

```
GET /api/cfr/titles
```

Returns all 50 CFR titles with document and chapter counts. The response shape is identical to the USC title listing.

```bash
curl https://lexbuild.dev/api/cfr/titles
```

```json
{
  "data": [
    {
      "title_number": 1,
      "title_name": "General Provisions",
      "document_count": 134,
      "chapter_count": 4,
      "positive_law": false,
      "url": "/api/cfr/titles/1"
    }
  ],
  "meta": {
    "api_version": "v1",
    "timestamp": "2026-04-04T12:00:00.000Z"
  }
}
```

### Get CFR Title Detail

```
GET /api/cfr/titles/{number}
```

Returns a CFR title with its chapter breakdown.

```bash
curl https://lexbuild.dev/api/cfr/titles/40
```

```json
{
  "data": {
    "title_number": 40,
    "title_name": "Protection of Environment",
    "document_count": 8432,
    "positive_law": false,
    "chapters": [
      {
        "chapter_number": "I",
        "chapter_name": "Environmental Protection Agency",
        "document_count": 7891
      }
    ]
  },
  "meta": {
    "api_version": "v1",
    "timestamp": "2026-04-04T12:00:00.000Z"
  }
}
```

## Federal Register Years

The Federal Register uses a date-based hierarchy instead of titles.

### List All Years

```
GET /api/fr/years
```

Returns all publication years with document counts, sorted in reverse chronological order.

```bash
curl https://lexbuild.dev/api/fr/years
```

```json
{
  "data": [
    {
      "year": 2026,
      "document_count": 8234,
      "url": "/api/fr/years/2026"
    },
    {
      "year": 2025,
      "document_count": 28451,
      "url": "/api/fr/years/2025"
    },
    {
      "year": 2024,
      "document_count": 29102,
      "url": "/api/fr/years/2024"
    }
  ],
  "meta": {
    "api_version": "v1",
    "timestamp": "2026-04-04T12:00:00.000Z"
  }
}
```

### Get Year Detail

```
GET /api/fr/years/{year}
```

Returns month-by-month breakdown for a given year.

```bash
curl https://lexbuild.dev/api/fr/years/2026
```

```json
{
  "data": {
    "year": 2026,
    "document_count": 8234,
    "months": [
      {
        "month": 1,
        "document_count": 2891,
        "url": "/api/fr/years/2026/01"
      },
      {
        "month": 2,
        "document_count": 2654,
        "url": "/api/fr/years/2026/02"
      },
      {
        "month": 3,
        "document_count": 2689,
        "url": "/api/fr/years/2026/03"
      }
    ]
  },
  "meta": {
    "api_version": "v1",
    "timestamp": "2026-04-04T12:00:00.000Z"
  }
}
```

### Get Month Documents

```
GET /api/fr/years/{year}/{month}
```

Returns all documents published in a specific month. The month parameter accepts one or two digits (e.g., `3` or `03` for March).

```bash
curl https://lexbuild.dev/api/fr/years/2026/03
```

```json
{
  "data": {
    "year": 2026,
    "month": 3,
    "document_count": 2689,
    "documents": [
      {
        "id": "fr-2026-05001",
        "identifier": "/us/fr/2026-05001",
        "document_number": "2026-05001",
        "display_title": "Air Quality Standards for Ozone",
        "document_type": "rule",
        "publication_date": "2026-03-01",
        "agency": "Environmental Protection Agency"
      },
      {
        "id": "fr-2026-05002",
        "identifier": "/us/fr/2026-05002",
        "document_number": "2026-05002",
        "display_title": "Request for Comments on Proposed Banking Regulations",
        "document_type": "notice",
        "publication_date": "2026-03-01",
        "agency": "Federal Deposit Insurance Corporation"
      }
    ]
  },
  "meta": {
    "api_version": "v1",
    "timestamp": "2026-04-04T12:00:00.000Z"
  }
}
```

If no documents exist for the requested year or month, the API returns a 404 error.

## Combining Hierarchy and Document Endpoints

The hierarchy endpoints are useful for discovery and navigation. Once you know the structure, use the document endpoints to retrieve content:

```bash
# 1. Browse USC titles
curl https://lexbuild.dev/api/usc/titles

# 2. See chapters in Title 42
curl https://lexbuild.dev/api/usc/titles/42

# 3. List sections in that title
curl "https://lexbuild.dev/api/usc/documents?title_number=42&limit=50"

# 4. Retrieve a specific section
curl https://lexbuild.dev/api/usc/documents/t42/s1983
```
