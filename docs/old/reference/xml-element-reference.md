# USLM XML Element Reference

This is a comprehensive reference for USLM 1.0 (patch level 1.0.15) XML elements as used in U.S. Code files published by the Office of the Law Revision Counsel (OLRC). Each element is documented with its semantic role, key attributes, and how LexBuild converts it to Markdown. The schema source is `USLM-1.0.15.xsd`; the companion USLM User Guide (v0.1.4, October 2013) provides the authoritative design rationale.

**Schema namespace:** `http://xml.house.gov/schemas/uslm/1.0`

---

## Document Root Elements

The USLM schema defines seven root element types, all derived from the abstract `<lawDoc>` base type. For U.S. Code conversion, only `<uscDoc>` is encountered.

| Element | Attributes | Description | Markdown Output |
|---------|-----------|-------------|-----------------|
| `<uscDoc>` | `identifier`, `xmlns`, `xml:lang` | Document root for a USC title | Container only (no direct output) |
| `<meta>` | -- | Metadata container | Extracted to YAML frontmatter |
| `<main>` | -- | Primary content container | Container only (suppressed from identifiers) |

Other root types defined by the schema but not used in USC XML: `<lawDoc>`, `<document>`, `<bill>`, `<statute>`, `<resolution>`, `<amendment>`.

### Example Document Structure

```xml
<uscDoc identifier="/us/usc/t1" xmlns="http://xml.house.gov/schemas/uslm/1.0">
  <meta>
    <dc:title>Title 1</dc:title>
    <dc:type>USCTitle</dc:type>
    <docNumber>1</docNumber>
    <property role="is-positive-law">yes</property>
  </meta>
  <main>
    <title identifier="/us/usc/t1">
      <num value="1">Title 1--</num>
      <heading>GENERAL PROVISIONS</heading>
      <!-- chapters, sections, etc. -->
    </title>
  </main>
</uscDoc>
```

---

## Metadata Elements

The `<meta>` container holds Dublin Core elements (from `dc.xsd` and `dcterms.xsd`) plus USLM-specific `<property>` and `<set>` elements. These are extracted into YAML frontmatter fields.

| Element | Parent | Purpose | Frontmatter Field |
|---------|--------|---------|-------------------|
| `<dc:title>` | `<meta>` | Title display name (e.g., "Title 1") | `title` (display); `title_name` comes from `<heading>` |
| `<dc:type>` | `<meta>` | Document type (always `"USCTitle"`) | -- |
| `<docNumber>` | `<meta>` | Title number | `title_number` |
| `<docPublicationName>` | `<meta>` | Publication name | -- |
| `<docReleasePoint>` | `<meta>` | Release point (Public Law reference) | `currency` |
| `<property role="is-positive-law">` | `<meta>` | Positive law status (`"yes"` or `"no"`) | `positive_law` (boolean) |
| `<dcterms:created>` | `<meta>` | XML generation timestamp | `last_updated` (ISO date) |

### Namespaces Used in Metadata

| Prefix | Namespace URI |
|--------|--------------|
| `dc` | `http://purl.org/dc/elements/1.1/` |
| `dcterms` | `http://purl.org/dc/terms/` |

---

## Hierarchical Levels ("Big Levels")

All big-level elements derive from the abstract `<level>` type (`LevelType`). Their content model follows the sequence: `<num>*` then `<heading>*` then `<subheading>*` then `<toc>*` then child levels/sections.

**Important:** The schema intentionally does NOT enforce strict nesting. Any `<level>` can appear inside any other `<level>`. This is a deliberate design choice to accommodate the organic structure of the U.S. Code.

| Element | Ref Prefix | Typical Numbering | Markdown Heading | File Boundary |
|---------|-----------|-------------------|------------------|---------------|
| `<title>` | `t` | Arabic (1-54) | `# Title N -- Name` | Title `README.md` |
| `<subtitle>` | `st` | Roman (I, II) | `## Subtitle N -- Name` | Inline |
| `<chapter>` | `ch` | Arabic (1-99+) | `## Chapter N -- Name` | Chapter directory/file |
| `<subchapter>` | `sch` | Roman (I, II) | `### Subchapter N -- Name` | Subchapter directory (if deep) |
| `<article>` | `art` | Arabic or Roman | `### Article N -- Name` | Inline |
| `<subarticle>` | `sa` | Arabic | `#### Subarticle N` | Inline |
| `<part>` | `p` | Roman or Alpha | `### Part N -- Name` | Inline |
| `<subpart>` | `sp` | Alpha (A, B) | `#### Subpart N -- Name` | Inline |
| `<division>` | `d` | Alpha (A, B) | `### Division N -- Name` | Inline |
| `<subdivision>` | `sd` | Arabic | `#### Subdivision N` | Inline |
| `<preliminary>` | `prelim` | -- | Inline | Inline |

The "Ref Prefix" column shows the abbreviation used in USLM canonical identifier paths. For example, Chapter 1 of Title 1 has the identifier `/us/usc/t1/ch1`.

The "File Boundary" column indicates whether the element creates output file/directory structure. The exact heading level in Markdown depends on nesting depth in title-level output (see [Output Format](output-format.md#title-level-heading-hierarchy)).

---

## Primary Level

The section is the primary structural and citable unit of the U.S. Code. In default (section) granularity, each section produces one output file.

| Element | Typical Numbering | Markdown Heading | File Boundary |
|---------|-------------------|------------------|---------------|
| `<section>` | Arabic (1-99999+) | `# § N. Name` | One file per section (default granularity) |

Sections contain `<num>`, `<heading>`, `<content>`, `<subsection>` elements, `<sourceCredit>`, and optionally `<notes>`. The `identifier` attribute carries the canonical URI (e.g., `/us/usc/t1/s1`).

Sections inside `<quotedContent>` elements (quoted bills within statutory notes) are NOT emitted as standalone files. The converter tracks `quotedContentDepth` to suppress emission.

---

## Small Levels (Within Sections)

Small levels represent the sub-section hierarchy. They are rendered as bold inline numbering, NOT as Markdown headings, to preserve a flat document structure optimal for RAG chunking.

| Element | Typical Numbering | Markdown Format | Example |
|---------|-------------------|-----------------|---------|
| `<subsection>` | Lowercase alpha: (a), (b) | `**(a)** **Heading.** -- text` | `**(a)** **In general.** -- The term...` |
| `<paragraph>` | Arabic: (1), (2) | `**(1)** text` | `**(1)** Any individual who...` |
| `<subparagraph>` | Uppercase alpha: (A), (B) | `**(A)** text` | `**(A)** in the case of...` |
| `<clause>` | Lowercase Roman: (i), (ii) | `**(i)** text` | `**(i)** is a citizen...` |
| `<subclause>` | Uppercase Roman: (I), (II) | `**(I)** text` | `**(I)** the first $200...` |
| `<item>` | Double lowercase: (aa), (bb) | `**(aa)** text` | `**(aa)** any amount...` |
| `<subitem>` | Double uppercase: (AA), (BB) | `**(AA)** text` | `**(AA)** the total...` |
| `<subsubitem>` | Triple lowercase: (aaa) | `**(aaa)** text` | `**(aaa)** for each...` |

Each small level follows the same content model as big levels: optional `<num>`, `<heading>`, then `<content>`, `<chapeau>`, child levels, and `<continuation>`.

When a subsection has a `<heading>`, the heading text is rendered in bold after the number: `**(a)** **In general.** -- Content text...`

**Numbering note:** Clauses use lowercase Roman numerals (i, ii, iii, iv); subclauses use uppercase Roman numerals (I, II, III, IV). The `<num>` element's `value` attribute contains the normalized form.

---

## Content Elements

The schema's abstract model defines four content primitives. The `<content>` element uses `processContents="lax"` with `namespace="##any"`, meaning it can contain elements from any namespace, including embedded XHTML.

| Element | Base Type | Parent Context | Markdown Output | Notes |
|---------|-----------|---------------|-----------------|-------|
| `<content>` | ContentType | Any level | Plain paragraph(s) | May contain `<p>`, inline elements, XHTML elements |
| `<chapeau>` | TextType | Level with sub-levels | Paragraph before the sub-level list | Introductory text that governs the following enumeration |
| `<continuation>` | TextType | Level with sub-levels | Paragraph after or between sub-levels | Interstitial -- appears between same-level elements, not just after them |
| `<proviso>` | TextType | Any content context | Paragraph (typically begins with "*Provided*") | Forms its own reference level in the identifier hierarchy |
| `<def>` | TextType | Content context | Definition block | Contains `<term>` elements identifying the defined terms |
| `<p>` | ContentType | `<content>`, `<note>` | Paragraph break within container | Multiple `<p>` elements produce separate paragraphs |

### Content Model Details

- **`<content>`** is the workhorse element. A single `<content>` may contain multiple `<p>` elements, each rendered as a separate Markdown paragraph. It can also contain inline elements, tables, and elements from other namespaces.
- **`<chapeau>`** is the introductory text before enumerated sub-levels. For example: "For the purposes of this section, the following definitions apply:" followed by `(1)`, `(2)`, etc.
- **`<continuation>`** is interstitial text that appears between or after sub-levels. It is NOT limited to appearing after all sub-levels; it can appear between elements of the same level.
- **`<proviso>`** represents a legal proviso clause (typically beginning "*Provided*, That..."). It has its own place in the reference hierarchy.

---

## Inline Elements

All inline elements derive from `InlineType` (mixed content: text plus inline/marker children). They appear within `<content>`, `<chapeau>`, `<continuation>`, and other text-bearing elements.

| Element | Markdown Output | Notes |
|---------|-----------------|-------|
| `<b>` | `**text**` | Bold emphasis |
| `<i>` | `*text*` | Italic emphasis |
| `<sub>` | `~text~` or HTML `<sub>` | Subscript (rare in USC) |
| `<sup>` | `^text^` or HTML `<sup>` | Superscript (used for footnote references) |
| `<ref>` | `[text](url)` | Cross-reference link (see [Reference Elements](#reference-elements)) |
| `<date>` | Plain text | `date` attribute carries ISO 8601 value |
| `<term>` | `**text**` | Defined term (within `<def>`); CSS renders as small-caps |
| `<shortTitle>` | Plain text | Short title when first declared in statute |
| `<inline>` | Plain text | Generic inline container |
| `<del>` | Plain text | Deleted text in modifications |
| `<ins>` | Plain text | Inserted text in modifications |

**Namespace note:** The `<b>`, `<i>`, `<sub>`, and `<sup>` elements are in the **USLM namespace**, not the XHTML namespace, despite sharing the same local names.

---

## Reference Elements

Cross-references are represented by `<ref>` elements with various attribute combinations.

| Pattern | Key Attributes | Markdown Output |
|---------|---------------|-----------------|
| Standard reference | `href` | `[display text](resolved_path.md)` |
| Composite reference | `idref`, `portion` | Resolved by combining target's `href` + `portion` |
| Footnote reference | `class="footnoteRef"`, `idref` | Markdown footnote: `[^N]` (definition at bottom of file) |

### Reference `href` Patterns

USLM uses canonical URI paths for cross-references:

```
/us/usc/t{N}                    -> Title reference
/us/usc/t{N}/s{N}               -> Section reference
/us/usc/t{N}/s{N}/{sub}         -> Subsection/paragraph reference
/us/usc/t{N}/ch{N}              -> Chapter reference
/us/stat/{vol}/{page}            -> Statutes at Large citation
/us/act/{date}/ch{N}             -> Session law by chapter
/us/pl/{congress}/{law}          -> Public Law citation
```

### Link Resolution Rules

| Reference Type | Resolution |
|---------------|------------|
| `/us/usc/...` | Converted to relative Markdown link (with `--link-style relative`) or OLRC URL (with `--link-style canonical`) |
| `/us/stat/...` | Always rendered as plain text citation |
| `/us/pl/...` | Always rendered as plain text citation |
| `/us/act/...` | Always rendered as plain text citation |

### Full Reference URL Structure

The USLM reference URL format is: `[item][work][!lang][/portion][@temporal][.manifestation]`

- `@portion` on a `<ref>` element extends a reference established via `@idref` (composable references)
- Only the `[work][/portion]` components are used in practice for USC cross-references

### Identifier Path Prefixes

| Prefix | Level |
|--------|-------|
| `t` | Title |
| `st` | Subtitle |
| `ch` | Chapter |
| `sch` | Subchapter |
| `art` | Article |
| `sa` | Subarticle |
| `p` | Part |
| `sp` | Subpart |
| `d` | Division |
| `sd` | Subdivision |
| `s` | Section |
| *(none)* | Subsection and below (number used directly) |

Example path: `/us/usc/t26/s1/a/2/A` = Title 26, Section 1, Subsection (a), Paragraph (2), Subparagraph (A).

---

## Note Elements

Notes have two independent classification axes and several concrete subtypes.

### Classification Axes

**`@type`** (placement):

| Value | Meaning |
|-------|---------|
| `inline` | Inline within text |
| `footnote` | Footnote (rendered as Markdown footnote) |
| `endnote` | Endnote |
| `uscNote` | After source credit (the most common type in USC) |

**`@topic`** (semantic category):

| Value | Typical Category | Description |
|-------|-----------------|-------------|
| `amendments` | Editorial | Amendment history |
| `codification` | Editorial | Codification notes |
| `changeOfName` | Statutory | Name change records |
| `crossReferences` | Either | Cross-reference lists |
| `effectiveDateOfAmendment` | Either | Effective date provisions |
| `miscellaneous` | Either | Uncategorized notes |
| `repeals` | Statutory | Repeal records |
| `regulations` | Statutory | Regulatory authority |
| `dispositionOfSections` | -- | Disposition table (title README only) |
| `enacting` | -- | Title-level enacting note |

### Note Elements Table

| Element | Key Attributes | Markdown Output |
|---------|---------------|-----------------|
| `<notes>` | `type="uscNote"` | Container (no direct output) |
| `<note>` | `role="crossHeading"` | `## Heading text` (category divider) |
| `<note>` | `topic="amendments"` | Under `### Amendments` |
| `<note>` | `topic="codification"` | Under editorial notes |
| `<note>` | `topic="changeOfName"` | Under statutory notes |
| `<note>` | `topic="effectiveDateOfAmendment"` | Under editorial or statutory notes |
| `<note>` | `topic="crossReferences"` | Under `### Cross References` |
| `<note>` | `topic="miscellaneous"` | Under appropriate category |
| `<note>` | `topic="repeals"` | Under statutory notes |
| `<note>` | `topic="enacting"` | Title-level enacting note |
| `<note>` | `topic="dispositionOfSections"` | Disposition table (title README only) |
| `<sourceCredit>` | -- | `**Source Credit**: (text)` |
| `<statutoryNote>` | -- | Concrete subtype: note that is part of the enacted law |
| `<editorialNote>` | -- | Concrete subtype: editorial-only note added by OLRC |
| `<changeNote>` | -- | Non-substantive change record, usually in square brackets |

### Note Category Assignment via Cross-Headings

Within a `<notes type="uscNote">` container, `<note role="crossHeading">` elements act as category dividers. The `<heading>` text determines the current category:

1. A cross-heading with `"Editorial Notes"` marks subsequent notes as **editorial**
2. A cross-heading with `"Statutory Notes and Related Subsidiaries"` marks subsequent notes as **statutory**
3. Notes appearing before any cross-heading are uncategorized

LexBuild's CLI flags (`--include-editorial-notes`, `--include-statutory-notes`) filter based on this category assignment. The `--include-amendments` flag includes only notes with `topic="amendments"` regardless of category.

---

## Table Elements

Tables in U.S. Code XML come from two different element families in two different namespaces. The SAX parser must check the namespace to distinguish them.

### XHTML Tables

**Namespace:** `http://www.w3.org/1999/xhtml`

These are standard HTML table elements embedded within USLM content.

| Element | Markdown Output |
|---------|-----------------|
| `<table>` | Markdown pipe table (simple) or fenced HTML (complex) |
| `<thead>` | Table header section |
| `<th>` | Header cell |
| `<tbody>` | Table body section |
| `<tr>` | Table row |
| `<td>` | Table data cell |

Simple tables (no `colspan`/`rowspan`) are converted to Markdown pipe tables. Complex tables with merged cells render as fenced HTML to preserve structure.

### USLM Layout Tables

**Namespace:** `http://xml.house.gov/schemas/uslm/1.0` (default)

These are USLM-native column-oriented display elements used for statutory schedules, rate tables, and similar tabular content.

| Element | Key Attributes | Markdown Output |
|---------|---------------|-----------------|
| `<layout>` | -- | Markdown table |
| `<header>` | -- | Table header row |
| `<row>` | -- | Table body row |
| `<column>` | `leaders`, `colspan` | Table cell |

### Namespace Disambiguation

The critical distinction: `<table>` elements use the **XHTML namespace** (`http://www.w3.org/1999/xhtml`), while `<layout>` elements use the **default USLM namespace**. The SAX parser must be namespace-aware to handle both correctly.

---

## TOC Elements

Table of contents elements appear within big-level containers. They are included in `README.md` files for title and chapter directories but omitted from individual section files.

| Element | Markdown Output |
|---------|-----------------|
| `<toc>` | Markdown table or list |
| `<tocItem>` | Row: section/chapter number + name |

---

## Quoted Content Elements

Quoted content represents text quoted from other legislation, typically appearing in statutory notes that reproduce portions of enacted bills.

| Element | Markdown Output | Notes |
|---------|-----------------|-------|
| `<quotedContent>` | Blockquote: `> text` | `origin` attribute indicates the source |
| `<quotedText>` | Inline quotes: `"text"` | For short inline quotations |

**Critical behavior:** `<section>` elements inside `<quotedContent>` represent quoted bill text, not actual sections of the Code. The converter tracks a `quotedContentDepth` counter and suppresses section emission when the depth is greater than zero.

---

## Special Elements

| Element | Handling | Notes |
|---------|----------|-------|
| `<compiledAct>` | Treated as a level | Title appendices; output to `title-NN-appendix/` directory |
| `<courtRules>` | Treated as a level container | Groups court rules in title appendices |
| `<courtRule>` | Treated as a level | Individual court rule in appendix |
| `<reorganizationPlans>` | Treated as a level container | Groups reorganization plans in title appendices |
| `<reorganizationPlan>` | Treated as a level | Individual reorganization plan in appendix |
| `<br>` | Markdown line break | Two trailing spaces or `<br>` |
| `<fillIn>` | Silently ignored | Placeholder for fill-in-the-blank fields (not present in USC) |
| `<checkBox>` | Silently ignored | Rare in USC |
| `<img>` | Silently ignored | Not currently handled |
| `<center>` | Content preserved as text | Centering is a presentation concern, not semantic |
| `<marker>` | Silently ignored | Empty/position-only element (rare) |

---

## Universal Attributes

These attributes can appear on most USLM elements (defined in the `BaseType` abstract type):

| Attribute | Type | Purpose | Notes |
|-----------|------|---------|-------|
| `@id` | string | Immutable GUID (prefixed with `"id"`) | Never changes, even when the element moves |
| `@identifier` | string | Full canonical URI path | e.g., `/us/usc/t1/s1`; on root and level elements |
| `@temporalId` | string | Human-readable evolving name | e.g., `s1_a_2`; underscores map to slashes in ref paths |
| `@name` | string | Local name scoped to parent | Supports `{num}` and `{index}` template parameters |
| `@role` | string | Refinement of element semantics | e.g., `"crossHeading"` on notes |
| `@class` | string | CSS-like classes (space-separated) | e.g., `"indent-up1"`, `"blockIndent2"` |
| `@status` | StatusEnum | Legal state of the element | See Status Values below |
| `@startPeriod` | string | Start of temporal validity | For point-in-time versioning |
| `@endPeriod` | string | End of temporal validity | For point-in-time versioning |
| `@partial` | boolean | Whether status applies partially | Used with `@status` |
| `@xml:lang` | string | Language code | Inherited from parent elements |

### Status Values (StatusEnum)

The schema defines 18 status values. Multiple versions of the same element may coexist in the document, differentiated by `@startPeriod`/`@endPeriod` and `@status`.

| Value | Meaning |
|-------|---------|
| `proposed` | Proposed legislation |
| `withdrawn` | Withdrawn |
| `cancelled` | Cancelled |
| `pending` | Pending enactment |
| `operational` | Currently operative |
| `suspended` | Temporarily suspended |
| `renumbered` | Renumbered to another designation |
| `repealed` | Repealed by subsequent legislation |
| `expired` | Expired per its own terms |
| `terminated` | Terminated |
| `hadItsEffect` | Had its effect (transitional provision) |
| `omitted` | Omitted from the Code |
| `notAdopted` | Not adopted |
| `transferred` | Transferred to another location |
| `redesignated` | Redesignated under a different identifier |
| `reserved` | Reserved for future use |
| `vacant` | Vacant |
| `crossReference` | Cross-reference placeholder |
| `unknown` | Status unknown |

---

## Namespaces Summary

| Namespace URI | Prefix | Used For |
|--------------|--------|----------|
| `http://xml.house.gov/schemas/uslm/1.0` | *(default)* | All USLM structural and content elements |
| `http://purl.org/dc/elements/1.1/` | `dc` | Dublin Core metadata (`dc:title`, `dc:type`) |
| `http://purl.org/dc/terms/` | `dcterms` | DC Terms metadata (`dcterms:created`) |
| `http://www.w3.org/1999/xhtml` | *(varies)* | XHTML tables within content |
| `http://www.w3.org/2001/XMLSchema-instance` | `xsi` | Schema instance attributes |
