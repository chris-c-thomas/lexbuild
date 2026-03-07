import type { HighlighterGeneric } from "shiki";
import { createHighlighter } from "shiki";

// Module-level singleton — persists across requests within a serverless function instance
let highlighter: HighlighterGeneric<string, string> | null = null;

async function getHighlighter(): Promise<HighlighterGeneric<string, string>> {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: ["markdown", "yaml"],
    });
  }
  return highlighter;
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
