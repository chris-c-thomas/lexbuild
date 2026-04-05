---
title: Output Format
description: Full specification for LexBuild's Markdown output format, including YAML frontmatter schema, directory structure, sidecar indexes, content structure, table rendering, and RAG integration guidance.
order: 2
---

This is the authoritative specification for LexBuild's Markdown output format. Every `.md` file that LexBuild produces follows this format, which is designed for RAG pipelines, vector databases, and LLM context windows. If you are building a system that consumes LexBuild output, this is the document you need.

## Format Versioning

The current format version is **1.1.0**, defined by the `FORMAT_VERSION` constant in `@lexbuild/core`. Breaking changes to the output format increment the major version.

The format version is recorded in two places:

- The `format_version` field in every Markdown file's YAML frontmatter.
- The `format_version` field in every `_meta.json` sidecar index.

## Directory Layout

### USC Output

LexBuild supports three output granularities for U.S. Code content. The granularity determines how content is partitioned into files.

**Section granularity** (default):

```
output/usc/
├── title-01/
│   ├── chapter-01/
│   │   ├── section-1.md
│   │   ├── section-2.md
│   │   └── _meta.json
│   ├── chapter-02/
│   │   ├── section-101.md
│   │   └── _meta.json
│   ├── _meta.json
│   └── README.md
└── title-54/
    └── ...
```

**Chapter granularity**:

```
output/usc/
├── title-01/
│   ├── chapter-01/
│   │   └── chapter-01.md
│   ├── chapter-02/
│   │   └── chapter-02.md
│   ├── _meta.json
│   └── README.md
└── ...
```

**Title granularity**:

```
output/usc/
├── title-01.md
├── title-02.md
└── ...
```

Title granularity produces flat files with no subdirectories and no sidecar files. The frontmatter is enriched with aggregate statistics (`chapter_count`, `section_count`, `total_token_estimate`).

### eCFR Output

LexBuild supports four output granularities for Code of Federal Regulations content.

**Section granularity** (default):

```
output/ecfr/
├── title-01/
│   ├── chapter-I/
│   │   ├── part-1/
│   │   │   ├── section-1.1.md
│   │   │   ├── section-1.2.md
│   │   │   └── _meta.json
│   │   └── part-2/
│   │       ├── section-2.1.md
│   │       └── _meta.json
│   ├── _meta.json
│   └── README.md
└── title-50/
    └── ...
```

**Part granularity**:

```
output/ecfr/
├── title-17/
│   ├── chapter-II/
│   │   ├── part-240.md
│   │   └── part-249.md
│   └── ...
└── ...
```

**Chapter granularity**:

```
output/ecfr/
├── title-17/
│   ├── chapter-I.md
│   ├── chapter-II.md
│   └── ...
└── ...
```

**Title granularity**:

```
output/ecfr/
├── title-01.md
├── title-17.md
└── ...
```

### FR Output

Federal Register documents produce one file per document, organized by publication date:

```
output/fr/
├── 2026/
│   ├── 01/
│   │   └── 2026-00123.md
│   └── 03/
│       ├── 2026-06029.md
│       └── 2026-06048.md
└── 2025/
    └── ...
```

No granularity options are available for FR output. FR documents are already atomic (one file per document).

### Naming Conventions

| Component | Pattern | Examples | Notes |
|-----------|---------|----------|-------|
| Title dir (USC) | `title-{NN}` | `title-01`, `title-54` | 2-digit zero-padded |
| Title dir (eCFR) | `title-{NN}` | `title-01`, `title-50` | 2-digit zero-padded |
| Appendix dir | `title-{NN}-appendix` | `title-05-appendix` | USC only: titles 5, 11, 18, 28 |
| Chapter dir (USC) | `chapter-{NN}` | `chapter-01`, `chapter-99` | 2-digit zero-padded |
| Chapter dir (eCFR) | `chapter-{X}` | `chapter-I`, `chapter-IV` | Roman numerals |
| Part dir (eCFR) | `part-{N}` | `part-1`, `part-240` | Not zero-padded |
| Section file (USC) | `section-{ID}.md` | `section-1.md`, `section-7801.md`, `section-202a.md` | Not zero-padded; may be alphanumeric |
| Section file (eCFR) | `section-{N.N}.md` | `section-1.1.md`, `section-240.10b-5.md` | Part-prefixed section number |
| Duplicate sections | `section-{ID}-2.md` | `section-3598-2.md` | USC only; `-2`, `-3` suffix for subsequent occurrences |
| Year dir (FR) | `{YYYY}` | `2026` | 4-digit year |
| Month dir (FR) | `{MM}` | `01`, `03` | 2-digit zero-padded month |
| Document file (FR) | `{doc_number}.md` | `2026-06029.md` | FR document number |

## Frontmatter Schema

Every output file begins with a YAML frontmatter block delimited by `---`. Fields are serialized in a controlled order using double-quoted string values for consistency.

### Common Fields

Every file, regardless of source or granularity, includes these fields:

| Field | Type | Description |
|-------|------|-------------|
| `identifier` | `string` | Canonical URI identifier (e.g., `"/us/usc/t1/s1"`, `"/us/cfr/t17/s240.10b-5"`) |
| `source` | `string` | Content source: `"usc"`, `"ecfr"`, or `"fr"` |
| `legal_status` | `string` | Legal provenance (see [Legal Status Values](#legal-status-values)) |
| `title` | `string` | Human-readable display title |
| `title_number` | `number` | Numeric title designation |
| `title_name` | `string` | Title heading text |
| `positive_law` | `boolean` | Whether the title is enacted as positive law |
| `currency` | `string` | USC: release point identifier (e.g., `"119-73"`); eCFR: ISO date of the conversion run (e.g., `"2025-03-15"`) |
| `last_updated` | `string` | ISO date of the conversion run |
| `format_version` | `string` | Output format version (`"1.1.0"`) |
| `generator` | `string` | Generator identifier (e.g., `"lexbuild@1.5.0"`) |

### USC Section-Level Frontmatter

A complete USC section file includes all common fields plus section-specific context:

```yaml
---
identifier: "/us/usc/t1/s1"
source: "usc"
legal_status: "official_legal_evidence"
title: "1 USC § 1 - Words denoting number, gender, and so forth"
title_number: 1
title_name: "GENERAL PROVISIONS"
section_number: "1"
section_name: "Words denoting number, gender, and so forth"
chapter_number: 1
chapter_name: "RULES OF CONSTRUCTION"
positive_law: true
currency: "119-73"
last_updated: "2025-12-03"
format_version: "1.1.0"
generator: "lexbuild@1.5.0"
source_credit: "(July 30, 1947, ch. 388, 61 Stat. 633.)"
---
```

Optional fields that appear when applicable:

| Field | Type | Condition |
|-------|------|-----------|
| `subchapter_number` | `string` | Present when section is within a subchapter |
| `subchapter_name` | `string` | Present when section is within a subchapter |
| `source_credit` | `string` | Present when the section has a source credit annotation |
| `status` | `string` | Present for non-current sections (see [Section Status Values](#section-status-values)) |

### eCFR Section-Level Frontmatter

eCFR sections include additional regulatory metadata. Note that `currency` and `last_updated` reflect the date the conversion was run, not the source data's last amendment date:

```yaml
---
identifier: "/us/cfr/t17/s240.10b-5"
source: "ecfr"
legal_status: "authoritative_unofficial"
title: "17 CFR § 240.10b-5 - Employment of manipulative and deceptive devices"
title_number: 17
title_name: "Commodity and Securities Exchanges"
section_number: "240.10b-5"
section_name: "Employment of manipulative and deceptive devices"
chapter_name: "Securities and Exchange Commission"
part_number: "240"
part_name: "General Rules and Regulations, Securities Exchange Act of 1934"
positive_law: false
currency: "2025-03-21"
last_updated: "2025-03-21"
format_version: "1.1.0"
generator: "lexbuild@1.5.0"
authority: "15 U.S.C. 78a et seq."
regulatory_source: "[37 FR 23603, Nov. 4, 1972]"
cfr_part: "240"
---
```

eCFR-specific optional fields:

| Field | Type | Description |
|-------|------|-------------|
| `part_number` | `string` | CFR part number (e.g., `"240"`) |
| `part_name` | `string` | Part heading text |
| `chapter_number` | `number` | Only set when the chapter designator is a parseable integer (CFR chapters use Roman numerals, which are captured in `chapter_name` instead) |
| `chapter_name` | `string` | Chapter heading text |
| `authority` | `string` | Regulatory authority citation (from part-level `AUTH` element) |
| `regulatory_source` | `string` | Publication source (from part-level `SOURCE` element) |
| `cfr_part` | `string` | CFR part number |
| `cfr_subpart` | `string` | CFR subpart identifier |
| `source_credit` | `string` | Citation for the section (from `CITA` element) |

### FR Document-Level Frontmatter

FR documents include all common fields plus FR-specific metadata. When a JSON sidecar from the API is available, frontmatter is enriched with structured agency, CFR reference, docket, and date information:

```yaml
---
identifier: "/us/fr/2026-06029"
source: "fr"
legal_status: "authoritative_unofficial"
title: "Amendments to Exchange Act Rule 10b-5"
title_number: 0
title_name: "Federal Register"
section_number: "2026-06029"
section_name: "Amendments to Exchange Act Rule 10b-5"
positive_law: false
currency: "2026-03-28"
last_updated: "2026-03-28"
format_version: "1.1.0"
generator: "lexbuild@1.5.0"
document_number: "2026-06029"
document_type: "rule"
fr_citation: "91 FR 14523"
fr_volume: 91
publication_date: "2026-03-28"
agencies:
  - "Securities and Exchange Commission"
cfr_references:
  - "17 CFR Part 240"
docket_ids:
  - "Release No. 34-99999"
rin: "3235-AM00"
effective_date: "2026-05-27"
fr_action: "Final rule."
---
```

FR-specific optional fields:

| Field | Type | Description |
|-------|------|-------------|
| `document_number` | `string` | FR document number (e.g., `"2026-06029"`) |
| `document_type` | `string` | Normalized type: `"rule"`, `"proposed_rule"`, `"notice"`, `"presidential_document"` |
| `fr_citation` | `string` | Full FR citation (e.g., `"91 FR 14523"`) |
| `fr_volume` | `number` | FR volume number |
| `publication_date` | `string` | Publication date (`YYYY-MM-DD`) |
| `agencies` | `string[]` | Issuing agency names |
| `cfr_references` | `string[]` | Affected CFR titles/parts |
| `docket_ids` | `string[]` | Docket identifiers |
| `rin` | `string` | Regulation Identifier Number |
| `effective_date` | `string` | When the rule takes effect |
| `comments_close_date` | `string` | Comment period end date (proposed rules) |
| `fr_action` | `string` | Action description (e.g., `"Final rule."`) |

### Title-Level Enriched Frontmatter

Title granularity files include aggregate statistics instead of section/chapter context fields:

```yaml
---
identifier: "/us/usc/t1"
source: "usc"
legal_status: "official_legal_evidence"
title: "Title 1 — GENERAL PROVISIONS"
title_number: 1
title_name: "GENERAL PROVISIONS"
positive_law: true
currency: "119-73"
last_updated: "2025-12-03"
format_version: "1.1.0"
generator: "lexbuild@1.5.0"
chapter_count: 3
section_count: 15
total_token_estimate: 12500
---
```

| Field | Type | Description |
|-------|------|-------------|
| `chapter_count` | `number` | Number of chapters in the title |
| `section_count` | `number` | Total sections across all chapters |
| `total_token_estimate` | `number` | Estimated token count for the entire title |
| `part_count` | `number` | Number of parts (eCFR title-level only) |

### Legal Status Values

| Value | Meaning | Applies To |
|-------|---------|------------|
| `official_legal_evidence` | Positive law titles; the text itself is legal evidence | USC titles enacted as positive law |
| `official_prima_facie` | Non-positive law titles; prima facie evidence of the law | USC titles not enacted as positive law |
| `authoritative_unofficial` | Authoritative but not official; derived from official sources | All eCFR and FR content |

### Identifier Format

USC identifiers use the canonical URI scheme from USLM `identifier` attributes:

```
/us/usc/t{title}                   Title level
/us/usc/t{title}/ch{chapter}       Chapter level
/us/usc/t{title}/s{section}        Section level
/us/usc/t{title}/s{section}/{sub}  Subsection level
```

CFR identifiers are constructed from eCFR XML attributes and use `/us/cfr/` (content type), not `/us/ecfr/` (data source):

```
/us/cfr/t{title}                   Title level
/us/cfr/t{title}/ch{chapter}       Chapter level
/us/cfr/t{title}/pt{part}          Part level
/us/cfr/t{title}/s{section}        Section level
```

Both eCFR and future annual CFR sources share the `/us/cfr/` identifier space.

FR identifiers use document numbers (unique, stable, API primary key):

```
/us/fr/{document_number}           Document level
```

For a detailed breakdown of the identifier format and link resolution behavior, see the [identifier format reference](/docs/reference/identifier-format).

## Content Structure

### Section Heading

Every section file begins with a level-1 heading displaying the section number and name:

```markdown
# § 1. Words denoting number, gender, and so forth
```

For eCFR content:

```markdown
# § 240.10b-5 Employment of manipulative and deceptive devices
```

### Inline Hierarchy (Small Levels)

Subsections and all levels below use bold inline numbering rather than Markdown headings. This is a deliberate design choice: headings would imply document structure, but legal subsections are subordinate to the section and should not appear in a table of contents.

```markdown
**(a)** For the purposes of any Federal law, an individual shall be
considered married if that individual's marriage is between 2 individuals
and is valid in the State where the marriage was entered into.

**(b)** In this section, the term "State" means a State, the District of
Columbia, the Commonwealth of Puerto Rico, or any other territory or
possession of the United States.
```

When a subsection has a heading, it follows the number in bold:

```markdown
**(a)** **In general.** — The Secretary shall prescribe regulations...
```

The numbering scheme communicates hierarchical depth:

| Level | Style | Example |
|-------|-------|---------|
| Subsection | Lowercase letter | `**(a)**` |
| Paragraph | Arabic numeral | `**(1)**` |
| Subparagraph | Uppercase letter | `**(A)**` |
| Clause | Lowercase Roman numeral | `**(i)**` |
| Subclause | Uppercase Roman numeral | `**(I)**` |
| Item | Double lowercase | `**(aa)**` |
| Subitem | Double uppercase | `**(AA)**` |
| Subsubitem | Triple lowercase | `**(aaa)**` |

Content is never indented with leading spaces. Markdown indentation would create code blocks, defeating the purpose. Hierarchy is communicated exclusively through the numbering scheme.

### Title-Level Heading Hierarchy

When rendering at title or chapter granularity (multiple sections in a single file), structural headings use an increasing depth:

| Element | Heading Level |
|---------|--------------|
| Title | `#` (H1) |
| Chapter | `##` (H2) |
| Section | `###` (H3) |
| Subchapter | `##` or `###` depending on nesting |

Structural headings cap at H5. Big-level headings that would exceed H5 render as bold text instead.

### Source Credits

Source credits are separated from the body by a horizontal rule and rendered with a bold label:

```markdown
---

**Source Credit**: (July 30, 1947, ch. 388, 61 Stat. 633.)
```

### Notes

Notes appear after the source credit. Cross-heading notes that categorize groups of notes render as level-2 headings. Individual note headings render as level-3 headings:

```markdown
## Editorial Notes

### Amendments

2022—Pub. L. 117–228 amended section generally.

1996—Pub. L. 104–199 added this section.

## Statutory Notes and Related Subsidiaries

### Severability

If any provision of this Act is held to be unconstitutional,
the remainder shall not be affected.
```

Notes are included by default and can be controlled with CLI flags:

- `--no-include-notes` disables all notes.
- `--include-editorial-notes` enables only editorial notes.
- `--include-statutory-notes` enables only statutory notes.
- `--include-amendments` enables only amendment history.

### Quoted Content

Quoted legal text (from `<quotedContent>` elements, typically quoted bills in statutory notes) renders as Markdown blockquotes:

```markdown
> (a) The Secretary shall establish a program...
>
> (b) The program shall include...
```

### Footnotes

Footnotes use Markdown footnote syntax. References appear inline as `[^N]` and definitions appear at the bottom of the section file:

```markdown
The term applies to all cases[^1] under this section.

[^1]: As defined in section 101 of title 5.
```

### Defined Terms

Terms being defined (from `<term>` elements) render in bold:

```markdown
The term **employee** means an individual employed by the Government.
```

### Inline Formatting

| Source Element | Markdown Output |
|---------------|----------------|
| `<b>` / bold | `**text**` |
| `<i>` / italic | `*text*` |
| `<sup>` | `<sup>text</sup>` |
| `<sub>` | `<sub>text</sub>` |
| `<term>` | `**text**` |
| `<quotedContent>` | `> blockquote` |

## Tables

### Simple Tables

Tables without colspan or rowspan render as standard Markdown pipe tables:

```markdown
| Rate | Amount | Date |
| --- | --- | --- |
| Basic | $100 | 2024-01-01 |
| Premium | $250 | 2024-06-01 |
| Enterprise | $500 | 2024-12-01 |
```

Pipe characters within cell content are escaped as `\|`. Backslashes are escaped as `\\`.

### Layout Tables

USLM `<layout>` elements (column-oriented display, common in pay schedules) also render as Markdown pipe tables when their structure is compatible:

```markdown
| Grade | Step 1 | Step 2 |
| --- | --- | --- |
| GS-1 | $20,000 | $21,000 |
| GS-2 | $25,000 | $26,500 |
```

### Complex Tables

Tables with colspan, rowspan, or other features that do not map cleanly to Markdown pipe syntax are rendered as best-effort pipe tables. Complex layout features (such as multi-column headers or cells spanning multiple rows) may be flattened or approximated. If you require lossless table structure, refer to the source XML.

## Cross-Reference Links

Cross-reference rendering is controlled by the `--link-style` option. Three styles are available:

### Plaintext (default)

References render as unlinked text:

```markdown
section 101 of title 5
```

### Relative

References to sections within the converted corpus resolve to relative Markdown links. References outside the corpus fall back to external URLs:

```markdown
[section 101 of title 5](../title-05/chapter-01/section-101.md)
```

The link resolver uses a two-pass approach: all section identifiers are registered before any rendering occurs, enabling both forward and backward cross-references to resolve.

### Canonical

USC references link to the OLRC website (uscode.house.gov):

```markdown
[section 101 of title 5](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title5-section101)
```

### Link Resolution Rules

| Identifier Prefix | Resolved As |
|-------------------|-------------|
| `/us/usc/` | Relative link when resolved; otherwise OLRC fallback URL |
| `/us/cfr/` | Relative link when resolved; otherwise plain text |
| `/us/fr/` | Relative link when resolved; otherwise federalregister.gov fallback URL |
| `/us/stat/` | Always plain text (Statutes at Large) |
| `/us/pl/` | Always plain text (Public Law) |

Fallback URLs for unresolved references:

- **USC**: `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title{N}-section{N}`

Unresolved CFR references (`/us/cfr/`) are rendered as plain text. No automatic ecfr.gov fallback URLs are generated.

## Metadata Index (`_meta.json`)

Sidecar JSON index files are generated at section granularity for all sources. USC additionally generates chapter-level indexes. eCFR currently generates `_meta.json` only at section granularity and does not emit chapter/part/title-level sidecar files. Title granularity uses enriched frontmatter instead. These files enable index-based retrieval without parsing individual Markdown files.

### Title-Level Index

For USC output, each title directory contains a `_meta.json` with aggregate metadata and a listing of all chapters.

**USC title-level `_meta.json`**:

```json
{
  "format_version": "1.1.0",
  "generator": "lexbuild@1.5.0",
  "generated_at": "2025-12-03T12:00:00.000Z",
  "identifier": "/us/usc/t1",
  "title_number": 1,
  "title_name": "GENERAL PROVISIONS",
  "positive_law": true,
  "currency": "119-73",
  "release_point": "us/pl/119/73not60",
  "source_xml": "usc01.xml",
  "granularity": "section",
  "stats": {
    "chapter_count": 3,
    "section_count": 15,
    "total_files": 15,
    "total_tokens_estimate": 12500
  },
  "chapters": [
    {
      "identifier": "/us/usc/t1/ch1",
      "number": 1,
      "name": "RULES OF CONSTRUCTION",
      "directory": "chapter-01",
      "sections": [
        {
          "identifier": "/us/usc/t1/s1",
          "number": "1",
          "name": "Words denoting number, gender, and so forth",
          "file": "section-1.md",
          "token_estimate": 250,
          "has_notes": true,
          "status": "current"
        }
      ]
    }
  ]
}
```

**eCFR title-level `_meta.json`**:

```json
{
  "format_version": "1.1.0",
  "generator": "lexbuild@1.5.0",
  "generated_at": "2025-03-15T12:00:00.000Z",
  "identifier": "/us/cfr/t17",
  "title_number": 17,
  "title_name": "Commodity and Securities Exchanges",
  "source": "ecfr",
  "legal_status": "authoritative_unofficial",
  "currency": "2025-03-15",
  "source_xml": "ECFR-title17.xml",
  "granularity": "section",
  "stats": {
    "part_count": 42,
    "section_count": 3500,
    "total_files": 3500,
    "total_tokens_estimate": 2500000
  },
  "parts": [
    {
      "identifier": "/us/cfr/t17/pt240",
      "number": "240",
      "name": "General Rules and Regulations, Securities Exchange Act of 1934",
      "directory": "part-240",
      "sections": [
        {
          "identifier": "/us/cfr/t17/s240.10b-5",
          "number": "240.10b-5",
          "name": "Employment of manipulative and deceptive devices",
          "file": "section-240.10b-5.md",
          "token_estimate": 150,
          "has_notes": false,
          "status": "current"
        }
      ]
    }
  ]
}
```

### Chapter-Level Index (USC)

Each chapter directory contains a `_meta.json` with section listings:

```json
{
  "format_version": "1.1.0",
  "identifier": "/us/usc/t1/ch1",
  "chapter_number": 1,
  "chapter_name": "RULES OF CONSTRUCTION",
  "title_number": 1,
  "section_count": 8,
  "sections": [
    {
      "identifier": "/us/usc/t1/s1",
      "number": "1",
      "name": "Words denoting number, gender, and so forth",
      "file": "section-1.md",
      "token_estimate": 250,
      "has_notes": true,
      "status": "current"
    }
  ]
}
```

### Part-Level Index (eCFR)

Each part directory contains a `_meta.json` with section listings:

```json
{
  "format_version": "1.1.0",
  "identifier": "/us/cfr/t17/pt240",
  "part_number": "240",
  "part_name": "General Rules and Regulations, Securities Exchange Act of 1934",
  "title_number": 17,
  "section_count": 450,
  "sections": [
    {
      "identifier": "/us/cfr/t17/s240.10b-5",
      "number": "240.10b-5",
      "name": "Employment of manipulative and deceptive devices",
      "file": "section-240.10b-5.md",
      "token_estimate": 150,
      "has_notes": false,
      "status": "current"
    }
  ]
}
```

### Section Entry Schema

Each section entry in a `_meta.json` sections array contains:

| Field | Type | Description |
|-------|------|-------------|
| `identifier` | `string` | Canonical URI identifier |
| `number` | `string` | Section number (may be alphanumeric) |
| `name` | `string` | Section heading text |
| `file` | `string` | Filename within the containing directory |
| `token_estimate` | `number` | Estimated token count for the section |
| `has_notes` | `boolean` | Whether the section contains editorial or statutory notes |
| `status` | `string` | Section status (e.g., `"current"`, `"repealed"`) |

## Token Estimation

Token counts use a character-divided-by-four heuristic:

```
token_estimate = Math.ceil(contentLength / 4)
```

The `contentLength` is the byte length of the rendered Markdown content (including the YAML frontmatter). This approximation is intentionally simple and errs on the side of overestimation. It is suitable for capacity planning and chunking decisions, not precise billing.

Token estimates appear in three places:

1. `token_estimate` per section in `_meta.json` section entries.
2. `total_tokens_estimate` in `_meta.json` `stats` objects.
3. `total_token_estimate` in title-level enriched frontmatter.

## Section Status Values

Sections may carry a `status` field in both frontmatter and `_meta.json` entries. The status reflects the legal state of the section as recorded in the source XML.

| Status | Meaning | Rendered Content |
|--------|---------|-----------------|
| `current` | Active, in-force provision | Full section text |
| `repealed` | Explicitly repealed by legislation | `[Repealed]` |
| `transferred` | Moved to a different location in the code | `[Transferred to section N of title N]` |
| `omitted` | Omitted from the code (e.g., expired appropriations) | `[Omitted]` |
| `reserved` | Placeholder reserved for future use | `[Reserved]` |
| `renumbered` | Renumbered to a different section | Note text indicating new designation |
| `redesignated` | Redesignated with a new number | Note text indicating new designation |
| `expired` | Expired by its own terms | `[Expired]` or note text |
| `terminated` | Terminated by operation of law | `[Terminated]` or note text |
| `suspended` | Temporarily suspended | Note text indicating suspension |

When a section is not current, its frontmatter includes a `status` field. Current sections omit the field entirely (the absence of `status` implies `"current"`).

## README Files

At section granularity, each title directory receives a `README.md` providing a human-readable summary table and chapter/part listing. These files are generated artifacts and are not intended for RAG ingestion.

## RAG Integration Guidance

### Chunking Strategy

The output is designed to align with common RAG chunking strategies:

- **Section level**: Individual section files range from approximately 500 to 3,000 tokens each, fitting naturally into most embedding models' context windows. Each file is a self-contained, citable legal provision with rich metadata. This is the recommended granularity for vector storage.

- **Chapter/part level**: When using chapter or part granularity files, split on `# §` heading patterns to recover individual sections. Each `# §` heading begins a new logical unit.

- **Title level**: Best suited for direct LLM context window injection (e.g., "read Title 1 in its entirety"). Title files can exceed model context limits for large titles (Title 26 or Title 42 produce multi-million-token output). Not recommended for vector storage.

### Metadata for Vector Stores

When indexing section-level files into a vector database, extract these frontmatter fields as structured metadata for filtering and retrieval:

| Field | Purpose |
|-------|---------|
| `identifier` | Unique key; stable across conversions of the same source data |
| `source` | Filter by corpus (`"usc"`, `"ecfr"`, or `"fr"`) |
| `title_number` | Filter by title |
| `section_number` | Section-level lookup |
| `legal_status` | Filter by legal authority level |
| `status` | Exclude non-current sections from search results |
| `currency` | Track data freshness |

### File Path Stability

Output file paths are deterministic: converting the same source XML at the same granularity always produces the same directory structure and filenames. Paths change only when:

- The source data itself changes (new release point or updated eCFR date).
- The output format version changes.
- The granularity option changes.

This stability makes file paths suitable as document identifiers in vector stores, provided the source version is also tracked.

### Programmatic Access via the Data API

The [LexBuild Data API](/docs/api/overview) provides REST access to the same content stored in a SQLite database. The `lexbuild ingest` CLI command populates the database from the section-level output files. All frontmatter fields are available as JSON response fields, and the full Markdown body is retrievable per document. The API supports content negotiation (JSON, Markdown, or plaintext), field selection, full text search with faceted filtering, and paginated listings with sorting. This is an alternative to direct file ingestion for applications that prefer an HTTP interface over filesystem access.
