# Output Format Specification

This document specifies the output format of LexBuild for downstream consumers (RAG pipelines, search indexes, embedding systems).

## Versioning

This specification is versioned independently of the CLI. The current version is `1.0.0`. Breaking changes to the output format increment the major version. The output format version is recorded in `_meta.json` files as `format_version`.

---

## Directory Layout

### Section-Level Granularity (default)

```
{output_root}/
└── usc/
    └── title-{NN}/
        ├── _meta.json
        ├── README.md
        ├── chapter-{NN}/
        │   ├── _meta.json
        │   ├── section-{ID}.md
        │   ├── section-{ID}.md
        │   └── ...
        └── chapter-{NN}/
            └── ...
```

### Chapter-Level Granularity

```
{output_root}/
└── usc/
    └── title-{NN}/
        ├── _meta.json
        ├── README.md
        ├── chapter-{NN}.md
        ├── chapter-{NN}.md
        └── ...
```

### Title-Level Granularity

```
{output_root}/
└── usc/
    ├── title-{NN}.md
    ├── title-{NN}.md
    └── ...
```

No `_meta.json` or `README.md` sidecar files are produced in title-level mode. All metadata is embedded in enriched YAML frontmatter (see [Title-Level Frontmatter](#title-level-frontmatter) below). This makes each file fully self-contained — suitable for feeding a whole title to an LLM context window.

### Naming Conventions

| Component | Pattern | Examples |
|-----------|---------|----------|
| Title directory | `title-{NN}` (2-digit zero-padded) | `title-01`, `title-26`, `title-54` |
| Appendix directory | `title-{NN}-appendix` | `title-05-appendix`, `title-11-appendix` |
| Chapter directory/file | `chapter-{NN}` (2-digit zero-padded) | `chapter-01`, `chapter-99` |
| Subchapter directory | `subchapter-{ID}` | `subchapter-I`, `subchapter-II` |
| Section file | `section-{ID}.md` (NOT zero-padded) | `section-1.md`, `section-7801.md`, `section-202a.md` |
| Metadata sidecar | `_meta.json` | -- |
| Directory overview | `README.md` | -- |

Titles with appendices (5, 11, 18, 28) produce a sibling appendix directory containing compiled acts, court rules, and reorganization plans.

Section IDs match the `@value` attribute of the `<num>` element in the source XML. They are typically numeric but can be alphanumeric (e.g., `202a`, `7701-1`). Duplicate section numbers within a title are disambiguated with a `-2`, `-3` suffix (e.g., `section-3598-2.md`).

---

## Markdown File Structure

Every `.md` file follows this structure:

```markdown
---
{YAML frontmatter}
---

{Markdown content}
```

### Frontmatter Schema

All section-level files include the following YAML frontmatter fields:

```yaml
---
# Required fields
identifier: "/us/usc/t1/s1"              # USLM canonical identifier
title: "1 USC § 1 - Words denoting..."    # Human-readable display title
title_number: 1                            # Integer
title_name: "General Provisions"           # String
section_number: "1"                        # String (may be alphanumeric)
section_name: "Words denoting number..."   # String

# Required context fields
chapter_number: 1                          # Integer (omitted if not applicable)
chapter_name: "Rules of Construction"      # String

# Optional context (present when structure exists)
subchapter_number: "II"                    # String (often Roman numerals)
subchapter_name: "Other Provisions"        # String
part_number: "A"                           # String
part_name: "General Rules"                 # String

# Metadata
positive_law: true                         # Boolean
currency: "119-73"                         # Release point identifier
last_updated: "2025-12-03"                # ISO date from XML generation
format_version: "1.0.0"                   # Output format version
generator: "lexbuild@0.5.0"                 # Generator version

# Optional
source_credit: "(July 30, 1947, ...)"     # Full source credit text (included by default)
status: "repealed"                         # Only present for non-current sections
---
```

### Title-Level Frontmatter

When using `--granularity title`, the frontmatter includes additional enriched fields:

```yaml
---
identifier: "/us/usc/t1"
title: "Title 1 — GENERAL PROVISIONS"
title_number: 1
title_name: "GENERAL PROVISIONS"
positive_law: true
currency: "119-73"
last_updated: "2025-12-03"
format_version: "1.0.0"
generator: "lexbuild@1.0.6"
chapter_count: 3
section_count: 39
total_token_estimate: 35000
---
```

Title-level frontmatter omits `section_number` and `section_name` (those are section-scoped fields). The `chapter_count`, `section_count`, and `total_token_estimate` fields are only present in title-level output.

### Title-Level Heading Hierarchy

Title-level output renders each big level as a Markdown heading, with sections one level below their containing big level:

```markdown
# Title 1— GENERAL PROVISIONS
## CHAPTER 1— RULES OF CONSTRUCTION
### § 1. Words denoting number, gender, and so forth
**(a)** In determining the meaning...
```

Big-level headings reproduce the `<num>` and `<heading>` text from the source XML verbatim (e.g., `CHAPTER 1—`).

For deeply nested titles, headings are capped at H6. Sections always render one heading level below their containing big level:

```markdown
# Title 26— INTERNAL REVENUE CODE
## Subtitle A— Income Taxes
### CHAPTER 1— NORMAL TAXES AND SURTAXES
#### Subchapter A— Determination of Tax Liability
##### PART I— TAX ON INDIVIDUALS
###### § 1. Tax imposed
**(a)** Married individuals filing joint returns...
```

### Content Structure

Section files follow this content organization:

```markdown
# § {number}. {heading}

{chapeau text, if present}

{subsection/paragraph content with inline formatting}

{continuation text, if present}

---

**Source Credit**: {source credit text}

{Notes sections, if included via CLI flags}
```

### Inline Hierarchy Formatting

Subsections and below are NOT rendered as Markdown headings. They use bold inline numbering to preserve the flat-file structure optimal for RAG chunking:

```markdown
**(a)** **Heading text.** — Content of subsection (a)...

**(1)** Content of paragraph (1)...

**(A)** Content of subparagraph (A)...

**(i)** Content of clause (i)...
```

Indentation is NOT used in the Markdown source (it would create code blocks). The hierarchy is communicated solely through the numbering scheme, which mirrors legal citation convention.

### Notes Rendering

When notes are included, they appear after the source credit, organized by category:

```markdown
---

**Source Credit**: (July 30, 1947, ch. 388, 61 Stat. 633.)

## Editorial Notes

### Amendments

**2012** — Pub. L. 112-231 struck out...

**1951** — Act Oct. 31, 1951, substituted...

## Statutory Notes and Related Subsidiaries

### Change of Name

"Director of the Government Publishing Office" substituted for...

### Effective Date of 1984 Amendment

Amendment by Pub. L. 98-497 effective Apr. 1, 1985...
```

### Cross-Reference Links

Cross-references in the source XML (`<ref href="...">`) are converted to Markdown links:

```markdown
<!-- Internal (target exists in output corpus) -->
See [section 285b of Title 2](../../title-02/chapter-09/section-285b.md)

<!-- External (target not in output corpus) -->
See [42 USC § 1983](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section1983)
```

### Tables

Simple tables (no colspan/rowspan) render as Markdown tables:

```markdown
| Column A | Column B | Column C |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
```

Complex tables (with colspan, rowspan, or nested content) render as fenced HTML:

```html
<table>
  <tr>
    <td colspan="2">Merged cell</td>
  </tr>
</table>
```

---

## Metadata Index (`_meta.json`)

### Title-Level Index

```json
{
  "format_version": "1.0.0",
  "generator": "lexbuild@0.5.0",
  "generated_at": "2025-12-03T12:00:00.000Z",
  "identifier": "/us/usc/t1",
  "title_number": 1,
  "title_name": "General Provisions",
  "positive_law": true,
  "currency": "119-73",
  "source_xml": "usc01.xml",
  "granularity": "section",
  "stats": {
    "chapter_count": 3,
    "section_count": 13,
    "total_files": 16,
    "total_tokens_estimate": 12500
  },
  "chapters": [
    {
      "identifier": "/us/usc/t1/ch1",
      "number": 1,
      "name": "Rules of Construction",
      "directory": "chapter-01",
      "sections": [
        {
          "identifier": "/us/usc/t1/s1",
          "number": "1",
          "name": "Words denoting number, gender, and so forth",
          "file": "chapter-01/section-1.md",
          "token_estimate": 850,
          "has_notes": true,
          "status": "current"
        }
      ]
    }
  ]
}
```

### Chapter-Level Index

```json
{
  "format_version": "1.0.0",
  "identifier": "/us/usc/t1/ch1",
  "chapter_number": 1,
  "chapter_name": "Rules of Construction",
  "title_number": 1,
  "section_count": 6,
  "sections": [
    {
      "identifier": "/us/usc/t1/s1",
      "number": "1",
      "name": "Words denoting number, gender, and so forth",
      "file": "section-1.md",
      "token_estimate": 850
    }
  ]
}
```

### Token Estimation

The `token_estimate` field uses a character/4 heuristic (`Math.ceil(contentLength / 4)`) to approximate token counts. This provides a reasonable estimate for RAG chunk planning without requiring a tokenizer dependency.

### Section Status Values

| Status | Meaning |
|--------|---------|
| `current` | Active law |
| `repealed` | Section has been repealed |
| `transferred` | Section transferred to another location |
| `omitted` | Section omitted from the Code |
| `reserved` | Section number reserved for future use |

---

## RAG Integration Guidance

### Recommended Chunking Strategy

For section-level output (default), each `.md` file is typically a good chunk size (500-3000 tokens). For large sections exceeding your embedding model's context window:

1. Use the frontmatter `identifier` as the chunk ID
2. Split on `## ` headings (note sections) to separate the statutory text from notes
3. Keep the frontmatter attached to the first chunk as context

### Recommended Metadata for Vector Store

When ingesting into a vector database, extract these fields from frontmatter for filtering:

- `identifier` -- unique key, enables precise citation lookup
- `title_number` -- filter by title
- `chapter_number` -- filter by chapter
- `positive_law` -- filter for authoritative vs. prima facie evidence
- `section_number` -- sort/filter by section

### File Path as Stable ID

The output file path (`usc/title-01/chapter-01/section-1.md`) is deterministic and stable across conversions of the same release point. It can be used as a document ID in RAG systems.
