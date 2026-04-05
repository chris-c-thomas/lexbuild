---
title: USLM Element Reference
description: Complete catalog of elements in the USLM 1.0 XML schema used by U.S. Code files, showing how each element maps to LexBuild AST nodes and renders to Markdown output.
order: 4
---

This is the complete element reference for the United States Legislative Markup (USLM) 1.0 schema (patch level 1.0.15), the XML format used for U.S. Code files published by the Office of the Law Revision Counsel (OLRC). It shows how each XML element maps to a LexBuild AST node and how that node renders to Markdown.

You will find this reference useful if you are extending the USC converter, debugging unexpected output, or building tooling that consumes LexBuild's AST directly.

## Namespaces

| Prefix | URI | Usage |
|--------|-----|-------|
| *(default)* | `http://xml.house.gov/schemas/uslm/1.0` | Most elements |
| `xhtml` | `http://www.w3.org/1999/xhtml` | Tables |
| `dc` | `http://purl.org/dc/elements/1.1/` | Dublin Core metadata |
| `dcterms` | `http://purl.org/dc/terms/` | DC Terms metadata |
| `xsi` | `http://www.w3.org/2001/XMLSchema-instance` | Schema instance |

LexBuild's SAX parser maps recognized non-default namespaces to prefixed element names (e.g., `xhtml:table`, `dc:title`). Elements in the default USLM namespace have no prefix.

## Document Structure

```xml
<uscDoc identifier="/us/usc/t1">
  <meta>
    <dc:title>Title 1</dc:title>
    <dc:type>USCTitle</dc:type>
    <docNumber>1</docNumber>
    <property role="is-positive-law">yes</property>
  </meta>
  <main>
    <title identifier="/us/usc/t1">
      <!-- hierarchical content -->
    </title>
  </main>
</uscDoc>
```

- **`<uscDoc>`** is the document root. Its `identifier` attribute provides the canonical URI for the title.
- **`<meta>`** contains document-level metadata extracted into a `DocumentMeta` object during parsing.
- **`<main>`** wraps the legislative content. Both `<uscDoc>` and `<main>` are structural containers that do not produce AST nodes.

## Metadata Elements

| Element | Purpose | Extracted To |
|---------|---------|-------------|
| `<meta>` | Metadata container | `DocumentMeta` object |
| `<dc:title>` | Display title (e.g., "Title 1") | `documentMeta.dcTitle` |
| `<dc:type>` | Document type (e.g., `"USCTitle"`) | `documentMeta.dcType` |
| `<docNumber>` | Numeric designation (e.g., `"1"`, `"5a"`) | `documentMeta.docNumber` |
| `<docPublicationName>` | Publication name | `documentMeta.docPublicationName` |
| `<docReleasePoint>` | Release point identifier | `documentMeta.releasePoint` |
| `<property role="is-positive-law">` | Positive law status (`"yes"` / `"no"`) | `documentMeta.positivelaw` |
| `<dc:publisher>` | Publisher name | `documentMeta.publisher` |
| `<dcterms:created>` | ISO timestamp of XML generation | `documentMeta.created` |
| `<dc:creator>` | Generator tool name | `documentMeta.creator` |

Metadata elements are consumed during parsing and do not appear in the AST.

## Hierarchical Levels

### Big Levels (Above Section)

These elements represent the organizational structure above the section level. All map to `LevelNode` with the corresponding `levelType`.

**Standard hierarchy** (ordered from largest to smallest):

| Element | LevelType | Typical `<num>` Format |
|---------|-----------|----------------------|
| `<title>` | `title` | `Title 1--` |
| `<subtitle>` | `subtitle` | `Subtitle A--` |
| `<chapter>` | `chapter` | `CHAPTER 1--` |
| `<subchapter>` | `subchapter` | `SUBCHAPTER I--` |
| `<article>` | `article` | `Article 1` |
| `<subarticle>` | `subarticle` | `Subarticle A` |
| `<part>` | `part` | `PART I--` |
| `<subpart>` | `subpart` | `Subpart A--` |
| `<division>` | `division` | `Division A--` |
| `<subdivision>` | `subdivision` | `Subdivision 1--` |
| `<preliminary>` | `preliminary` | *(none)* |

**Appendix-level elements** (used in title appendices for Titles 5, 11, 18, 28):

| Element | LevelType |
|---------|-----------|
| `<appendix>` | `appendix` |
| `<compiledAct>` | `compiledAct` |
| `<reorganizationPlans>` | `reorganizationPlans` |
| `<reorganizationPlan>` | `reorganizationPlan` |
| `<courtRules>` | `courtRules` |
| `<courtRule>` | `courtRule` |

The schema intentionally does NOT enforce strict hierarchy. Any level element can nest inside any other level element. Handlers must not assume a fixed parent-child relationship.

### Primary Level

**`<section>`** is the primary citable legal unit and the default emit boundary. Each section becomes one Markdown output file at section granularity.

```xml
<section identifier="/us/usc/t1/s1">
  <num value="1">§ 1.</num>
  <heading>Words denoting number, gender, and so forth</heading>
  <content>...</content>
  <sourceCredit>(July 30, 1947, ch. 388, 61 Stat. 633.)</sourceCredit>
  <notes type="uscNote">...</notes>
</section>
```

**AST**: `LevelNode` with `levelType: "section"`. The `identifier` attribute becomes `node.identifier`.

**Markdown**: Renders as the top-level heading (H1 or offset per `headingOffset`), followed by body content.

### Small Levels (Below Section)

These elements represent subdivisions within a section, rendered inline rather than as separate files.

| Element | LevelType | Numbering Style | Example |
|---------|-----------|----------------|---------|
| `<subsection>` | `subsection` | Lowercase letters | `(a)`, `(b)` |
| `<paragraph>` | `paragraph` | Arabic numerals | `(1)`, `(2)` |
| `<subparagraph>` | `subparagraph` | Uppercase letters | `(A)`, `(B)` |
| `<clause>` | `clause` | Lowercase Roman | `(i)`, `(ii)` |
| `<subclause>` | `subclause` | Uppercase Roman | `(I)`, `(II)` |
| `<item>` | `item` | Lowercase letters | `(aa)`, `(bb)` |
| `<subitem>` | `subitem` | Uppercase letters | `(AA)`, `(BB)` |
| `<subsubitem>` | `subsubitem` | Arabic numerals | `(1)`, `(2)` |

Each has `<num>` (with `@value` for the normalized form) and optional `<heading>`.

**AST**: `LevelNode` with the corresponding `levelType`.

**Markdown**: Rendered as bold inline numbering (e.g., `**(a)**`) followed by the content text.

## Numbering Elements

### `<num>`

The `<num>` element provides both a display representation (text content) and a normalized value (`@value` attribute).

```xml
<num value="1">§ 1.</num>
<num value="a">(a)</num>
```

- The `@value` attribute is stored as `numValue` on the parent `LevelNode`.
- The display text is stored as `num` on the parent `LevelNode`.

### `<heading>`

The `<heading>` element provides the title/name of a level. Can contain inline elements like `<b>`, `<i>`, and `<ref>`.

```xml
<heading>Words denoting number, gender, and so forth</heading>
```

Stored as `heading` (plain text) on the parent `LevelNode`.

## Content Elements

Content elements represent blocks of text within a section. All map to `ContentNode` with a `variant` discriminator.

| Element | AST Variant | Markdown Output | Description |
|---------|-------------|----------------|-------------|
| `<content>` | `"content"` | Paragraph text | Primary text block within a level |
| `<chapeau>` | `"chapeau"` | Paragraph | Introductory text before sub-levels (e.g., "The following terms have the meanings given in this section--") |
| `<continuation>` | `"continuation"` | Paragraph | Text after or between sub-levels. Can appear interstitially, not just at the end. |
| `<proviso>` | `"proviso"` | Paragraph | Conditional text, typically beginning "Provided that..." |

Content elements contain inline children (text, formatting, references). Multiple `<p>` elements within a `<content>` block are rendered as separate paragraphs, joined by blank lines.

## Inline Elements

Inline elements appear within content blocks and provide text formatting, references, and semantic markup. All are in the USLM namespace, not XHTML.

| Element | AST `InlineType` | Markdown Output | Notes |
|---------|------------------|----------------|-------|
| `<b>` | `bold` | `**text**` | Bold emphasis |
| `<i>` | `italic` | `*text*` | Italic emphasis |
| `<sub>` | `sub` | `<sub>text</sub>` | Subscript (HTML in Markdown) |
| `<sup>` | `sup` | `<sup>text</sup>` | Superscript (HTML in Markdown) |
| `<ref>` | `ref` | `[text](url)` or plain text | Cross-reference (see Reference Elements) |
| `<date>` | `date` | Literal text | Date value; `@date` attribute has ISO format |
| `<term>` | `term` | `**term**` | Defined term within a `<def>` (rendered bold) |
| `<inline>` | `text` | Pass-through | Generic inline container |
| `<shortTitle>` | `text` | Pass-through | Short title reference |
| `<del>` | `text` | Pass-through | Deleted text (versioning) |
| `<ins>` | `text` | Pass-through | Inserted text (versioning) |

Inline elements can nest. Text inside nested inline elements (e.g., `<heading><b>Editorial Notes</b></heading>`) bubbles up to the appropriate frame's text buffer.

## Reference Elements

### `<ref>`

The `<ref>` element represents cross-references between legal provisions. It has several roles depending on its attributes.

**Attributes**:

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `href` | Target identifier URI | `/us/usc/t1/s1`, `/us/stat/61/633` |
| `idref` | Footnote target ID | `fn1` |
| `class` | Behavioral modifier | `"footnoteRef"` |

**Identifier formats in `href`**:

| Pattern | Target | Example |
|---------|--------|---------|
| `/us/usc/t{N}/s{N}` | USC section | `/us/usc/t26/s7801` |
| `/us/usc/t{N}/s{N}/{sub}` | USC subsection | `/us/usc/t1/s1/a` |
| `/us/stat/{vol}/{page}` | Statutes at Large | `/us/stat/61/633` |
| `/us/pl/{congress}/{law}` | Public Law | `/us/pl/119/73` |

**Link resolution order**:

1. Exact identifier match in the link resolver registry -- relative Markdown path
2. Subsection stripped, section-level match -- relative path to section file
3. USC identifier not found -- fallback to OLRC URL (`uscode.house.gov/view.xhtml?req=granuleid:...`)
4. All other identifiers (including `/us/cfr/`, `/us/stat/`, `/us/pl/`) with no match -- rendered as plain text

**Footnote references**: When `class="footnoteRef"` and `idref` is present, the reference renders as a Markdown footnote marker: `[^fn1]`.

## Note Elements

### Containers

**`<notes type="uscNote">`** wraps a collection of notes that appear after the source credit. Maps to `NotesContainerNode` with `notesType` set to the `@type` attribute value.

### Individual Note Types

| Element | AST Node | Description |
|---------|----------|-------------|
| `<note>` | `NoteNode` | General note with `@topic` and `@role` attributes |
| `<sourceCredit>` | `SourceCreditNode` | Enactment source citation (e.g., "(Pub. L. 93-198, ...)") |
| `<statutoryNote>` | `NoteNode` | Statutory note (treated as `NoteNode`) |
| `<editorialNote>` | `NoteNode` | Editorial note (treated as `NoteNode`) |
| `<changeNote>` | `NoteNode` | Records non-substantive changes, usually in square brackets |

### Classification Axes

Notes are classified along two independent axes:

**`@type` (placement)**:

| Value | Meaning |
|-------|---------|
| `"uscNote"` | Standard notes after source credit |
| `"footnote"` | Footnote |
| `"inline"` | Inline note |
| `"endnote"` | End note |

**`@topic` (semantic category)**:

| Value | Category |
|-------|----------|
| `"amendments"` | Amendment history |
| `"codification"` | Codification notes |
| `"changeOfName"` | Name change notes |
| `"crossReferences"` | Cross-reference notes |
| `"effectiveDateOfAmendment"` | Effective date information |
| `"miscellaneous"` | Miscellaneous notes |
| `"repeals"` | Repeal information |
| `"regulations"` | Regulatory references |
| `"dispositionOfSections"` | Section disposition notes |
| `"enacting"` | Enacting provisions |

### Cross-Heading Notes

Within `<notes type="uscNote">` containers, `<note role="crossHeading">` elements act as section dividers. Their `<heading>` text (typically "Editorial Notes" or "Statutory Notes and Related Subsidiaries") categorizes all subsequent notes until the next cross-heading appears.

The renderer uses these cross-headings for notes filtering: editorial notes, statutory notes, and amendment history can be independently included or excluded at render time.

### Markdown Output

Notes render as:

- **Source credits**: Italic text in parentheses
- **Cross-heading notes**: Bold heading text
- **Editorial/statutory notes**: Heading (if present) followed by note content paragraphs
- **Footnotes**: Markdown footnote definitions (`[^fn1]: text`)

## Table Elements

### XHTML Tables

USLM documents embed tables using the XHTML namespace. The SAX parser emits these with the `xhtml:` prefix.

```xml
<xhtml:table>
  <xhtml:thead>
    <xhtml:tr>
      <xhtml:th>Column A</xhtml:th>
      <xhtml:th>Column B</xhtml:th>
    </xhtml:tr>
  </xhtml:thead>
  <xhtml:tbody>
    <xhtml:tr>
      <xhtml:td>Value 1</xhtml:td>
      <xhtml:td>Value 2</xhtml:td>
    </xhtml:tr>
  </xhtml:tbody>
</xhtml:table>
```

**AST**: `TableNode` with `variant: "xhtml"`. Standard HTML attributes (`colspan`, `rowspan`, `align`) are parsed and stored but do not affect Markdown table layout.

**Markdown**: Always rendered as pipe-syntax Markdown tables. Complex layouts that rely on `colspan` or `rowspan` may not be represented faithfully; cells are serialized row by row, and pipe characters within cells are escaped.

**Important**: Always in the XHTML namespace (`http://www.w3.org/1999/xhtml`). Do not confuse with USLM layout elements.

### USLM Layout Tables

USLM uses its own layout mechanism for columnar data that is not a traditional table.

```xml
<layout>
  <header>
    <column>Column A</column>
    <column>Column B</column>
  </header>
  <row>
    <column>Value 1</column>
    <column leaders=".">Value 2</column>
  </row>
</layout>
```

**AST**: `TableNode` with `variant: "layout"`. The `@leaders` attribute controls alignment characters (typically dots).

**Markdown**: Rendered as pipe-syntax Markdown tables, same as XHTML tables.

Both table variants use dedicated collector state machines in the builder, checked before normal element handlers, to keep table-building logic separate from the main processing stack.

## TOC Elements

| Element | AST Node | Description |
|---------|----------|-------------|
| `<toc>` | `TOCNode` | Table of contents container |
| `<tocItem>` | `TOCItemNode` | Individual TOC entry with `number`, `title`, and `href` |

TOC nodes are present in the AST but are **skipped during Markdown rendering**. They exist in the XML for navigation within the source document but are not needed in the Markdown output.

## Quoted Content

```xml
<quotedContent origin="/us/usc/t5/s5102">
  <section identifier="/us/usc/t5/s5102">
    ...
  </section>
</quotedContent>
```

**AST**: `QuotedContentNode` with `origin` set from the `@origin` attribute.

**Markdown**: Rendered as a blockquote (`>`-prefixed lines).

**Emission suppression**: Sections inside `<quotedContent>` must not be emitted as standalone files. The builder tracks a `quotedContentDepth` counter and suppresses emission when depth is greater than zero. This prevents quoted bills in statutory notes from producing spurious output files.

## Definition Elements

```xml
<content>
  <def>
    The <term>Secretary</term> means the Secretary of Commerce.
  </def>
</content>
```

- **`<def>`**: A definition block. Treated as a content wrapper; does not produce a separate AST node.
- **`<term>`**: A defined term. Maps to `InlineNode` with `inlineType: "term"`. Rendered as bold text (`**term**`).

## Universal Attributes

These attributes can appear on most USLM elements.

| Attribute | Description | Used By |
|-----------|-------------|---------|
| `id` | Unique element ID | Internal references |
| `identifier` | Canonical URI identifier (e.g., `/us/usc/t1/s1`) | Levels, sections |
| `temporalId` | Point-in-time identifier | Versioned elements |
| `status` | Legal status of the element | Sections, levels |
| `startPeriod` | Period start date (ISO) | Versioned elements |
| `endPeriod` | Period end date (ISO) | Versioned elements |

### Status Values

The schema defines 18 legal status values that can appear on any element via the `@status` attribute:

| Status | Meaning |
|--------|---------|
| `proposed` | Proposed but not enacted |
| `withdrawn` | Withdrawn before enactment |
| `cancelled` | Cancelled |
| `pending` | Pending enactment or effective date |
| `operational` | Currently in effect |
| `suspended` | Temporarily suspended |
| `renumbered` | Moved to a new section number |
| `repealed` | Removed by subsequent legislation |
| `expired` | No longer in effect due to expiration |
| `terminated` | Ended by operation of law |
| `hadItsEffect` | Transitional provision that has completed |
| `omitted` | Omitted from the code |
| `notAdopted` | Not adopted into positive law |
| `transferred` | Moved to a different location in the Code |
| `redesignated` | Given a new designation |
| `reserved` | Held for future use |
| `vacant` | Empty placeholder |
| `crossReference` | Redirects to another section |
| `unknown` | Status not determined |

LexBuild preserves the `status` value in `LevelNode.status` and includes it in frontmatter for section-level output.

## Identifier Format

USLM uses canonical URI-style identifiers on all hierarchical elements.

```
/us/usc/t{title}                          Title
/us/usc/t{title}/st{subtitle}             Subtitle
/us/usc/t{title}/ch{chapter}              Chapter
/us/usc/t{title}/ch{chapter}/sch{subch}   Subchapter
/us/usc/t{title}/s{section}               Section
/us/usc/t{title}/s{section}/{subsection}   Subsection and below
```

**Prefix abbreviations**: `t` = title, `st` = subtitle, `ch` = chapter, `sch` = subchapter, `art` = article, `p` = part, `sp` = subpart, `d` = division, `sd` = subdivision, `s` = section. Small levels (subsection and below) use their number directly without a prefix.

## Content Model Notes

### Permissive Content Model

`<content>` uses `processContents="lax"` with `namespace="##any"` in the schema. This means content elements can contain elements from any namespace, including embedded XHTML. The SAX parser must handle unexpected elements gracefully.

### Multiple `<p>` Elements

A single `<content>`, `<note>`, or `<quotedContent>` may contain multiple `<p>` elements. Each is rendered as a separate paragraph in Markdown output, with blank lines between them. The `<p>` element itself does not produce an AST node; it is absorbed into the parent content's inline children with `"\n\n"` separators.

### Element Versioning

Elements can carry `@startPeriod` and `@endPeriod` attributes for point-in-time variants. Multiple versions of the same element may coexist in the document. LexBuild processes all versions present in the XML without filtering by date.
