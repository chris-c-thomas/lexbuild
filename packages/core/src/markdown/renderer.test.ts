import { describe, it, expect } from "vitest";
import { renderSection, renderNode, renderDocument } from "./renderer.js";
import type { RenderOptions } from "./renderer.js";
import type {
  LevelNode,
  ContentNode,
  InlineNode,
  SourceCreditNode,
  NoteNode,
  NotesContainerNode,
  QuotedContentNode,
  FrontmatterData,
} from "../ast/types.js";

const DEFAULT_OPTS: RenderOptions = { headingOffset: 0, linkStyle: "plaintext" };

/** Helper: create a text inline node */
function text(t: string): InlineNode {
  return { type: "inline", inlineType: "text", text: t };
}

/** Helper: create a content node with text */
function content(t: string, variant: ContentNode["variant"] = "content"): ContentNode {
  return { type: "content", variant, children: [text(t)] };
}

describe("renderSection", () => {
  it("renders a simple section heading", () => {
    const section: LevelNode = {
      type: "level",
      levelType: "section",
      num: "§ 2.",
      numValue: "2",
      heading: '"County" as including "parish", and so forth',
      children: [],
    };
    const result = renderSection(section, DEFAULT_OPTS);
    expect(result).toBe('# § 2. "County" as including "parish", and so forth');
  });

  it("renders section with content", () => {
    const section: LevelNode = {
      type: "level",
      levelType: "section",
      num: "§ 3.",
      numValue: "3",
      heading: '"Vessel" as including all means of water transportation',
      children: [content('The word "vessel" includes every description of watercraft.')],
    };
    const result = renderSection(section, DEFAULT_OPTS);
    expect(result).toContain("# § 3.");
    expect(result).toContain('The word "vessel" includes every description of watercraft.');
  });

  it("respects headingOffset", () => {
    const section: LevelNode = {
      type: "level",
      levelType: "section",
      num: "§ 1.",
      heading: "Test",
      children: [],
    };
    const result = renderSection(section, { headingOffset: 1, linkStyle: "plaintext" });
    expect(result).toMatch(/^## § 1\. Test$/);
  });
});

describe("renderNode — small levels", () => {
  it("renders subsection with bold inline numbering", () => {
    const subsection: LevelNode = {
      type: "level",
      levelType: "subsection",
      num: "(a)",
      numValue: "a",
      children: [content("For the purposes of any Federal law.")],
    };
    const result = renderNode(subsection, DEFAULT_OPTS);
    expect(result).toBe("**(a)** For the purposes of any Federal law.");
  });

  it("renders subsection with heading", () => {
    const subsection: LevelNode = {
      type: "level",
      levelType: "subsection",
      num: "(a)",
      numValue: "a",
      heading: "In general.",
      children: [content("Some text here.")],
    };
    const result = renderNode(subsection, DEFAULT_OPTS);
    expect(result).toContain("**(a)** **In general.**");
    expect(result).toContain("Some text here.");
  });

  it("renders paragraph with bold number", () => {
    const para: LevelNode = {
      type: "level",
      levelType: "paragraph",
      num: "(1)",
      numValue: "1",
      children: [content("First paragraph.")],
    };
    const result = renderNode(para, DEFAULT_OPTS);
    expect(result).toBe("**(1)** First paragraph.");
  });

  it("renders nested subsection > paragraph", () => {
    const para: LevelNode = {
      type: "level",
      levelType: "paragraph",
      num: "(1)",
      numValue: "1",
      children: [content("Nested paragraph text.")],
    };
    const subsection: LevelNode = {
      type: "level",
      levelType: "subsection",
      num: "(a)",
      numValue: "a",
      children: [content("Chapeau text—", "chapeau"), para],
    };
    const result = renderNode(subsection, DEFAULT_OPTS);
    expect(result).toContain("**(a)** Chapeau text—");
    expect(result).toContain("**(1)** Nested paragraph text.");
  });
});

describe("renderNode — inline elements", () => {
  it("renders bold text", () => {
    const node: InlineNode = {
      type: "inline",
      inlineType: "bold",
      text: "important",
    };
    expect(renderNode(node, DEFAULT_OPTS)).toBe("**important**");
  });

  it("renders italic text", () => {
    const node: InlineNode = {
      type: "inline",
      inlineType: "italic",
      text: "emphasis",
    };
    expect(renderNode(node, DEFAULT_OPTS)).toBe("*emphasis*");
  });

  it("renders term as bold", () => {
    const node: InlineNode = {
      type: "inline",
      inlineType: "term",
      text: "person",
    };
    expect(renderNode(node, DEFAULT_OPTS)).toBe("**person**");
  });

  it("renders ref as plain text in plaintext mode", () => {
    const node: InlineNode = {
      type: "inline",
      inlineType: "ref",
      href: "/us/usc/t2/s100",
      text: "section 100 of Title 2",
    };
    expect(renderNode(node, DEFAULT_OPTS)).toBe("section 100 of Title 2");
  });

  it("renders ref as link in canonical mode", () => {
    const node: InlineNode = {
      type: "inline",
      inlineType: "ref",
      href: "/us/usc/t2/s100",
      text: "section 100 of Title 2",
    };
    const opts: RenderOptions = { headingOffset: 0, linkStyle: "canonical" };
    const result = renderNode(node, opts);
    expect(result).toContain("[section 100 of Title 2]");
    expect(result).toContain("uscode.house.gov");
    expect(result).toContain("title2-section100");
  });

  it("renders ref with resolveLink in relative mode", () => {
    const node: InlineNode = {
      type: "inline",
      inlineType: "ref",
      href: "/us/usc/t1/s7",
      text: "section 7",
    };
    const opts: RenderOptions = {
      headingOffset: 0,
      linkStyle: "relative",
      resolveLink: (id) => (id === "/us/usc/t1/s7" ? "../chapter-01/section-7.md" : null),
    };
    expect(renderNode(node, opts)).toBe("[section 7](../chapter-01/section-7.md)");
  });

  it("renders non-USC ref as plain text", () => {
    const node: InlineNode = {
      type: "inline",
      inlineType: "ref",
      href: "/us/stat/61/633",
      text: "61 Stat. 633",
    };
    const opts: RenderOptions = { headingOffset: 0, linkStyle: "canonical" };
    expect(renderNode(node, opts)).toBe("61 Stat. 633");
  });

  it("renders footnoteRef", () => {
    const node: InlineNode = {
      type: "inline",
      inlineType: "footnoteRef",
      text: "1",
    };
    expect(renderNode(node, DEFAULT_OPTS)).toBe("[^1]");
  });

  it("renders sup and sub as HTML", () => {
    const sup: InlineNode = { type: "inline", inlineType: "sup", text: "2" };
    const sub: InlineNode = { type: "inline", inlineType: "sub", text: "n" };
    expect(renderNode(sup, DEFAULT_OPTS)).toBe("<sup>2</sup>");
    expect(renderNode(sub, DEFAULT_OPTS)).toBe("<sub>n</sub>");
  });

  it("renders quoted text with quotes", () => {
    const node: InlineNode = {
      type: "inline",
      inlineType: "quoted",
      text: "This Act shall apply.",
    };
    expect(renderNode(node, DEFAULT_OPTS)).toBe('"This Act shall apply."');
  });
});

describe("renderNode — source credit", () => {
  it("renders source credit with horizontal rule", () => {
    const node: SourceCreditNode = {
      type: "sourceCredit",
      children: [text("(July 30, 1947, ch. 388, 61 Stat. 633.)")],
    };
    const result = renderNode(node, DEFAULT_OPTS);
    expect(result).toBe("---\n\n**Source Credit**: (July 30, 1947, ch. 388, 61 Stat. 633.)");
  });
});

describe("renderNode — notes", () => {
  it("renders cross-heading note as H2", () => {
    const node: NoteNode = {
      type: "note",
      role: "crossHeading",
      heading: "Editorial Notes",
      children: [],
    };
    expect(renderNode(node, DEFAULT_OPTS)).toBe("## Editorial Notes");
  });

  it("renders regular note with H3 heading", () => {
    const node: NoteNode = {
      type: "note",
      topic: "amendments",
      heading: "Amendments",
      children: [content("2012—Pub. L. 112-231 struck out...")],
    };
    const result = renderNode(node, DEFAULT_OPTS);
    expect(result).toContain("### Amendments");
    expect(result).toContain("2012—Pub. L. 112-231 struck out...");
  });

  it("renders notes container", () => {
    const container: NotesContainerNode = {
      type: "notesContainer",
      notesType: "uscNote",
      children: [
        {
          type: "note",
          role: "crossHeading",
          heading: "Editorial Notes",
          children: [],
        },
        {
          type: "note",
          topic: "amendments",
          heading: "Amendments",
          children: [content("Some amendment text.")],
        },
      ],
    };
    const result = renderNode(container, DEFAULT_OPTS);
    expect(result).toContain("## Editorial Notes");
    expect(result).toContain("### Amendments");
    expect(result).toContain("Some amendment text.");
  });
});

describe("renderNode — quoted content", () => {
  it("renders as blockquote", () => {
    const node: QuotedContentNode = {
      type: "quotedContent",
      children: [content("This Act may be cited as the 'Test Act'.")],
    };
    const result = renderNode(node, DEFAULT_OPTS);
    expect(result).toContain("> This Act may be cited as the 'Test Act'.");
  });
});

describe("renderDocument", () => {
  it("combines frontmatter and section content", () => {
    const section: LevelNode = {
      type: "level",
      levelType: "section",
      num: "§ 2.",
      numValue: "2",
      heading: "Test section",
      children: [content("Some text.")],
    };
    const fm: FrontmatterData = {
      source: "usc",
      legal_status: "official_legal_evidence",
      identifier: "/us/usc/t1/s2",
      title: "1 USC § 2 - Test section",
      title_number: 1,
      title_name: "General Provisions",
      section_number: "2",
      section_name: "Test section",
      positive_law: true,
      currency: "119-73",
      last_updated: "2025-12-03",
    };
    const result = renderDocument(section, fm, DEFAULT_OPTS);

    // Should start with frontmatter
    expect(result).toMatch(/^---\n/);
    // Should contain section content
    expect(result).toContain("# § 2. Test section");
    expect(result).toContain("Some text.");
    // Should end with newline
    expect(result).toMatch(/\n$/);
  });
});
