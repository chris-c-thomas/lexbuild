---
title: "Web Quickstart"
description: "Browse the U.S. Code, Code of Federal Regulations, and Federal Register as structured Markdown on lexbuild.dev."
order: 3
---

# Web Quickstart

Browse the full U.S. Code, Code of Federal Regulations, and Federal Register as structured Markdown directly in your browser.

## Open LexBuild

Visit [lexbuild.dev](https://lexbuild.dev) to start browsing. The homepage shows all three legal sources with links to begin exploring.

## Choose a Source

Use the **Browse** dropdown in the header to select a source:

- **U.S. Code** -- 54 titles of federal statutory law
- **eCFR** -- 50 titles of federal regulations
- **Federal Register** -- Daily regulatory publications from 2000 to present

## Navigate the Hierarchy

Each source has a sidebar tree that lets you drill down through the hierarchy:

**U.S. Code**: Title > Chapter > Section

**eCFR**: Title > Chapter > Part > Section

**Federal Register**: Year > Month > Document

Click any title in the sidebar to expand its chapters. Click a chapter to see its sections. Click a section to view the full content.

## View Content

Each section page shows:

- **YAML frontmatter** with metadata (identifier, title number, section number, currency, status)
- **Markdown body** with the full statutory or regulatory text, including subsections, notes, and cross-references
- **Source credit** and amendment history (for USC)

Toggle between **Markdown** and **Preview** tabs to see the raw source or rendered HTML.

## Copy and Download

Use the toolbar buttons on any section page:

- **Copy** -- Copies the complete `.md` file (frontmatter + body) to your clipboard
- **Download** -- Downloads the section as a standalone `.md` file

Both include the full YAML frontmatter, so the downloaded file is ready for ingestion into your pipeline.

## Search

Press **Cmd+K** (or **Ctrl+K** on Windows/Linux) to open the search dialog. Search across all sources simultaneously -- results show the source, title, and section with a preview of matching text.

> [!TIP]
> Use the source filter in search results to narrow results to just USC, eCFR, or Federal Register documents.

## Dark Mode

Click the theme toggle in the header to switch between light and dark modes. Your preference is saved for future visits.

## Next Steps

- [Search](/docs/web/search) -- Full-text search with filters and keyboard shortcuts
- [Content Viewer](/docs/web/content-viewer) -- Markdown/preview toggle, copy, and download details
- [Frontmatter](/docs/web/frontmatter) -- Understanding YAML metadata fields
