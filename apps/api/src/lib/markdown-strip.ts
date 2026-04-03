/**
 * Strip markdown syntax to produce plaintext.
 * Handles headings, bold/italic, links, blockquotes, lists, and horizontal rules.
 */
export function stripMarkdown(markdown: string): string {
  return (
    markdown
      // Remove headings
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bold/italic markers
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
      // Remove links, keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove blockquote markers
      .replace(/^>\s?/gm, "")
      // Remove horizontal rules
      .replace(/^---+$/gm, "")
      // Remove footnote references
      .replace(/\[\^[^\]]+\]/g, "")
      // Collapse multiple blank lines
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
