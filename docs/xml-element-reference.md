# USLM XML Element Reference

Quick reference for USLM 1.0 (patch 1.0.15) elements encountered in U.S. Code XML files, their semantic meaning, and how `law2md` converts them to Markdown.

**Source**: `docs/reference/uslm/uslm-schema-and-css/USLM-1.0.15.xsd` and `docs/reference/uslm/uslm-user-guide.pdf`

---

## Document Root

The schema defines 7 root element types (all derived from `<lawDoc>`): `<lawDoc>`, `<document>`, `<bill>`, `<statute>`, `<resolution>`, `<uscDoc>`, `<amendment>`. For USC conversion, we only encounter `<uscDoc>`.

| Element | Attributes | Markdown Output |
|---------|-----------|-----------------|
| `<uscDoc>` | `identifier`, `xmlns`, `xml:lang` | N/A (container only) |
| `<meta>` | — | Extracted to YAML frontmatter |
| `<main>` | — | N/A (container, suppressed from identifiers) |

## Metadata Elements

`<meta>` contains Dublin Core elements (from `dc.xsd` and `dcterms.xsd`) plus USLM-specific `<property>` and `<set>` elements.

| Element | Parent | Purpose | Frontmatter Field |
|---------|--------|---------|-------------------|
| `<dc:title>` | `<meta>` | Title display name | `title_name` |
| `<dc:type>` | `<meta>` | Document type (always "USCTitle") | — |
| `<docNumber>` | `<meta>` | Title number | `title_number` |
| `<docPublicationName>` | `<meta>` | Publication name | — |
| `<docReleasePoint>` | `<meta>` | Release point (Public Law number) | `currency` |
| `<property role="is-positive-law">` | `<meta>` | Positive law status | `positive_law` |
| `<dcterms:created>` | `<meta>` | XML generation timestamp | `last_updated` |

## Hierarchical Levels ("Big Levels")

All derived from abstract `<level>` (LevelType). Content model: `<num>*` → `<heading>*` → `<subheading>*` → `<toc>*` → LevelStructure. The schema does NOT enforce strict nesting — any level can appear inside any level.

| Element | Ref Prefix | Typical Numbering | Markdown Heading | File Boundary |
|---------|-----------|-------------------|------------------|---------------|
| `<title>` | `t` | Arabic (1-54) | `# Title N — Name` | Title README.md |
| `<subtitle>` | `st` | Roman (I, II) | `## Subtitle N — Name` | Inline |
| `<chapter>` | `c` | Arabic (1-99+) | `## Chapter N — Name` | Chapter dir/file |
| `<subchapter>` | `sc` | Roman (I, II) | `### Subchapter N — Name` | Subdir (if deep) |
| `<article>` | `art` | Arabic or Roman | `### Article N — Name` | Inline |
| `<subarticle>` | `sa` | Arabic | `#### Subarticle N` | Inline |
| `<part>` | `p` | Roman or Alpha | `### Part N — Name` | Inline |
| `<subpart>` | `sp` | Alpha (A, B) | `#### Subpart N — Name` | Inline |
| `<division>` | `d` | Alpha (A, B) | `### Division N — Name` | Inline |
| `<subdivision>` | `sd` | Arabic | `#### Subdivision N` | Inline |
| `<preliminary>` | `prelim` | — | Inline | Inline |

## Primary Level

| Element | Typical Numbering | Markdown Heading | File Boundary |
|---------|-------------------|------------------|---------------|
| `<section>` | Arabic (1-99999) | `# § N. Name` | One file per section (default) |

## Small Levels (within sections)

Rendered as bold inline numbering, NOT as Markdown headings.

| Element | Typical Numbering | Markdown Format |
|---------|-------------------|-----------------|
| `<subsection>` | Lowercase alpha: (a), (b) | `**(a)** **Heading.** — text` |
| `<paragraph>` | Arabic: (1), (2) | `**(1)** text` |
| `<subparagraph>` | Uppercase alpha: (A), (B) | `**(A)** text` |
| `<clause>` | Lowercase roman: (i), (ii) | `**(i)** text` |
| `<subclause>` | Uppercase roman: (I), (II) | `**(I)** text` |
| `<item>` | Double lowercase: (aa), (bb) | `**(aa)** text` |
| `<subitem>` | Double uppercase: (AA), (BB) | `**(AA)** text` |
| `<subsubitem>` | Triple lowercase: (aaa) | `**(aaa)** text` |

## Content Elements

The schema's abstract model defines four primitives: `<marker>` (empty/position), `<inline>` (span), `<block>` (no text children), `<content>` (mixed text + elements). `<content>` uses `processContents="lax"` with `namespace="##any"`, so it can contain elements from any namespace.

| Element | Base Type | Parent Context | Markdown Output |
|---------|-----------|---------------|-----------------|
| `<content>` | ContentType | Any level | Plain paragraph(s). May contain `<p>`, inline elements, XHTML. |
| `<chapeau>` | TextType | Level with sub-levels | Paragraph before the sub-level list |
| `<continuation>` | TextType | Level with sub-levels | Paragraph after or between sub-levels (interstitial) |
| `<proviso>` | TextType | Any content context | Paragraph (typically begins with "*Provided*"). Forms its own reference level. |
| `<def>` | TextType | Content context | Definition block containing `<term>` elements |
| `<p>` | ContentType | `<content>`, `<note>` | Paragraph break within container |

## Inline Elements

All derive from InlineType (mixed content: text + inline/marker children). CSS renders `<term>` as small-caps; we use bold in Markdown.

| Element | Markdown Output | Notes |
|---------|-----------------|-------|
| `<b>` | `**text**` | Bold |
| `<i>` | `*text*` | Italic |
| `<sub>` | `~text~` or HTML `<sub>` | Subscript (rare in USC) |
| `<sup>` | `^text^` or HTML `<sup>` | Superscript (footnote refs) |
| `<ref>` | `[text](url)` | Cross-reference link (see Reference Elements) |
| `<date>` | Plain text | `@date` attr (ISO 8601), CSS renders DarkBlue |
| `<term>` | `**text**` | Defined term (within `<def>`), CSS renders small-caps |
| `<shortTitle>` | Plain text | Short title when first declared |
| `<inline>` | Plain text | Generic inline container |
| `<del>` | `~~text~~` | Deleted text (in modifications) |
| `<ins>` | Plain text | Inserted text (in modifications) |

## Reference Elements

| Element | Key Attributes | Markdown Output |
|---------|---------------|-----------------|
| `<ref>` | `href` | `[display text](resolved_path.md)` |
| `<ref>` | `idref`, `portion` | Resolved by combining target `href` + `portion` |
| `<ref class="footnoteRef">` | `idref` | Markdown footnote `[^N]` (definition at bottom of section file) |

### Reference `href` Patterns

```
/us/usc/t{N}                    → Title
/us/usc/t{N}/s{N}               → Section
/us/usc/t{N}/s{N}/{sub}         → Subsection/paragraph
/us/stat/{vol}/{page}            → Statutes at Large
/us/act/{date}/ch{N}             → Session law by chapter
/us/pl/{congress}/{law}          → Public Law
```

Only `/us/usc/...` references are converted to relative Markdown links. All others render as plain text citations.

## Note Elements

Notes have two classification axes: `@type` (placement: inline/footnote/endnote/uscNote) and `@topic` (semantic category). The schema also defines concrete subtypes that derive from `<note>`.

| Element | Key Attributes | Markdown Output |
|---------|---------------|-----------------|
| `<notes>` | `type="uscNote"` | Container — no direct output |
| `<note>` | `role="crossHeading"` | `## Heading` (section divider) |
| `<note>` | `topic="amendments"` | Under "### Amendments" |
| `<note>` | `topic="codification"` | Under editorial notes |
| `<note>` | `topic="changeOfName"` | Under statutory notes |
| `<note>` | `topic="effectiveDateOfAmendment"` | Under editorial/statutory |
| `<note>` | `topic="crossReferences"` | Under "### Cross References" |
| `<note>` | `topic="miscellaneous"` | Under appropriate category |
| `<note>` | `topic="repeals"` | Under statutory notes |
| `<note>` | `topic="enacting"` | Title-level enacting note |
| `<note>` | `topic="dispositionOfSections"` | Disposition table (in title README only) |
| `<sourceCredit>` | — | `**Source Credit**: (text)` |
| `<statutoryNote>` | — | Note that is part of the law (concrete subtype of `<note>`) |
| `<editorialNote>` | — | Editorial-only note (concrete subtype of `<note>`) |
| `<changeNote>` | — | Non-substantive change record, usually in square brackets |

### Note Category Assignment

The `@role` attribute on cross-heading notes determines the current category:

1. `<note role="crossHeading">` with heading "Editorial Notes" → subsequent notes are editorial
2. `<note role="crossHeading">` with heading "Statutory Notes and Related Subsidiaries" → subsequent notes are statutory
3. Notes before any cross-heading are uncategorized (include with `--include-notes`)

## Table Elements

### XHTML Tables (namespace: `http://www.w3.org/1999/xhtml`)

| Element | Markdown Output |
|---------|-----------------|
| `<table>` | Markdown table or fenced HTML |
| `<thead>` / `<th>` | Table header row |
| `<tbody>` / `<tr>` / `<td>` | Table body rows |

### USLM Layout Tables (default namespace)

| Element | Markdown Output |
|---------|-----------------|
| `<layout>` | Markdown table |
| `<header>` | Table header row |
| `<row>` | Table body row |
| `<column>` | Table cell |
| `<tocItem>` | Table row (within `<toc>`) |

## TOC Elements

| Element | Markdown Output |
|---------|-----------------|
| `<toc>` | Markdown table or list |
| `<tocItem>` | Row: section number + name |

TOCs are included in README.md files for title and chapter directories. They are omitted from individual section files.

## Quoted Content

| Element | Markdown Output |
|---------|-----------------|
| `<quotedContent>` | Blockquote `> text` |
| `<quotedText>` | Inline quotes `"text"` |

## Special Elements

| Element | Handling |
|---------|----------|
| `<compiledAct>` | Treated as a level (title appendices → separate `title-NN-appendix/` dir) |
| `<courtRules>` / `<courtRule>` | Treated as levels (title appendices) |
| `<reorganizationPlans>` / `<reorganizationPlan>` | Treated as levels (title appendices) |
| `<fillIn>` | Rendered as `___` (blank line) |
| `<checkBox>` | Rendered as `[ ]` (form checkbox, rare) |
| `<img>` | `![alt](src)` if image available |
| `<center>` | Plain text (centering not meaningful in Markdown) |
| `<br>` | Markdown line break (two trailing spaces or `\`) |
| `<marker>` | Generic empty marker (rare, typically ignored) |

## Universal Attributes

These attributes can appear on most USLM elements (defined in BaseType):

| Attribute | Purpose | Notes |
|-----------|---------|-------|
| `@id` | Immutable GUID (prefixed with "id") | Never changes, even on move |
| `@identifier` | Full URL context path (e.g., "/us/usc/t1/s1") | On root/level elements |
| `@temporalId` | Human-readable evolving name (e.g., "s1_a_2") | Maps to ref paths: underscores → slashes |
| `@name` | Local name scoped to parent | Supports `{num}` and `{index}` parameters |
| `@role` | Refinement of element type | e.g., "crossHeading" on notes |
| `@class` | CSS-like classes (space-separated) | e.g., "indent-up1", "blockIndent2" |
| `@status` | Legal state of the element | See StatusEnum (18 values) |
| `@startPeriod` / `@endPeriod` | Temporal validity dates | For point-in-time versioning |
| `@partial` | Whether status is partial | Boolean |
| `@xml:lang` | Language code | Inherited from parent |
