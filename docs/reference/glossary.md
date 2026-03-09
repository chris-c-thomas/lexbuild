# Glossary

This glossary defines legal, technical, and LexBuild-specific terms used throughout the documentation. Terms are organized by category and listed alphabetically within each category.

---

## Legal Terms

**Chapeau** -- The introductory text that precedes an enumerated list of sub-levels within a section or subsection. For example, the sentence "For purposes of this section, the following definitions apply:" is a chapeau that governs the subsequent paragraphs. Represented by the `<chapeau>` element in USLM XML. See [XML Element Reference](xml-element-reference.md#content-elements).

**Chapter** -- A major organizational division within a U.S. Code title. Chapters group related sections and are identified by Arabic numerals (e.g., Chapter 1, Chapter 35). In USLM identifiers, chapters use the `ch` prefix: `/us/usc/t1/ch1`. See [XML Element Reference](xml-element-reference.md#hierarchical-levels-big-levels).

**Clause** -- A sub-level within a subparagraph, numbered with lowercase Roman numerals: (i), (ii), (iii). In deeply nested statutory text, clauses represent the fourth level below a section. See [XML Element Reference](xml-element-reference.md#small-levels-within-sections).

**Codification** -- The process of organizing enacted statutes into the U.S. Code by subject matter. The OLRC performs this work, assigning each provision to the appropriate title, chapter, and section. Codification notes in the XML record how statutes were integrated.

**Compilation** -- The assembly of statutory text from multiple enactments into a single consolidated version. The U.S. Code is a compilation of general and permanent federal law. Titles that are not positive law represent a prima facie evidence compilation rather than legal evidence themselves.

**Continuation** -- Text that appears between or after enumerated sub-levels within a section. Unlike a chapeau (which precedes), continuation text is interstitial -- it can appear between items of the same level, not just after all sub-levels. Represented by the `<continuation>` element. See [XML Element Reference](xml-element-reference.md#content-elements).

**OLRC (Office of the Law Revision Counsel)** -- The office within the U.S. House of Representatives responsible for developing and maintaining the U.S. Code. The OLRC publishes the official XML files that LexBuild processes, available at [uscode.house.gov](https://uscode.house.gov/).

**Paragraph** -- A sub-level within a subsection, numbered with Arabic numerals: (1), (2), (3). In legal citation, "paragraph" has a specific structural meaning distinct from the typographic sense. See [XML Element Reference](xml-element-reference.md#small-levels-within-sections).

**Part** -- An organizational division within a chapter or subchapter, typically numbered with Roman numerals or uppercase letters. Parts group related sections at a finer granularity than chapters.

**Positive law** -- A title of the U.S. Code that has been enacted into law by Congress as a whole. Positive law titles are themselves legal evidence; their text is authoritative. Titles that are not positive law are prima facie evidence only -- the underlying Statutes at Large remain authoritative. As of 2026, 37 of 54 titles are positive law. See the `positive_law` frontmatter field in [Output Format](output-format.md#section-level-frontmatter).

**Prima facie evidence** -- Evidence that is sufficient on its face unless contradicted. Non-positive-law titles of the U.S. Code are prima facie evidence of the law -- they are presumed accurate but can be rebutted by the underlying Statutes at Large.

**Proviso** -- A conditional clause within statutory text, typically beginning with "Provided, That..." or "Provided further, That...". Provisos qualify or limit the preceding text. Represented by the `<proviso>` element in USLM XML. See [XML Element Reference](xml-element-reference.md#content-elements).

**Public law** -- A law enacted by Congress and signed by the President (or enacted over a veto). Public laws are numbered sequentially within each Congress: e.g., Public Law 119-73 is the 73rd law of the 119th Congress. Public laws are published in the Statutes at Large before being codified into the U.S. Code.

**Release point** -- A specific snapshot of the U.S. Code as published by the OLRC, identified by the most recent public law incorporated. For example, release point `119-73` includes all legislation through Public Law 119-73. Release points with exclusion suffixes (e.g., `119-73not60`) exclude specific laws that were enacted but not yet codified. See [CLI Reference](cli-reference.md#release-point-format).

**Section** -- The primary citable unit of the U.S. Code. Each section contains one coherent provision of law and is the atomic unit of LexBuild's output. Section numbers may be numeric (e.g., 101) or alphanumeric (e.g., 202a, 7701-1). See [XML Element Reference](xml-element-reference.md#primary-level).

**Session law** -- A law as published in the order it was enacted, before codification. The Statutes at Large are the official compilation of session laws.

**Source credit** -- The parenthetical citation at the end of a U.S. Code section that lists the original enacting legislation and all subsequent amendments. For example: "(July 30, 1947, ch. 388, 61 Stat. 633; Pub. L. 112-231, Dec. 28, 2012, 126 Stat. 1619.)". Represented by the `<sourceCredit>` element. See [XML Element Reference](xml-element-reference.md#note-elements).

**Statutes at Large** -- The official, chronological compilation of all laws enacted by Congress. Referenced in USLM by volume and page: `/us/stat/61/633` means volume 61, page 633.

**Subchapter** -- An organizational division within a chapter, typically numbered with Roman numerals (I, II, III). In USLM identifiers, subchapters use the `sch` prefix.

**Subclause** -- A sub-level within a clause, numbered with uppercase Roman numerals: (I), (II), (III). See [XML Element Reference](xml-element-reference.md#small-levels-within-sections).

**Subparagraph** -- A sub-level within a paragraph, numbered with uppercase letters: (A), (B), (C). See [XML Element Reference](xml-element-reference.md#small-levels-within-sections).

**Subpart** -- An organizational division within a part, typically designated with uppercase letters (A, B, C).

**Subsection** -- The first sub-level within a section, designated with lowercase letters: (a), (b), (c). Subsections may have their own headings. See [XML Element Reference](xml-element-reference.md#small-levels-within-sections).

**Subtitle** -- A high-level organizational division within a title, typically numbered with Roman numerals. Only some titles use subtitles (e.g., Title 26 has Subtitles A through K).

**Title** -- The highest organizational division of the U.S. Code. There are 54 titles, each covering a broad subject area (e.g., Title 1: General Provisions, Title 26: Internal Revenue Code, Title 42: The Public Health and Welfare). In USLM identifiers, titles use the `t` prefix: `/us/usc/t26`.

**U.S. Code** -- The official compilation of general and permanent federal statutory law, organized by subject matter into 54 titles. Published and maintained by the OLRC. The XML source files that LexBuild processes are the OLRC's official digital publication of the Code.

---

## Technical Terms

**AST (Abstract Syntax Tree)** -- An intermediate tree representation of the parsed XML document. LexBuild's AST uses typed nodes (`LevelNode`, `ContentNode`, `InlineNode`, `NoteNode`, `TableNode`, etc.) that capture the semantic structure of the legal text while discarding presentation-only XML details. The AST is constructed by the `ASTBuilder` in `@lexbuild/core` and consumed by the Markdown renderer. See [AST Model](../architecture/ast-model.md).

**Dublin Core** -- A metadata standard (`dc:title`, `dc:type`, `dcterms:created`, etc.) used within USLM `<meta>` elements to describe document properties. LexBuild extracts Dublin Core metadata into YAML frontmatter fields. See [XML Element Reference](xml-element-reference.md#metadata-elements).

**Frontmatter (YAML)** -- Structured metadata at the top of each Markdown file, enclosed in `---` delimiters. Frontmatter fields include the USLM identifier, title/section names, structural context, legal status, and format version. Designed for direct extraction by RAG pipelines and vector databases. See [Output Format](output-format.md#frontmatter-schema).

**Granularity** -- The level at which LexBuild produces output files. Three modes are supported: `section` (one file per section, the default), `chapter` (one file per chapter with sections inlined), and `title` (one file per title with the entire hierarchy inlined). Selected with `-g, --granularity` on the CLI. See [CLI Reference](cli-reference.md#granularity-modes).

**Namespace (XML)** -- A URI that scopes element and attribute names to avoid collisions. USLM XML uses five namespaces: the default USLM namespace for structural elements, Dublin Core and DC Terms for metadata, XHTML for embedded tables, and XSI for schema instance attributes. Namespace awareness is critical for distinguishing XHTML `<table>` from USLM `<layout>`. See [XML Element Reference](xml-element-reference.md#namespaces-summary).

**SAX (Simple API for XML)** -- An event-driven XML parsing model that processes elements sequentially without loading the entire document into memory. LexBuild uses SAX (via the `saxes` library) to handle U.S. Code XML files that can exceed 100 MB, keeping memory usage bounded. Contrast with DOM parsing, which builds a full in-memory tree. See [Core Package](../packages/core.md).

**Sidecar file (`_meta.json`)** -- A JSON metadata index file placed alongside Markdown output files. Title-level `_meta.json` lists all chapters and sections with token estimates and status. Chapter-level `_meta.json` lists sections within that chapter. Sidecar files enable programmatic access to the corpus structure without parsing individual Markdown files. See [Output Format](output-format.md#metadata-index-_metajson).

**USLM (United States Legislative Markup)** -- The XML schema used by the OLRC to publish the U.S. Code. Version 1.0 (patch level 1.0.15), namespace `http://xml.house.gov/schemas/uslm/1.0`. The schema defines document structure, identification, referencing, metadata, and presentation models for legislative text. See [XML Element Reference](xml-element-reference.md).

---

## LexBuild-Specific Terms

**Collect-then-write pattern** -- The strategy used by `@lexbuild/usc` where sections are collected in memory during SAX streaming and written to disk only after the XML stream completes. This avoids async I/O issues during synchronous SAX event processing. In section and chapter granularity, sections are written as each chapter completes; in title granularity, the entire title is held in memory before writing. See [U.S. Code Package](../packages/usc.md).

**Converter** -- The pipeline that transforms a single U.S. Code XML file into structured Markdown output. Implemented in `@lexbuild/usc` as the `convertTitle()` function, which orchestrates XML streaming, SAX parsing, AST construction, Markdown rendering, and file writing. See [U.S. Code Package](../packages/usc.md).

**Core** -- The `@lexbuild/core` package. Provides format-agnostic infrastructure: the XML parser, AST types and builder, Markdown renderer, frontmatter generator, and link resolver. Core has no knowledge of any specific legal source -- it is the shared foundation that all source packages build on. See [Core Package](../packages/core.md).

**Downloader** -- The component in `@lexbuild/usc` that fetches U.S. Code XML ZIP files from the OLRC, extracts the XML content, and writes it to the local filesystem. Supports individual title downloads and a bulk all-titles download. See [CLI Reference](cli-reference.md#lexbuild-download-options).

**Emit level / emitAt** -- The granularity at which the AST builder emits completed subtrees via callback. Set to `"section"` by default, meaning the builder emits each section's AST as soon as its closing tag is encountered. Can be set to `"chapter"` or `"title"` for coarser-grained output. Controlled by the `ASTBuilder.options.emitAt` property and maps to the `LEVEL_TYPES` hierarchy. See [AST Model](../architecture/ast-model.md).

**Link resolver** -- The component in `@lexbuild/core` that converts USLM cross-reference URIs (e.g., `/us/usc/t5/s101`) into Markdown links. Supports three modes: `plaintext` (no links), `relative` (file-relative paths within the output corpus), and `canonical` (OLRC website URLs). Uses a single-pass registration approach where converted sections are registered as they are written, enabling relative path resolution. See [CLI Reference](cli-reference.md#link-styles).

**Section-emit pattern** -- The memory management strategy used by the AST builder. When a section's closing XML tag is encountered during SAX streaming, the completed section subtree is emitted via callback and released from memory. This keeps memory bounded even when processing 100 MB+ XML files, since only one section's AST is held at a time (in section granularity mode). See [Core Package](../packages/core.md).

**Source package** -- A LexBuild package that implements conversion for a specific legal corpus. Each source package depends on `@lexbuild/core` for shared infrastructure and provides corpus-specific element handling, downloading, and file writing. Currently, `@lexbuild/usc` is the only source package. Future packages (e.g., `@lexbuild/cfr` for the Code of Federal Regulations) will follow the same pattern. See [Extending LexBuild](../development/extending.md).
