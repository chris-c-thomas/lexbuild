---
title: "Content Viewer"
description: "Use the content viewer on lexbuild.dev to read legal text in Markdown or rendered HTML, copy sections to clipboard, and download standalone .md files."
order: 3
---

# Content Viewer

Every section page on lexbuild.dev has a content viewer with two display modes, a copy button, and a download button. The viewer gives you direct access to the structured Markdown that LexBuild produces.

## Two Views

The content viewer has a tab toggle at the top of the content area with two options:

### Markdown

The Markdown tab shows the raw `.md` source, including the YAML frontmatter block and the full body text. The source is syntax-highlighted using LexBuild's custom Shiki themes, which adapt to your current light or dark mode setting.

This is the same content you get when you copy or download the section. It includes heading structure, lettered and numbered subsections, editorial notes, cross-reference links, and source credits.

### Preview

The Preview tab renders the Markdown as styled HTML using the prose typography plugin. This is the same content, but formatted for reading rather than ingestion. Headings, lists, tables, and emphasis render as you would expect from a Markdown preview.

Use the Preview tab when you want to read the legal text comfortably. Use the Markdown tab when you want to inspect the exact output format or verify frontmatter fields.

## Copy to Clipboard

Click the **Copy** button to copy the complete `.md` file to your clipboard. The copied content includes:

- The full YAML frontmatter block (between `---` fences)
- The Markdown body with all headings, subsections, notes, and cross-references

This is the same content as the file you would get from the CLI or API. You can paste it directly into a document, a RAG pipeline, or an AI prompt.

## Download

Click the **Download** button to save the section as a standalone `.md` file. The filename matches the section identifier (e.g., `section-0001.md` or `section-240.10b-5.md`).

Like copy, the download includes the full frontmatter and body. The resulting file is self-contained and ready for ingestion without any additional processing.

## Syntax Highlighting

The Markdown tab uses LexBuild brand themes for syntax highlighting:

- **Light mode** -- A warm, high-contrast theme optimized for readability on light backgrounds
- **Dark mode** -- A blue-tinted dark theme that matches the site's dark slate-blue palette

Themes switch automatically when you toggle dark mode. Syntax highlighting is pre-rendered for fast page loads on large sections.
