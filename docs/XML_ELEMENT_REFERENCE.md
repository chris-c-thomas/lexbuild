# USLM XML Element Reference

Quick reference for USLM 1.0 elements encountered in U.S. Code XML files, their semantic meaning, and how `law2md` converts them to Markdown.

---

## Document Root

| Element | Attributes | Markdown Output |
|---------|-----------|-----------------|
| `<uscDoc>` | `identifier`, `xmlns`, `xml:lang` | N/A (container only) |
| `<meta>` | — | Extracted to YAML frontmatter |
| `<main>` | — | N/A (container only) |

## Metadata Elements

| Element | Parent | Purpose | Frontmatter Field |
|---------|--------|---------|-------------------|
| `<dc:title>` | `<meta>` | Title display name | `title_name` |
| `<dc:type>` | `<meta>` | Document type (always "USCTitle") | — |
| `<docNumber>` | `<meta>` | Title number | `title_number` |
| `<docPublicationName>` | `<meta>` | Release point ID | `currency` |
| `<property role="is-positive-law">` | `<meta>` | Positive law status | `positive_law` |
| `<dcterms:created>` | `<meta>` | XML generation timestamp | `last_updated` |

## Hierarchical Levels ("Big Levels")

All derived from `<level>`. Each has `identifier` and contains `<num>`, optional `<heading>`, and children.

| Element | Typical Numbering | Markdown Heading | File Boundary |
|---------|-------------------|------------------|---------------|
| `<title>` | Arabic (1-54) | `# Title N — Name` | Title README.md |
| `<subtitle>` | Roman (I, II) | `## Subtitle N — Name` | Inline |
| `<chapter>` | Arabic (1-99+) | `## Chapter N — Name` | Chapter dir/file |
| `<subchapter>` | Roman (I, II) | `### Subchapter N — Name` | Subdir (if deep) |
| `<part>` | Roman or Alpha | `### Part N — Name` | Inline |
| `<subpart>` | Alpha (A, B) | `#### Subpart N — Name` | Inline |
| `<division>` | Alpha (A, B) | `### Division N — Name` | Inline |
| `<subdivision>` | Arabic | `#### Subdivision N` | Inline |

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

| Element | Parent Context | Markdown Output |
|---------|---------------|-----------------|
| `<content>` | Any level | Plain paragraph(s) |
| `<chapeau>` | Level with sub-levels | Paragraph before the sub-level list |
| `<continuation>` | Level with sub-levels | Paragraph after sub-levels |
| `<proviso>` | Any content context | Paragraph (typically begins with "*Provided*") |

## Inline Elements

| Element | Markdown Output | Notes |
|---------|-----------------|-------|
| `<b>` | `**text**` | Bold |
| `<i>` | `*text*` | Italic |
| `<sub>` | `~text~` or HTML `<sub>` | Subscript (rare in USC) |
| `<sup>` | `^text^` or HTML `<sup>` | Superscript (footnote refs) |
| `<ref>` | `[text](url)` | Cross-reference link |
| `<date>` | Plain text | `@date` attr preserved in data |
| `<term>` | `**text**` | Defined term (within `<def>`) |
| `<inline>` | Plain text | Generic inline container |

## Reference Elements

| Element | Key Attributes | Markdown Output |
|---------|---------------|-----------------|
| `<ref>` | `href` | `[display text](resolved_path.md)` |
| `<ref>` | `idref`, `portion` | Resolved by combining target `href` + `portion` |
| `<ref class="footnoteRef">` | `idref` | Markdown footnote `[^N]` |

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
| `<note>` | `topic="dispositionOfSections"` | Disposition table (editorial) |
| `<sourceCredit>` | — | `**Source Credit**: (text)` |

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
| `<compiledAct>` | Treated as a level (title appendices) |
| `<courtRules>` / `<courtRule>` | Treated as levels (title appendices) |
| `<reorganizationPlan>` | Treated as a level (title appendices) |
| `<fillIn>` | Rendered as `___` (blank line) |
| `<img>` | `![alt](src)` if image available |
| `<center>` | Plain text (centering not meaningful in Markdown) |
| `<br>` | Markdown line break (two trailing spaces or `\`) |
| `<del>` | `~~text~~` (strikethrough) |
| `<ins>` | Plain text (insertion not visually marked) |
