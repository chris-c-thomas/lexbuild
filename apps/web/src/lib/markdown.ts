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

// Extend default sanitize schema to allow id attributes (for rehype-slug anchors)
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "id"],
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
