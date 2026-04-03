import { describe, it, expect } from "vitest";
import { parseIdentifier, createLinkResolver } from "./links.js";

describe("parseIdentifier", () => {
  it("parses title-only identifier", () => {
    const result = parseIdentifier("/us/usc/t1");
    expect(result).toEqual({
      jurisdiction: "us",
      code: "usc",
      titleNum: "1",
      sectionNum: undefined,
      subPath: undefined,
    });
  });

  it("parses title + section identifier", () => {
    const result = parseIdentifier("/us/usc/t2/s285b");
    expect(result).toEqual({
      jurisdiction: "us",
      code: "usc",
      titleNum: "2",
      sectionNum: "285b",
      subPath: undefined,
    });
  });

  it("parses title + section + subsection", () => {
    const result = parseIdentifier("/us/usc/t1/s1/a/2");
    expect(result).toEqual({
      jurisdiction: "us",
      code: "usc",
      titleNum: "1",
      sectionNum: "1",
      subPath: "a/2",
    });
  });

  it("returns null for non-USC identifiers", () => {
    expect(parseIdentifier("/us/stat/61/633")).toBeNull();
    expect(parseIdentifier("/us/pl/112/231")).toBeNull();
    expect(parseIdentifier("/us/act/1947-07-30/ch388")).toBeNull();
  });

  it("returns null for malformed identifiers", () => {
    expect(parseIdentifier("")).toBeNull();
    expect(parseIdentifier("not-an-identifier")).toBeNull();
  });
});

describe("createLinkResolver", () => {
  describe("register and resolve", () => {
    it("resolves a registered section to a relative path", () => {
      const resolver = createLinkResolver();
      resolver.register("/us/usc/t1/s7", "output/usc/title-01/chapter-01/section-7.md");

      const result = resolver.resolve("/us/usc/t1/s7", "output/usc/title-01/chapter-01/section-1.md");
      expect(result).toBe("section-7.md");
    });

    it("resolves cross-chapter references with relative path", () => {
      const resolver = createLinkResolver();
      resolver.register("/us/usc/t1/s201", "output/usc/title-01/chapter-03/section-201.md");

      const result = resolver.resolve("/us/usc/t1/s201", "output/usc/title-01/chapter-01/section-1.md");
      expect(result).toBe("../chapter-03/section-201.md");
    });

    it("resolves cross-title references", () => {
      const resolver = createLinkResolver();
      resolver.register("/us/usc/t2/s100", "output/usc/title-02/chapter-05/section-100.md");

      const result = resolver.resolve("/us/usc/t2/s100", "output/usc/title-01/chapter-01/section-1.md");
      expect(result).toBe("../../title-02/chapter-05/section-100.md");
    });

    it("resolves subsection reference to its parent section file", () => {
      const resolver = createLinkResolver();
      resolver.register("/us/usc/t1/s7", "output/usc/title-01/chapter-01/section-7.md");

      // Reference to subsection (a) should resolve to the section file
      const result = resolver.resolve("/us/usc/t1/s7/a", "output/usc/title-01/chapter-01/section-1.md");
      expect(result).toBe("section-7.md");
    });

    it("returns null for unregistered identifiers", () => {
      const resolver = createLinkResolver();
      const result = resolver.resolve("/us/usc/t99/s1", "output/usc/title-01/chapter-01/section-1.md");
      expect(result).toBeNull();
    });
  });

  describe("fallbackUrl", () => {
    it("generates OLRC URL for USC section", () => {
      const resolver = createLinkResolver();
      const url = resolver.fallbackUrl("/us/usc/t42/s1983");
      expect(url).toBe("https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section1983");
    });

    it("generates OLRC URL for USC title", () => {
      const resolver = createLinkResolver();
      const url = resolver.fallbackUrl("/us/usc/t26");
      expect(url).toBe("https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26");
    });

    it("returns null for non-USC identifiers", () => {
      const resolver = createLinkResolver();
      expect(resolver.fallbackUrl("/us/stat/61/633")).toBeNull();
    });
  });
});
