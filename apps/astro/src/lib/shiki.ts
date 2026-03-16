import type { BundledLanguage, BundledTheme, HighlighterGeneric } from "shiki";
import { createHighlighter } from "shiki";

let highlighterPromise: Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> | null = null;

function getHighlighter() {
  highlighterPromise ??= createHighlighter({
    themes: ["github-light-default", "github-dark-default"],
    langs: ["markdown", "yaml"],
  });
  return highlighterPromise;
}

/** Highlight Markdown with dual themes for light/dark mode. */
export async function highlightMarkdown(code: string): Promise<string> {
  const hl = await getHighlighter();
  return hl.codeToHtml(code, {
    lang: "markdown",
    themes: { light: "github-light-default", dark: "github-dark-default" },
  });
}
