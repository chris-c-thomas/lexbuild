import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import type { ContentFrontmatter } from "./types";

/** Parsed frontmatter + body from a Markdown file. */
export interface ParsedContent {
  frontmatter: ContentFrontmatter;
  body: string;
}

/**
 * Parse YAML frontmatter from a raw Markdown string.
 * Returns the typed frontmatter and the body (Markdown without frontmatter).
 */
export function parseFrontmatter(raw: string): ParsedContent {
  const { data, content } = matter(raw);
  return {
    frontmatter: data as ContentFrontmatter,
    body: content,
  };
}

// Allow id on headings only — rehype-slug adds ids post-sanitize so those are
// unaffected; this preserves any explicit heading anchors from source HTML.
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    h1: [...(defaultSchema.attributes?.["h1"] ?? []), "id"],
    h2: [...(defaultSchema.attributes?.["h2"] ?? []), "id"],
    h3: [...(defaultSchema.attributes?.["h3"] ?? []), "id"],
    h4: [...(defaultSchema.attributes?.["h4"] ?? []), "id"],
    h5: [...(defaultSchema.attributes?.["h5"] ?? []), "id"],
    h6: [...(defaultSchema.attributes?.["h6"] ?? []), "id"],
  },
};

// Module-level singleton processor — reused across requests
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeSlug)
  .use(rehypeStringify);

/**
 * Render a Markdown string (without frontmatter) to HTML.
 * Uses a singleton unified processor for performance.
 */
export async function renderMarkdownToHtml(markdown: string): Promise<string> {
  const result = await processor.process(markdown);
  return String(result);
}
