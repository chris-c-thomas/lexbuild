import type { BundledLanguage, BundledTheme, HighlighterGeneric } from "shiki";
import { createHighlighter } from "shiki";

// Cache the Promise to prevent concurrent requests from creating multiple instances
let highlighterPromise: Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> | null = null;

function getHighlighter(): Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: ["markdown", "yaml"],
    });
  }
  return highlighterPromise;
}

/**
 * Highlight a raw Markdown string with Shiki using dual themes.
 * Returns an HTML string with both light and dark theme styles.
 */
export async function highlightMarkdown(code: string): Promise<string> {
  const hl = await getHighlighter();
  return hl.codeToHtml(code, {
    lang: "markdown",
    themes: {
      light: "github-light",
      dark: "github-dark",
    },
  });
}
