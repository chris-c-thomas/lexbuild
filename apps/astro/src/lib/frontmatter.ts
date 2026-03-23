import matter from "gray-matter";
import type { ContentFrontmatter } from "./types";

/** Parse a raw .md file into frontmatter, body, and raw YAML. */
export function parseFrontmatter(raw: string): {
  frontmatter: ContentFrontmatter;
  body: string;
  rawYaml: string;
} {
  // cache: false prevents gray-matter from returning a cached object whose
  // .matter property was cleared by a previous .data access (lazy getter bug)
  const result = matter(raw, { cache: false });
  const rawYaml = result.matter;
  return {
    frontmatter: result.data as ContentFrontmatter,
    body: result.content,
    rawYaml,
  };
}
