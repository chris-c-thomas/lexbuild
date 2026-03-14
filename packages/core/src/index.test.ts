import { describe, it, expect } from "vitest";
import {
  // XML parsing
  XMLParser,
  USLM_NS,
  XHTML_NS,
  DC_NS,
  DCTERMS_NS,
  LEVEL_ELEMENTS,
  CONTENT_ELEMENTS,
  INLINE_ELEMENTS,
  // AST
  ASTBuilder,
  LEVEL_TYPES,
  BIG_LEVELS,
  SMALL_LEVELS,
  // Markdown
  renderDocument,
  renderSection,
  renderNode,
  generateFrontmatter,
  FORMAT_VERSION,
  GENERATOR,
} from "./index.js";

describe("@lexbuild/core barrel exports", () => {
  it("exports XML parser and namespace constants", () => {
    expect(XMLParser).toBeDefined();
    expect(USLM_NS).toBe("http://xml.house.gov/schemas/uslm/1.0");
    expect(XHTML_NS).toBe("http://www.w3.org/1999/xhtml");
    expect(DC_NS).toBe("http://purl.org/dc/elements/1.1/");
    expect(DCTERMS_NS).toBe("http://purl.org/dc/terms/");
  });

  it("exports element classification sets", () => {
    expect(LEVEL_ELEMENTS.has("section")).toBe(true);
    expect(CONTENT_ELEMENTS.has("content")).toBe(true);
    expect(INLINE_ELEMENTS.has("ref")).toBe(true);
  });

  it("exports AST builder and type constants", () => {
    expect(ASTBuilder).toBeDefined();
    expect(LEVEL_TYPES).toContain("section");
    expect(BIG_LEVELS.has("title")).toBe(true);
    expect(SMALL_LEVELS.has("subsection")).toBe(true);
  });

  it("exports Markdown rendering functions", () => {
    expect(typeof renderDocument).toBe("function");
    expect(typeof renderSection).toBe("function");
    expect(typeof renderNode).toBe("function");
    expect(typeof generateFrontmatter).toBe("function");
    expect(FORMAT_VERSION).toBe("1.1.0");
    expect(GENERATOR).toMatch(/^lexbuild@/);
  });
});
