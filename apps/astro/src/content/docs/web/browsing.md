---
title: "Browsing Content"
description: "Navigate the U.S. Code, Code of Federal Regulations, and Federal Register on lexbuild.dev using the sidebar tree, source selector, and index pages."
order: 1
---

# Browsing Content

LexBuild serves three federal legal sources as structured Markdown, all browsable at [lexbuild.dev](https://lexbuild.dev).

## Sources

| Source | Coverage | Titles/Years |
|---|---|---|
| **U.S. Code** | Federal statutory law | 54 titles |
| **eCFR** | Code of Federal Regulations (electronic) | 50 titles |
| **Federal Register** | Daily regulatory publications | 2000 to present |

Use the **Browse** dropdown in the header to select a source. Each source opens to a title listing (USC, eCFR) or a year listing (Federal Register).

## Sidebar Navigation

Every source has a sidebar tree on the left side of the page. The tree reflects the legal hierarchy of the source and lets you drill into content without leaving the page.

The sidebar is resizable -- drag its right edge to adjust the width between 200px and 500px. Your preferred width is saved for future visits.

### U.S. Code (3 levels)

The USC sidebar follows the statutory hierarchy:

**Title > Chapter > Section**

Click a title to expand its chapters. Click a chapter to reveal its sections. Click a section to load the full text.

URL structure: `/usc/title-01/chapter-01/section-0001`

### eCFR (4 levels)

The eCFR sidebar adds a part level between chapter and section:

**Title > Chapter > Part > Section**

eCFR chapters use Roman numerals (e.g., `chapter-II`) rather than Arabic numbers. Section numbers are strings that can include letters and dots (e.g., `240.10b-5`).

URL structure: `/ecfr/title-17/chapter-II/part-240/section-240.10b-5`

### Federal Register (3 levels)

The FR sidebar is date-based rather than hierarchical:

**Year > Month > Document**

Years show total document counts. Months show per-month counts. Click a month to see all documents published during that period.

URL structure: `/fr/2026/03/2026-06029`

## Index Pages

When you select a title (USC or eCFR) or a year/month (FR), the main content area shows an index page rather than a single section.

**Title index pages** display chapter cards, each showing the chapter name and section count. Click any card to navigate to that chapter.

**Chapter and part index pages** list the sections within that grouping with links to each section page.

**FR month index pages** group documents by publication date and show document type badges (rule, notice, proposed rule, presidential document).

## Section Pages

Clicking a section in the sidebar or an index page opens the section page. This is where you read the full legal text. Each section page includes:

- **Frontmatter panel** -- YAML metadata about the section (identifier, title number, source, status)
- **Content area** -- The full Markdown body with subsections, notes, cross-references, and source credits
- **Breadcrumb navigation** -- Shows your position in the hierarchy with links back to parent levels

For details on the content viewer, see [Content Viewer](/docs/web/content-viewer). For details on frontmatter fields, see [Frontmatter](/docs/web/frontmatter).

## Dark Mode

Click the theme toggle in the header to switch between light and dark modes. The site defaults to light mode, and your preference is saved to local storage for future visits.
