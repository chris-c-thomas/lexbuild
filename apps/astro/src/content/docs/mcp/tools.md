---
title: "Tools"
description: "Reference for the five MCP tools exposed by the LexBuild MCP server: search, retrieve, list, and browse legal content."
order: 3
---

# Tools

The LexBuild MCP server exposes five read-only tools. All tools are idempotent and make no changes to the underlying data.

## search_laws

Full-text search across the U.S. Code, Code of Federal Regulations, and Federal Register. Returns ranked results with snippets and canonical identifiers.

### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `query` | string | Yes | -- | Natural language or keyword query (2--256 characters). Supports quoted phrases. |
| `source` | `"usc"` \| `"cfr"` \| `"fr"` | No | All sources | Restrict search to a specific source |
| `title` | integer | No | -- | Restrict to a specific title number. Only meaningful with a single source. |
| `limit` | integer | No | 10 | Maximum results (1--25) |
| `offset` | integer | No | 0 | Pagination offset |

### Example

> "Search for securities fraud in the CFR"

The assistant calls `search_laws` with `query: "securities fraud"` and `source: "cfr"`, returning results like 17 CFR 240.10b-5.

### Response

Returns an array of hits with `identifier`, `source`, `heading`, `snippet`, `hierarchy`, and `url`. Includes `total`, `has_more`, and pagination fields.

---

## get_section

Fetch the full text of a single legal section by its canonical identifier. Returns Markdown with structured metadata.

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `source` | `"usc"` \| `"cfr"` \| `"fr"` | Yes | Legal source type |
| `identifier` | string | Yes | Section identifier (see examples below) |

**Identifier formats:**

| Source | Format | Example |
|---|---|---|
| USC | `/us/usc/t{title}/s{section}` | `/us/usc/t5/s552` |
| CFR | `/us/cfr/t{title}/s{section}` | `/us/cfr/t17/s240.10b-5` |
| FR | Document number | `2026-06029` |

Short forms like `t5/s552` are also accepted.

### Example

> "Show me the full text of 5 USC 552"

The assistant calls `get_section` with `source: "usc"` and `identifier: "/us/usc/t5/s552"`.

### Response

Returns `identifier`, `source`, `metadata` (title, section name, chapter, legal status), `body` (full Markdown text), and `url` (link to lexbuild.dev).

---

## list_titles

Enumerate available titles for USC or CFR, or available years for the Federal Register. Use this to discover what content is available before drilling in.

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `source` | `"usc"` \| `"cfr"` \| `"fr"` | Yes | For `usc`/`cfr`, returns titles. For `fr`, returns years. |

### Example

> "What titles are in the U.S. Code?"

The assistant calls `list_titles` with `source: "usc"`, returning all 54 titles with names and document counts.

### Response

For USC/CFR: array of `{ title_number, title_name, document_count, chapter_count }`.

For FR: array of `{ year, document_count }`.

---

## get_title

Get detail for a specific title (USC/CFR) or year (FR). Returns chapter breakdowns for titles or monthly breakdowns for years.

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `source` | `"usc"` \| `"cfr"` \| `"fr"` | Yes | Legal source type |
| `number` | integer | Yes | Title number (USC/CFR) or year (FR). Examples: `5` for USC Title 5, `2026` for FR year 2026. |

### Example

> "Show me the chapters in USC Title 18"

The assistant calls `get_title` with `source: "usc"` and `number: 18`, returning all chapters in the federal criminal code with section counts.

### Response

For USC/CFR: `title_number`, `title_name`, `document_count`, and `chapters[]` array with `chapter_number`, `chapter_name`, `document_count`.

For FR: `year`, `document_count`, and `months[]` array with `month`, `document_count`.

---

## get_federal_register_document

Fetch a Federal Register document by its document number. This is a convenience tool for FR documents, equivalent to calling `get_section` with `source: "fr"`.

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `document_number` | string | Yes | Federal Register document number (e.g., `2026-06029`) |

### Example

> "Get Federal Register document 2026-06029"

The assistant calls `get_federal_register_document` with `document_number: "2026-06029"`.

### Response

Returns `identifier`, `source`, `metadata` (publication date, agencies, document type, CFR references), `body` (full Markdown), and `url`.
