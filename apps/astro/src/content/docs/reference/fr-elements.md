---
title: FR Element Reference
description: Complete catalog of elements in the Federal Register GPO/SGML XML format, showing document types, preamble sections, regulatory text, and how each element maps to LexBuild AST nodes.
order: 6
---

This is the complete element reference for the Federal Register XML format. The FR uses a GPO/SGML-derived format with no namespace, sharing many inline elements with eCFR but using a flat, document-centric structure rather than hierarchical DIVs. Each FR document (a rule, proposed rule, notice, or presidential document) is a standalone entity organized into preamble, supplementary information, and regulatory text sections.

You will find this reference useful if you are extending the FR converter, debugging unexpected output, or building tooling that works with Federal Register XML directly.

## Document Types

Each document type element becomes one emitted AST node.

| Element | Normalized Type | Annual Volume |
|---------|----------------|--------------|
| `RULE` | `rule` | ~3,000--3,200 |
| `PRORULE` | `proposed_rule` | ~1,700--2,100 |
| `NOTICE` | `notice` | ~22,000--25,000 |
| `PRESDOCU` | `presidential_document` | ~300--470 |

## Section Containers

These elements group documents within daily issues. They are pass-through in the builder.

| Element | Description |
|---------|-------------|
| `RULES` | Contains `RULE` elements |
| `PRORULES` | Contains `PRORULE` elements |
| `NOTICES` | Contains `NOTICE` elements |
| `PRESDOCS` | Contains `PRESDOCU` elements |

## Preamble Elements

### Metadata (extracted to frontmatter)

| Element | Attribute | Extracted As |
|---------|-----------|-------------|
| `AGENCY` | `TYPE` (F=full, N=narrow, S=short) | Agency name |
| `SUBAGY` | -- | Sub-agency name |
| `CFR` | -- | CFR citation (e.g., `"17 CFR Part 240"`) |
| `SUBJECT` | -- | Document title/heading |
| `DEPDOC` | -- | Department document number |
| `RIN` | -- | Regulation Identifier Number |

### Sections (rendered as bold-labeled content)

| Element | Label | Content |
|---------|-------|---------|
| `AGY` | AGENCY: | Agency identification |
| `ACT` | ACTION: | Action type |
| `SUM` | SUMMARY: | Document summary |
| `DATES` | DATES: | Effective/comment dates |
| `EFFDATE` | EFFECTIVE DATE: | Effective date (variant) |
| `ADD` | ADDRESSES: | Contact addresses |
| `FURINF` | FOR FURTHER INFORMATION CONTACT: | Contact information |

Each section contains an `HD SOURCE="HED"` label heading followed by `P` paragraphs.

## Content Elements

| Element | Description |
|---------|-------------|
| `P` | Paragraph (primary content) |
| `FP` | Flush paragraph (`SOURCE` attr: `FP-1`, `FP-2`, `FP1-2` for indent levels) |

## Heading Element

The `HD` element uses the `SOURCE` attribute to determine heading depth:

| SOURCE Value | Depth | Usage |
|-------------|-------|-------|
| `HED` | 1 | Top-level section headings |
| `HD1` | 2 | Primary sub-headings |
| `HD2` | 3 | Secondary sub-headings |
| `HD3` | 4 | Tertiary sub-headings |
| `HD4` | 5 | Fourth-level sub-headings |
| `HD5`--`HD8` | 6 | Lower-level headings (collapsed) |

## Inline Formatting

### E Element (emphasis)

The `E` element's `T` attribute determines formatting:

| T Value | Rendering | Usage |
|---------|-----------|-------|
| `01` | Bold | General emphasis |
| `02` | Italic | Definitions, terms |
| `03` | Bold | Bold italic in print |
| `04` | Italic | Italic in headings |
| `05` | Italic | Small caps |
| `51`, `52`, `54` | Subscript | Math notation |
| `7462` | Italic | Special terms (et seq.) |

### Other Inline Elements

| Element | Rendering |
|---------|-----------|
| `I` | Italic |
| `B` | Bold |
| `SU` | Superscript / footnote marker |
| `FR` | Fraction (rendered as text) |
| `AC` | Accent/diacritical |

## Regulatory Text Elements

These appear within `SUPLINF` (supplementary information) in rules and proposed rules.

| Element | Attributes | Description |
|---------|-----------|-------------|
| `REGTEXT` | `TITLE`, `PART` | CFR amendment container |
| `AMDPAR` | -- | Amendment instruction paragraph |
| `SECTION` | -- | Section container within REGTEXT |
| `SECTNO` | -- | Section number designation |
| `PART` | -- | Part container within REGTEXT |
| `AUTH` | -- | Authority citation |
| `LSTSUB` | -- | List of subjects (CFR parts affected) |

## Signature Block

| Element | Description |
|---------|-------------|
| `SIG` | Signature block container |
| `NAME` | Signer name |
| `TITLE` | Signer title |
| `DATED` | Signature date |

## Presidential Document Elements

### Subtypes (pass-through containers)

| Element | Description |
|---------|-------------|
| `EXECORD` | Executive Order |
| `PRMEMO` | Presidential Memorandum |
| `PROCLA` | Proclamation |
| `DETERM` | Presidential Determination |
| `PRNOTICE` | Presidential Notice |
| `PRORDER` | Presidential Order |

### Metadata

| Element | Description |
|---------|-------------|
| `PSIG` | Presidential signature (initials) |
| `PLACE` | Place of issuance |
| `TITLE3` | CFR Title 3 marker |
| `PRES` | President name |

## Note Elements

| Element | Note Type | Description |
|---------|-----------|-------------|
| `FTNT` | `footnote` | Footnote text |
| `FTREF` | (inline ref) | Footnote reference marker |
| `EDNOTE` | `editorial` | Editorial note |
| `OLNOTE1` | `general` | Overlay note |

## Table Elements (GPOTABLE)

FR uses the GPOTABLE format (different from eCFR's HTML tables).

| Element | Attributes | Description |
|---------|-----------|-------------|
| `GPOTABLE` | -- | Table root |
| `TTITLE` | -- | Table title |
| `BOXHD` | -- | Header box container |
| `CHED` | `H` (level) | Column header entry |
| `ROW` | `RUL` (horizontal rules) | Data row |
| `ENT` | `I` (indent), `A` (alignment) | Cell entry |

## Block Elements

| Element | Description |
|---------|-------------|
| `EXTRACT` | Extracted/quoted text |
| `EXAMPLE` | Illustrative example |

## Metadata Elements

| Element | Description |
|---------|-------------|
| `FRDOC` | FR document citation (e.g., `[FR Doc. 2026-06029 ...]`), parsed for document number |
| `BILCOD` | Billing code (skipped) |
| `PRTPAGE` | Page number reference (`P` attr), skipped |

## Ignored Elements

| Element | Reason |
|---------|--------|
| `CNTNTS` | Table of contents in daily issue |
| `GPH` | Graphics (not available in XML) |
| `GID` | Graphics ID |

## Passthrough Elements

| Element | Description |
|---------|-------------|
| `FEDREG` | Daily issue root element |
| `PREAMB` | Preamble container (children handled individually) |
| `SUPLINF` | Supplementary information (children handled individually) |

## Skip Elements

Self-contained elements with no relevant content for Markdown output.

| Element | Description |
|---------|-------------|
| `STARS` | Visual separator |
| `FILED` | Filing information |
| `UNITNAME` | Section name in daily issue |
| `VOL` | Volume number |
| `NO` | Issue number |
| `DATE` | Daily-issue-level date |
| `NEWPART` | New part container |
| `PTITLE` | Part title |
| `PARTNO` | Part number |
| `PNOTICE` | Part notice |
