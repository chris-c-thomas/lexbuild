import { describe, it, expect } from "vitest";
import {
  USLM_NS,
  XHTML_NS,
  DC_NS,
  DCTERMS_NS,
  NAMESPACE_PREFIXES,
  LEVEL_ELEMENTS,
  CONTENT_ELEMENTS,
  INLINE_ELEMENTS,
  NOTE_ELEMENTS,
} from "./uslm-elements.js";

describe("namespace constants", () => {
  it("defines correct USLM namespace", () => {
    expect(USLM_NS).toBe("http://xml.house.gov/schemas/uslm/1.0");
  });

  it("defines correct XHTML namespace", () => {
    expect(XHTML_NS).toBe("http://www.w3.org/1999/xhtml");
  });

  it("maps XHTML to 'xhtml' prefix", () => {
    expect(NAMESPACE_PREFIXES[XHTML_NS]).toBe("xhtml");
  });

  it("maps DC to 'dc' prefix", () => {
    expect(NAMESPACE_PREFIXES[DC_NS]).toBe("dc");
  });

  it("maps DCTERMS to 'dcterms' prefix", () => {
    expect(NAMESPACE_PREFIXES[DCTERMS_NS]).toBe("dcterms");
  });
});

describe("element classification sets", () => {
  it("LEVEL_ELEMENTS contains section and hierarchy levels", () => {
    expect(LEVEL_ELEMENTS.has("section")).toBe(true);
    expect(LEVEL_ELEMENTS.has("subsection")).toBe(true);
    expect(LEVEL_ELEMENTS.has("chapter")).toBe(true);
    expect(LEVEL_ELEMENTS.has("title")).toBe(true);
    expect(LEVEL_ELEMENTS.has("paragraph")).toBe(true);
    expect(LEVEL_ELEMENTS.has("subsubitem")).toBe(true);
  });

  it("CONTENT_ELEMENTS contains text block types", () => {
    expect(CONTENT_ELEMENTS.has("content")).toBe(true);
    expect(CONTENT_ELEMENTS.has("chapeau")).toBe(true);
    expect(CONTENT_ELEMENTS.has("continuation")).toBe(true);
    expect(CONTENT_ELEMENTS.has("proviso")).toBe(true);
  });

  it("INLINE_ELEMENTS contains formatting elements", () => {
    expect(INLINE_ELEMENTS.has("b")).toBe(true);
    expect(INLINE_ELEMENTS.has("i")).toBe(true);
    expect(INLINE_ELEMENTS.has("ref")).toBe(true);
    expect(INLINE_ELEMENTS.has("term")).toBe(true);
    expect(INLINE_ELEMENTS.has("date")).toBe(true);
  });

  it("NOTE_ELEMENTS contains note types", () => {
    expect(NOTE_ELEMENTS.has("note")).toBe(true);
    expect(NOTE_ELEMENTS.has("notes")).toBe(true);
    expect(NOTE_ELEMENTS.has("sourceCredit")).toBe(true);
    expect(NOTE_ELEMENTS.has("statutoryNote")).toBe(true);
    expect(NOTE_ELEMENTS.has("editorialNote")).toBe(true);
  });

  it("element sets are disjoint where expected", () => {
    // Levels and content should not overlap
    for (const el of CONTENT_ELEMENTS) {
      expect(LEVEL_ELEMENTS.has(el)).toBe(false);
    }
    // Levels and inline should not overlap
    for (const el of INLINE_ELEMENTS) {
      expect(LEVEL_ELEMENTS.has(el)).toBe(false);
    }
  });
});
