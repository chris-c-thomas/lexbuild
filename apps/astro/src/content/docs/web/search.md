---
title: "Search"
description: "Use full-text search on lexbuild.dev to find sections across the U.S. Code, eCFR, and Federal Register with keyboard shortcuts and source filtering."
order: 2
---

# Search

LexBuild provides full-text search across all three legal sources. Search is powered by [Meilisearch](https://www.meilisearch.com/), which delivers fast, typo-tolerant results as you type.

## Opening the Search Dialog

Press **Cmd+K** on macOS or **Ctrl+K** on Windows/Linux to open the search dialog. You can also click the search button in the header.

The dialog opens as a modal overlay. Start typing to see results immediately.

## Search Results

Results appear as you type and include:

- **Source badge** -- Identifies whether the result is from USC, eCFR, or the Federal Register
- **Identifier** -- The canonical path (e.g., `/us/usc/t1/s1` or `/us/cfr/t17/s240.10b-5`)
- **Heading** -- The section title or document heading
- **Text preview** -- A snippet of matching text with highlighted search terms

Results are ranked by relevance across the identifier, heading, and body text of every section.

## Source Filtering

You can filter search results by source to narrow your results to just the U.S. Code, eCFR, or Federal Register. Use the source filter controls within the search dialog to toggle sources on or off.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| **Cmd+K** / **Ctrl+K** | Open the search dialog |
| **Escape** | Close the search dialog |
| **Up/Down arrows** | Navigate through results |
| **Enter** | Open the selected result |

You can navigate entirely by keyboard without touching the mouse. Press Cmd+K, type your query, arrow to the result you want, and press Enter to jump directly to that section.

## Typo Tolerance

Meilisearch corrects minor typos automatically. If you search for "regulaton" instead of "regulation," you still get relevant results. This is especially helpful with legal terminology and section numbers.

## Search Coverage

Search indexes every section across all three sources:

- **U.S. Code** -- All 54 titles of federal statutory law
- **eCFR** -- All 50 titles of federal regulations
- **Federal Register** -- Documents from 2000 to the most recent update

The search index is rebuilt when new content is deployed, so results reflect the latest available data.
