import matter from "gray-matter";
import type { ContentFrontmatter } from "./types";

/** Parse a raw .md file into frontmatter, body, and raw YAML. */
export function parseFrontmatter(raw: string): {
  frontmatter: ContentFrontmatter;
  body: string;
  rawYaml: string;
} {
  const result = matter(raw);
  return {
    frontmatter: result.data as ContentFrontmatter,
    body: result.content,
    rawYaml: result.matter,
  };
}
