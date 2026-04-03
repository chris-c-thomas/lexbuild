/** Strip markdown syntax to produce plaintext. */
export function stripMarkdown(markdown: string): string {
  return (
    markdown
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^>\s?/gm, "")
      .replace(/^---+$/gm, "")
      .replace(/\[\^[^\]]+\]/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
