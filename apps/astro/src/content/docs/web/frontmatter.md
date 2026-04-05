---
title: "Frontmatter"
description: "Understand the YAML frontmatter metadata on every section page, including common fields and source-specific fields for USC, eCFR, and Federal Register."
order: 4
---

# Frontmatter

Every section on lexbuild.dev includes YAML frontmatter metadata at the top of the Markdown file. This metadata describes the section's identity, source, currency, and legal status. It is visible in the Markdown tab and in the dedicated frontmatter panel above the content viewer.

## Frontmatter Panel

The frontmatter panel appears on every section page and provides two views:

- **YAML view** -- Shows the raw YAML block exactly as it appears in the `.md` file
- **Preview view** -- Displays the same fields in a structured grid for easier scanning

Toggle between views using the tabs in the panel toolbar.

## The `source` Field

The `source` field tells you which legal source produced the section. Its value determines which source-specific fields are present:

| Source value | Legal source |
|---|---|
| `"usc"` | U.S. Code |
| `"ecfr"` | Code of Federal Regulations (eCFR) |
| `"fr"` | Federal Register |

When consuming frontmatter programmatically, check `source` first to know which additional fields to expect.

## Common Fields

These fields appear on every section regardless of source:

| Field | Description |
|---|---|
| `identifier` | Canonical URI path (e.g., `/us/usc/t1/s1`, `/us/cfr/t17/s240.10b-5`, `/us/fr/2026-06029`) |
| `title` | Human-readable heading for the section |
| `source` | Source discriminator (`"usc"`, `"ecfr"`, or `"fr"`) |
| `title_number` | Title number as a string (e.g., `"1"`, `"17"`) |
| `section_number` | Section number as a string (e.g., `"1"`, `"240.10b-5"`) |
| `format_version` | LexBuild output format version |
| `generator` | Name and version of the generator that produced the file |
| `last_updated` | Date the file was last generated |
| `legal_status` | Current status of the section (e.g., `"current"`, `"repealed"`) |

## USC-Specific Fields

Sections from the U.S. Code include these additional fields:

| Field | Description |
|---|---|
| `positive_law` | Whether the title has been enacted as positive law (`true` or `false`) |
| `currency` | Currency statement from the Office of the Law Revision Counsel |
| `source_credit` | Source credit line citing the originating public law |
| `status` | Section status (e.g., `"current"`, `"repealed"`, `"transferred"`) |

## eCFR-Specific Fields

Sections from the Code of Federal Regulations include these additional fields:

| Field | Description |
|---|---|
| `authority` | Authority citation for the regulatory part |
| `agency` | Issuing agency name |
| `cfr_part` | CFR part number |
| `ecfr_updated` | Date the eCFR data was last updated by GPO |

## FR-Specific Fields

Sections from the Federal Register include these additional fields:

| Field | Description |
|---|---|
| `document_number` | Federal Register document number (e.g., `"2026-06029"`) |
| `document_type` | Type of document (`"rule"`, `"notice"`, `"proposed_rule"`, `"presidential"`) |
| `publication_date` | Date the document was published in the Federal Register |
| `agencies` | List of agencies associated with the document |
| `fr_citation` | Federal Register volume and page citation |
| `effective_date` | Date the rule or action takes effect |
| `comments_close_date` | Deadline for public comments (proposed rules) |
| `docket_ids` | Associated docket identifiers |
| `cfr_references` | CFR parts affected by the document |

## Complete Schema

For the full output format specification, including all field types, constraints, and edge cases, see the [Output Format Spec](/docs/reference/output-format).
