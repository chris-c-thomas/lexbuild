# Output Format Specification

LexBuild produces structured Markdown files with YAML frontmatter and JSON sidecar indexes, designed for direct ingestion into RAG pipelines, vector databases, and LLM context windows. This document is the authoritative reference for the output format across all three granularity modes. Downstream consumers should rely on this specification when building parsers, importers, or embedding pipelines.

## Format Versioning

The output format is versioned independently of the LexBuild CLI. The current version is **`1.0.0`**, defined as the `FORMAT_VERSION` constant in `@lexbuild/core` (`packages/core/src/markdown/frontmatter.ts`). Breaking changes to the output structure, frontmatter schema, or `_meta.json` schema will increment the major version.

The format version is recorded in two places:

- `format_version` field in YAML frontmatter (every `.md` file)
- `format_version` field in `_meta.json` sidecar files

Consumers should check this field and fail gracefully if they encounter an unexpected major version.

---

## Directory Layout

LexBuild supports three granularity modes, each producing a different directory structure. The mode is selected with `-g, --granularity` on the CLI.

### Section Granularity (default)

One `.md` file per section, organized into chapter directories within title directories:

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
        ├── chapter-{NN}/
        │   ├── _meta.json
        │   ├── subchapter-{ID}/
        │   │   ├── section-{ID}.md
        │   │   └── ...
        │   └── ...
        └── ...
```

### Chapter Granularity

One `.md` file per chapter, with all sections inlined:

```
{output_root}/
└── usc/
    └── title-{NN}/
        ├── _meta.json
        ├── README.md
        ├── chapter-{NN}/
        │   └── chapter-{NN}.md
        ├── chapter-{NN}/
        │   └── chapter-{NN}.md
        └── ...
```

### Title Granularity

One `.md` file per title with no subdirectories. All metadata is embedded in enriched frontmatter:

```
{output_root}/
└── usc/
    ├── title-01.md
    ├── title-02.md
    ├── ...
    └── title-54.md
```

No `_meta.json` or `README.md` sidecar files are produced in title-level mode. Each file is fully self-contained.

> **Memory note:** Title-level mode holds the entire title AST and rendered Markdown in memory before writing. Large titles (e.g., Title 26 at ~53 MB XML or Title 42 at ~107 MB XML) may require 500 MB+ RSS.

### Naming Conventions

| Component | Pattern | Examples | Notes |
|-----------|---------|----------|-------|
| Title directory | `title-{NN}` | `title-01`, `title-26`, `title-54` | 2-digit zero-padded |
| Appendix directory | `title-{NN}-appendix` | `title-05-appendix`, `title-11-appendix` | Titles 5, 11, 18, 28 |
| Chapter directory/file | `chapter-{NN}` | `chapter-01`, `chapter-99` | 2-digit zero-padded |
| Subchapter directory | `subchapter-{ID}` | `subchapter-I`, `subchapter-II` | Roman numeral IDs |
| Section file | `section-{ID}.md` | `section-1.md`, `section-7801.md`, `section-202a.md` | NOT zero-padded; may be alphanumeric |
| Title-level file | `title-{NN}.md` | `title-01.md`, `title-26.md` | Title granularity only |
| Metadata sidecar | `_meta.json` | | Section and chapter granularity only |
| Directory overview | `README.md` | | Section and chapter granularity only |

**Section IDs** match the `value` attribute of the `<num>` element in the source XML. They are typically numeric but can be alphanumeric (e.g., `202a`, `7701-1`).

**Duplicate sections** within a title are disambiguated with `-2`, `-3` suffixes: `section-3598.md`, `section-3598-2.md`.

**Appendix directories** contain compiled acts, court rules, and reorganization plans for titles that have appendices.

---

## Frontmatter Schema

Every `.md` file begins with YAML frontmatter enclosed in `---` delimiters.

### Section-Level Frontmatter

All section-level files (the default granularity) include the following fields:

```yaml
---
# Required identification
identifier: "/us/usc/t1/s1"              # USLM canonical URI identifier
title: "1 USC § 1 - Words denoting..."    # Human-readable display title
title_number: 1                            # Integer
title_name: "General Provisions"           # String (from <heading> element)
section_number: "1"                        # String (may be alphanumeric)
section_name: "Words denoting number..."   # String (from section <heading>)

# Required structural context
chapter_number: 1                          # Integer
chapter_name: "Rules of Construction"      # String

# Optional structural context (present when the structure exists)
subchapter_number: "II"                    # String (often Roman numerals)
subchapter_name: "Other Provisions"        # String
part_number: "A"                           # String
part_name: "General Rules"                 # String

# Metadata
positive_law: true                         # Boolean — is this title positive law?
currency: "119-73"                         # OLRC release point identifier
last_updated: "2025-12-03"                # ISO date from XML generation
format_version: "1.0.0"                   # Output format version (FORMAT_VERSION)
generator: "lexbuild@1.4.2"               # Generator package and version

# Optional fields
source_credit: "(July 30, 1947, ...)"     # Full source credit text (included by default)
status: "repealed"                         # Only present for non-current sections
---
```

### Title-Level Frontmatter

When using `--granularity title`, the frontmatter includes enriched aggregate fields and omits section-scoped fields:

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
generator: "lexbuild@1.4.2"
chapter_count: 3                           # Number of chapters in this title
section_count: 39                          # Total sections in this title
total_token_estimate: 35000                # Estimated tokens for the entire file
---
```

The `chapter_count`, `section_count`, and `total_token_estimate` fields are exclusive to title-level output. The `section_number`, `section_name`, `chapter_number`, `chapter_name`, and `source_credit` fields are omitted.

---

## Content Structure

### Section Files (Section and Chapter Granularity)

Each section file follows this organization:

```markdown
# § {number}. {heading}

{chapeau text, if present}

{subsection/paragraph content with inline formatting}

{continuation text, if present}

---

**Source Credit**: {source credit text}

{Notes sections, if included via CLI flags}
```

The `# § {number}. {heading}` heading reproduces the `<num>` and `<heading>` elements from the source XML.

### Title-Level Heading Hierarchy

Title-level output renders each structural level ("big level") as a Markdown heading, with sections appearing one heading level below their containing structural level:

```markdown
# Title 1— GENERAL PROVISIONS
## CHAPTER 1— RULES OF CONSTRUCTION
### § 1. Words denoting number, gender, and so forth
**(a)** In determining the meaning...
```

Structural headings use H1 through H5. Sections always render one level below their containing structure, capped at H6. This keeps sections visually distinct from their containers:

```markdown
# Title 26— INTERNAL REVENUE CODE
## Subtitle A— Income Taxes
### CHAPTER 1— NORMAL TAXES AND SURTAXES
#### Subchapter A— Determination of Tax Liability
##### PART I— TAX ON INDIVIDUALS
###### § 1. Tax imposed
**(a)** Married individuals filing joint returns...
```

When structural nesting exceeds 5 levels (e.g., a Subpart under a Part under a Subchapter), the deeper levels fall back to bold text to avoid exceeding H6:

```markdown
##### PART I— TAX ON INDIVIDUALS
**Subpart A— Changes in Rates**
###### § 1. Tax imposed
```

Big-level headings reproduce the `<num>` and `<heading>` text from the source XML verbatim (e.g., `CHAPTER 1—`).

---

## Inline Hierarchy Formatting

Subsections and all levels below them are NOT rendered as Markdown headings. Instead, they use bold inline numbering to preserve a flat document structure optimal for RAG chunking:

```markdown
**(a)** **Heading text.** — Content of subsection (a)...

**(1)** Content of paragraph (1)...

**(A)** Content of subparagraph (A)...

**(i)** Content of clause (i)...

**(I)** Content of subclause (I)...

**(aa)** Content of item (aa)...
```

**Key design choice:** Indentation is NOT used in the Markdown source. Markdown indentation creates code blocks, which would break downstream rendering. The legal hierarchy is communicated solely through the numbering scheme, which mirrors standard legal citation conventions:

| Level | Numbering Style | Example |
|-------|----------------|---------|
| Subsection | Lowercase alpha | `**(a)**`, `**(b)**` |
| Paragraph | Arabic | `**(1)**`, `**(2)**` |
| Subparagraph | Uppercase alpha | `**(A)**`, `**(B)**` |
| Clause | Lowercase Roman | `**(i)**`, `**(ii)**` |
| Subclause | Uppercase Roman | `**(I)**`, `**(II)**` |
| Item | Double lowercase | `**(aa)**`, `**(bb)**` |
| Subitem | Double uppercase | `**(AA)**`, `**(BB)**` |
| Subsubitem | Triple lowercase | `**(aaa)**` |

When a subsection has a heading, it is rendered inline in bold after the number designation: `**(a)** **Heading text.** — Content...`

---

## Notes Rendering

By default, LexBuild includes the core statutory text, source credits, and notes. You can disable notes entirely with `--no-include-notes` or selectively include subsets via CLI flags (`--include-editorial-notes`, `--include-statutory-notes`, `--include-amendments`).

When included, notes appear after the source credit separator, organized by category:

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

The two top-level categories ("Editorial Notes" and "Statutory Notes and Related Subsidiaries") correspond to cross-heading notes (`<note role="crossHeading">`) in the source XML. Within each category, notes are grouped by their `@topic` attribute (e.g., `amendments`, `changeOfName`, `effectiveDateOfAmendment`).

### Footnotes

Footnotes in the statutory text are rendered using Markdown footnote syntax:

- At the reference site: `[^1]`
- At the bottom of the section file: `[^1]: Footnote text here.`

---

## Cross-Reference Links

Cross-references from `<ref href="...">` elements are resolved based on the `--link-style` option:

### `plaintext` (default)

All references render as plain text with no link:

```markdown
See section 285b of title 2
```

### `relative`

References to sections within the converted corpus use relative Markdown links. References outside the corpus fall back to OLRC URLs:

```markdown
<!-- Internal — target exists in output corpus -->
See [section 285b of Title 2](../../title-02/chapter-09/section-285b.md)

<!-- External — Statutes at Large, Public Laws, etc. -->
See [42 USC § 1983](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section1983)
```

### `canonical`

All USC references resolve to OLRC website URLs:

```markdown
See [section 285b of title 2](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title2-section285b)
```

Only `/us/usc/...` references are eligible for Markdown link conversion. References to Statutes at Large (`/us/stat/...`) and Public Laws (`/us/pl/...`) always render as plain text citations regardless of link style.

---

## Tables

### Simple Tables

Tables without `colspan` or `rowspan` render as standard Markdown pipe tables:

```markdown
| Column A | Column B | Column C |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
```

### Complex Tables

Tables with `colspan`, `rowspan`, or deeply nested content render as fenced HTML to preserve structure:

```html
<table>
  <tr>
    <td colspan="2">Merged cell</td>
  </tr>
</table>
```

Both XHTML `<table>` elements (from the `http://www.w3.org/1999/xhtml` namespace) and USLM `<layout>` elements (from the default USLM namespace) are converted. See the [XML Element Reference](xml-element-reference.md) for details on the two table element families.

---

## Metadata Index (`_meta.json`)

Sidecar `_meta.json` files provide structured indexes for programmatic access without parsing Markdown. They are produced in section and chapter granularity modes only.

### Title-Level Index

Located at `{output_root}/usc/title-{NN}/_meta.json`:

```json
{
  "format_version": "1.0.0",
  "generator": "lexbuild@1.4.2",
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

Located at `{output_root}/usc/title-{NN}/chapter-{NN}/_meta.json`:

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

### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `format_version` | string | Output format version (`"1.0.0"`) |
| `generator` | string | LexBuild version that produced the output |
| `generated_at` | string | ISO 8601 timestamp of generation |
| `identifier` | string | USLM canonical URI for the scope |
| `granularity` | string | `"section"` or `"chapter"` (title-level `_meta.json` only) |
| `stats.chapter_count` | number | Number of chapters (title-level only) |
| `stats.section_count` | number | Number of sections in scope |
| `stats.total_files` | number | Total output files written (title-level only) |
| `stats.total_tokens_estimate` | number | Sum of all section token estimates |
| `chapters[].directory` | string | Relative directory path for the chapter |
| `sections[].file` | string | Relative file path for the section |
| `sections[].token_estimate` | number | Estimated token count for this section |
| `sections[].has_notes` | boolean | Whether the section has notes content |
| `sections[].status` | string | Legal status of the section |

---

## Token Estimation

The `token_estimate` field uses a **character/4 heuristic**: `Math.ceil(contentLength / 4)`. This provides a reasonable approximation for RAG chunk planning without adding a tokenizer dependency.

The estimate counts the rendered Markdown content length (excluding frontmatter). It corresponds roughly to GPT-style BPE token counts for English legal text, which typically tokenizes at 3.5-4.5 characters per token.

Precise `tiktoken`-based counting is planned as a future enhancement (`--precise-tokens`).

---

## Section Status Values

The `status` field in frontmatter and `_meta.json` indicates the legal state of a section. Sections without a `status` field (or with `status: "current"`) represent active law.

| Status | Meaning |
|--------|---------|
| `current` | Active law (default, may be omitted from frontmatter) |
| `repealed` | Section has been repealed by subsequent legislation |
| `transferred` | Section transferred to another location in the Code |
| `omitted` | Section omitted from the Code |
| `reserved` | Section number reserved for future use |
| `renumbered` | Section renumbered to a different designation |
| `redesignated` | Section redesignated under a different identifier |
| `expired` | Section has expired per its own terms |
| `terminated` | Section terminated |
| `suspended` | Section temporarily suspended |

The full USLM schema defines 18 status values (see [XML Element Reference](xml-element-reference.md#universal-attributes)). The values above are the ones commonly encountered in U.S. Code output.

---

## RAG Integration Guidance

### Recommended Chunking Strategy

For **section-level output** (default), each `.md` file is typically 500-3,000 tokens, well-sized for most embedding models. For large sections exceeding your model's context window:

1. Use the frontmatter `identifier` as the chunk ID
2. Split on `## ` headings (note sections) to separate statutory text from notes
3. Keep the frontmatter attached to the first chunk as context

For **chapter-level output**, each file contains all sections for a chapter. Split on `# §` headings to recover per-section chunks, using the USLM identifier pattern for IDs.

For **title-level output**, each file can be very large (100K+ tokens for major titles). This mode is designed for feeding whole titles into LLM context windows rather than for chunked vector storage.

### Recommended Metadata for Vector Store

When ingesting into a vector database, extract these frontmatter fields for filtering and retrieval:

| Field | Use |
|-------|-----|
| `identifier` | Unique key; enables precise citation lookup |
| `title_number` | Filter by title |
| `chapter_number` | Filter by chapter |
| `section_number` | Sort/filter by section |
| `positive_law` | Filter for authoritative vs. prima facie evidence |
| `status` | Exclude repealed/reserved sections from search |

### File Path as Stable ID

The output file path (e.g., `usc/title-01/chapter-01/section-1.md`) is **deterministic and stable** across conversions of the same release point. It can be used as a document ID in RAG systems, deduplication keys, or cache invalidation tokens.

The path changes only when:
- The OLRC release point changes (new legislation enacted)
- The output format version changes (major version bump)

---

## Related Documentation

- [Conversion Pipeline](../architecture/conversion-pipeline.md) -- how XML becomes Markdown
- [U.S. Code Package](../packages/usc.md) -- converter implementation details
- [XML Element Reference](xml-element-reference.md) -- source XML elements and their Markdown mapping
- [CLI Reference](cli-reference.md) -- command-line options for controlling output
