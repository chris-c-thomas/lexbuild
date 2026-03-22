import type { BundledLanguage, BundledTheme, HighlighterGeneric } from "shiki";
import { createHighlighter } from "shiki";
import { lexbuildLight, lexbuildDark } from "./shiki-themes";

let highlighterPromise: Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> | null = null;

function getHighlighter() {
  highlighterPromise ??= createHighlighter({
    themes: [lexbuildLight, lexbuildDark],
    langs: ["markdown", "yaml"],
  });
  return highlighterPromise;
}

/** Highlight Markdown with LexBuild brand themes for light/dark mode. */
export async function highlightMarkdown(code: string): Promise<string> {
  const hl = await getHighlighter();
  return hl.codeToHtml(code, {
    lang: "markdown",
    themes: { light: "lexbuild-light", dark: "lexbuild-dark" },
  });
}

/** Highlight YAML with LexBuild brand themes for light/dark mode. */
export async function highlightYaml(code: string): Promise<string> {
  const hl = await getHighlighter();
  return hl.codeToHtml(code, {
    lang: "yaml",
    themes: { light: "lexbuild-light", dark: "lexbuild-dark" },
  });
}
