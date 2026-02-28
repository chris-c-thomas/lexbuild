/**
 * YAML frontmatter generator for section Markdown files.
 */

import { stringify } from "yaml";
import type { FrontmatterData } from "../ast/types.js";

/** Output format version */
export const FORMAT_VERSION = "1.0.0";

/** Generator identifier */
export const GENERATOR = "law2md@0.1.0";

/**
 * Generate a YAML frontmatter string from section metadata.
 *
 * Returns a complete frontmatter block including the `---` delimiters.
 */
export function generateFrontmatter(data: FrontmatterData): string {
  // Build the frontmatter object with fields in the specified order.
  // We construct it manually to control field ordering.
  const fm: Record<string, unknown> = {
    identifier: data.identifier,
    title: data.title,
    title_number: data.title_number,
    title_name: data.title_name,
    section_number: data.section_number,
    section_name: data.section_name,
  };

  // Context fields (only include if present)
  if (data.chapter_number !== undefined) {
    fm["chapter_number"] = data.chapter_number;
  }
  if (data.chapter_name !== undefined) {
    fm["chapter_name"] = data.chapter_name;
  }
  if (data.subchapter_number !== undefined) {
    fm["subchapter_number"] = data.subchapter_number;
  }
  if (data.subchapter_name !== undefined) {
    fm["subchapter_name"] = data.subchapter_name;
  }
  if (data.part_number !== undefined) {
    fm["part_number"] = data.part_number;
  }
  if (data.part_name !== undefined) {
    fm["part_name"] = data.part_name;
  }

  // Metadata
  fm["positive_law"] = data.positive_law;
  fm["currency"] = data.currency;
  fm["last_updated"] = data.last_updated;
  fm["format_version"] = FORMAT_VERSION;
  fm["generator"] = GENERATOR;

  // Optional fields
  if (data.source_credit !== undefined) {
    fm["source_credit"] = data.source_credit;
  }
  if (data.status !== undefined) {
    fm["status"] = data.status;
  }

  const yamlStr = stringify(fm, {
    lineWidth: 0, // Don't wrap long lines
    defaultStringType: "QUOTE_DOUBLE",
    defaultKeyType: "PLAIN",
  });

  return `---\n${yamlStr}---`;
}
