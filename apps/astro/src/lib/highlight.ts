import { getFile } from "./content";

/**
 * Load pre-rendered syntax-highlighted HTML for a content file.
 * Falls back to runtime Shiki if .highlighted.html doesn't exist.
 */
export async function getHighlightedHtml(contentPath: string, rawMarkdown: string): Promise<string> {
  // Try pre-rendered file first (produced by build pipeline)
  const highlightPath = contentPath.replace(/\.md$/, ".highlighted.html");
  const preRendered = await getFile(highlightPath);
  if (preRendered) return preRendered;

  // Fallback: runtime Shiki (local dev without pre-rendered highlights)
  const { highlightMarkdown } = await import("./shiki");
  return highlightMarkdown(rawMarkdown);
}
