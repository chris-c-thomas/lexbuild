---
title: "Output Format"
description: "Understand the Markdown output format, YAML frontmatter schema, sidecar files, and how granularity affects file structure."
order: 6
---

# Output Format

Every converted legal document produces a standalone Markdown file with YAML frontmatter and a Markdown body. The frontmatter provides structured metadata for programmatic access, while the body contains the human-readable legal text.

## File Structure

Each `.md` file follows this format:

```
---
(YAML frontmatter)
---

(Markdown body)
```

The frontmatter and body are self-contained. Any single file can be ingested by an AI system, search index, or RAG pipeline without needing external context.

## Frontmatter Fields

### Common Fields

These fields appear on every output file regardless of source:

| Field | Type | Description |
|---|---|---|
| `identifier` | string | Canonical URI path (e.g., `/us/usc/t1/s1`) |
| `source` | string | Content source: `"usc"`, `"ecfr"`, or `"fr"` |
| `legal_status` | string | Provenance status (e.g., `"official"`, `"unofficial"`) |
| `title` | string | Human-readable display title |
| `title_number` | number | Title number |
| `title_name` | string | Title name (e.g., `"General Provisions"`) |
| `positive_law` | boolean | Whether the title has been enacted as positive law |
| `currency` | string | Release point ID or date indicating data freshness |
| `last_updated` | string | ISO date from the XML source |
| `format_version` | string | Output format version (currently `"1.1.0"`) |
| `generator` | string | Generator identifier (e.g., `"lexbuild@0.9.0"`) |

### Section-Level Fields

Included when the output represents an individual section:

| Field | Type | Description |
|---|---|---|
| `section_number` | string | Section number (can be alphanumeric, e.g., `"7801"`, `"240.10b-5"`) |
| `section_name` | string | Section heading text |
| `chapter_number` | number | Parent chapter number |
| `chapter_name` | string | Parent chapter name |
| `source_credit` | string | Full source credit text (USC) |
| `status` | string | Section status if applicable (e.g., `"repealed"`, `"transferred"`) |

### Title-Level Fields

Included when using `title` granularity:

| Field | Type | Description |
|---|---|---|
| `chapter_count` | number | Total chapters in the title |
| `section_count` | number | Total sections in the title |
| `total_token_estimate` | number | Estimated token count for the entire title |

### USC-Specific Fields

| Field | Type | Description |
|---|---|---|
| `positive_law` | boolean | Whether the title is positive law |
| `source_credit` | string | Statutory source credit annotation |
| `status` | string | Section status (e.g., `"repealed"`) |

### eCFR-Specific Fields

| Field | Type | Description |
|---|---|---|
| `authority` | string | Regulatory authority citation |
| `regulatory_source` | string | Source/provenance note |
| `agency` | string | Responsible federal agency |
| `cfr_part` | string | CFR part number (e.g., `"240"`) |
| `cfr_subpart` | string | CFR subpart identifier |
| `part_count` | number | Number of parts (title-level only) |

### FR-Specific Fields

| Field | Type | Description |
|---|---|---|
| `document_number` | string | FR document number (e.g., `"2026-06029"`) |
| `document_type` | string | Document type (e.g., `"rule"`, `"proposed_rule"`, `"notice"`) |
| `fr_citation` | string | Full citation (e.g., `"91 FR 14523"`) |
| `fr_volume` | number | FR volume number |
| `publication_date` | string | Publication date (YYYY-MM-DD) |
| `agencies` | string[] | Publishing/responsible agencies |
| `cfr_references` | string[] | CFR title/part references |
| `docket_ids` | string[] | Docket identifiers |
| `rin` | string | Regulation Identifier Number |
| `effective_date` | string | Effective date of the rule |
| `comments_close_date` | string | Comment period closing date |
| `fr_action` | string | Action description (e.g., `"Final rule"`) |

> [!NOTE]
> FR-specific fields like `agencies`, `cfr_references`, and `docket_ids` are populated by the `enrich-fr` command. Documents converted without enrichment will have fewer metadata fields.

## Example Frontmatter

### U.S. Code Section

```yaml
---
identifier: "/us/usc/t1/s1"
source: "usc"
legal_status: "official"
title: "1 USC \u00A7 1 - Words denoting number, gender, and so forth"
title_number: 1
title_name: "General Provisions"
section_number: "1"
section_name: "Words denoting number, gender, and so forth"
chapter_number: 1
chapter_name: "Rules of Construction"
positive_law: true
currency: "119-73"
last_updated: "2025-03-15"
format_version: "1.1.0"
generator: "lexbuild@0.9.0"
source_credit: "(July 30, 1947, ch. 388, 61 Stat. 633.)"
---
```

### eCFR Section

```yaml
---
identifier: "/us/cfr/t17/s240.10b-5"
source: "ecfr"
legal_status: "unofficial"
title: "17 CFR \u00A7 240.10b-5 - Employment of manipulative and deceptive devices"
title_number: 17
title_name: "Commodity and Securities Exchanges"
section_number: "240.10b-5"
section_name: "Employment of manipulative and deceptive devices"
chapter_number: 2
chapter_name: "Securities and Exchange Commission"
part_number: "240"
part_name: "General Rules and Regulations, Securities Exchange Act of 1934"
positive_law: false
currency: "2026-04-01"
last_updated: "2026-04-01"
format_version: "1.1.0"
generator: "lexbuild@0.9.0"
authority: "15 U.S.C. 78a et seq."
agency: "Securities and Exchange Commission"
cfr_part: "240"
---
```

## Sidecar Files

At `section` and `part` granularity, each directory includes two sidecar files:

### `_meta.json`

A machine-readable index of all children in the directory. Useful for building navigation or retrieving content without parsing every `.md` file.

```json
{
  "title_number": 1,
  "title_name": "General Provisions",
  "children": [
    {
      "identifier": "/us/usc/t1/s1",
      "title": "Words denoting number, gender, and so forth",
      "filename": "section-1.md"
    }
  ]
}
```

### `README.md`

A human-readable summary of the directory's contents, including the hierarchy path and a list of child items.

> [!NOTE]
> At `title` granularity, no sidecar files are generated. Each title is a single flat `.md` file.

## Token Estimates

Every file includes an estimated token count in the `total_token_estimate` frontmatter field (title-level granularity) or as part of the conversion summary output. Token counts use a character/4 heuristic, which provides a reasonable approximation for English legal text across most tokenizers.

## Granularity and Output

The granularity setting controls how much content goes into each file:

| Granularity | File Count (approx.) | File Size | Use Case |
|---|---|---|---|
| `section` | ~60k (USC), ~200k (eCFR) | Small (1-50 KB) | RAG, search indexing, fine-grained retrieval |
| `chapter` / `part` | ~2k-5k | Medium (50-500 KB) | Topic-level analysis, chapter summaries |
| `title` | 54 (USC), 50 (eCFR) | Large (1-100 MB) | Whole-title processing, archival |

At coarser granularity levels, sections are inlined under their parent headings. The heading hierarchy is preserved using Markdown heading levels (H1 through H6).
