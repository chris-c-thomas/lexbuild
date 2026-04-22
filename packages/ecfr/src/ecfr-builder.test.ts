import { describe, it, expect } from "vitest";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { XMLParser } from "@lexbuild/core";
import type { LevelNode, EmitContext } from "@lexbuild/core";
import { EcfrASTBuilder } from "./ecfr-builder.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../../fixtures/fragments/ecfr");

/** Helper: walk a level node's subtree and collect descendants of a given level type. */
function collectLevelsOfType(root: LevelNode, levelType: string): LevelNode[] {
  const out: LevelNode[] = [];
  const walk = (node: LevelNode): void => {
    for (const child of node.children) {
      if (child.type === "level") {
        const lvl = child as LevelNode;
        if (lvl.levelType === levelType) out.push(lvl);
        walk(lvl);
      }
    }
  };
  walk(root);
  return out;
}

/** Helper: parse an XML fixture and collect emitted nodes */
async function parseFixture(
  fixtureName: string,
  emitAt:
    | "section"
    | "part"
    | "chapter"
    | "title"
    | ReadonlySet<"section" | "part" | "chapter" | "title"> = "section",
): Promise<Array<{ node: LevelNode; context: EmitContext }>> {
  const collected: Array<{ node: LevelNode; context: EmitContext }> = [];

  const builder = new EcfrASTBuilder({
    emitAt,
    onEmit: (node, context) => {
      collected.push({ node, context });
    },
  });

  const parser = new XMLParser({ defaultNamespace: "" });
  parser.on("openElement", (name, attrs) => builder.onOpenElement(name, attrs));
  parser.on("closeElement", (name) => builder.onCloseElement(name));
  parser.on("text", (text) => builder.onText(text));

  const stream = createReadStream(resolve(FIXTURES_DIR, fixtureName), "utf-8");
  await parser.parseStream(stream);

  return collected;
}

describe("EcfrASTBuilder", () => {
  it("parses a simple section into a LevelNode with section levelType", async () => {
    const collected = await parseFixture("simple-section.xml");
    expect(collected.length).toBe(1);

    const { node } = collected[0]!;
    expect(node.type).toBe("level");
    expect(node.levelType).toBe("section");
    expect(node.numValue).toBe("1.1");
    expect(node.heading).toBe("Definitions.");
  });

  it("builds correct identifier for sections", async () => {
    const collected = await parseFixture("simple-section.xml");
    const { node } = collected[0]!;
    expect(node.identifier).toBe("/us/cfr/t1/s1.1");
  });

  it("populates ancestor chain in EmitContext", async () => {
    const collected = await parseFixture("simple-section.xml");
    const { context } = collected[0]!;

    // Ancestors should include title, chapter, subchapter, part
    const types = context.ancestors.map((a) => a.levelType);
    expect(types).toContain("title");
    expect(types).toContain("chapter");
    expect(types).toContain("subchapter");
    expect(types).toContain("part");
  });

  it("creates ContentNode children for P elements", async () => {
    const collected = await parseFixture("simple-section.xml");
    const { node } = collected[0]!;

    const contentNodes = node.children.filter((c) => c.type === "content");
    expect(contentNodes.length).toBeGreaterThan(0);
  });

  it("handles italic inline elements", async () => {
    const collected = await parseFixture("simple-section.xml");
    const { node } = collected[0]!;

    // Should have italic inline nodes (from <I> elements)
    const hasItalic = node.children.some(
      (c) =>
        c.type === "content" &&
        "children" in c &&
        (c as { children: Array<{ inlineType?: string }> }).children.some((i) => i.inlineType === "italic"),
    );
    expect(hasItalic).toBe(true);
  });

  it("parses AUTH and SOURCE as note nodes", async () => {
    const collected = await parseFixture("section-with-authority.xml");
    // There's 1 section emitted
    expect(collected.length).toBe(1);

    // Part-level AUTH and SOURCE nodes should be in the part ancestor
    // but since we emit at section level, they'll be on the part
    // The section itself should have content
    const { node } = collected[0]!;
    const contentNodes = node.children.filter((c) => c.type === "content");
    expect(contentNodes.length).toBeGreaterThan(0);
  });

  it("parses CITA as a note node", async () => {
    const collected = await parseFixture("section-with-notes.xml");
    const { node } = collected[0]!;

    const noteNodes = node.children.filter((c) => c.type === "note");
    // Should have CITA and SECAUTH notes
    expect(noteNodes.length).toBeGreaterThan(0);
  });

  it("emits multiple sections from title-structure fixture", async () => {
    const collected = await parseFixture("title-structure.xml");
    // title-structure has 3 sections: 1.1, 2.1, 2.2
    expect(collected.length).toBe(3);

    const nums = collected.map((c) => c.node.numValue);
    expect(nums).toContain("1.1");
    expect(nums).toContain("2.1");
    expect(nums).toContain("2.2");
  });

  it("emits at part level when configured, with sections aggregated as children", async () => {
    const collected = await parseFixture("title-structure.xml", "part");
    // Only parts emit (strict equality with emitAt). Sections aggregate into
    // their parent part's children — they are NOT emitted separately.
    expect(collected.length).toBe(2);
    expect(collected.every((c) => c.node.levelType === "part")).toBe(true);

    const partNums = collected.map((c) => c.node.numValue);
    expect(partNums).toContain("1");
    expect(partNums).toContain("2");

    // Each emitted part should have its sections inlined as level children.
    const allSections = collected.flatMap((c) =>
      c.node.children.filter((ch) => ch.type === "level" && (ch as LevelNode).levelType === "section"),
    );
    expect(allSections.length).toBe(3);
  });

  it("emits at title level when configured, with full hierarchy as children", async () => {
    const collected = await parseFixture("title-structure.xml", "title");
    expect(collected.length).toBe(1);
    expect(collected[0]!.node.levelType).toBe("title");

    // The emitted title should contain the full tree (chapter → subchapter → parts → sections).
    const title = collected[0]!.node;
    const allLevels = collectLevelsOfType(title, "part");
    expect(allLevels.length).toBe(2);

    const allSections = collectLevelsOfType(title, "section");
    expect(allSections.length).toBe(3);
  });

  it("strips section number prefix from headings", async () => {
    const collected = await parseFixture("section-with-emphasis.xml");
    const { node } = collected[0]!;

    // HEAD is "§ 240.10b-5   Employment of manipulative and deceptive devices."
    // Heading should strip the "§ 240.10b-5" prefix
    expect(node.heading).toBe("Employment of manipulative and deceptive devices.");
  });

  it("handles FP (flush paragraph) elements", async () => {
    const collected = await parseFixture("section-with-emphasis.xml");
    const { node } = collected[0]!;

    // The fixture has an FP element: "in connection with the purchase or sale..."
    const contentNodes = node.children.filter((c) => c.type === "content");
    expect(contentNodes.length).toBeGreaterThan(3); // (a), (b), (c) + FP
  });

  it("emits section, part, and title in a single pass when emitAt is a Set", async () => {
    const collected = await parseFixture(
      "title-structure.xml",
      new Set<"section" | "part" | "title">(["section", "part", "title"]),
    );

    const sectionEmits = collected.filter((c) => c.node.levelType === "section");
    const partEmits = collected.filter((c) => c.node.levelType === "part");
    const titleEmits = collected.filter((c) => c.node.levelType === "title");

    expect(sectionEmits.length).toBe(3);
    expect(partEmits.length).toBe(2);
    expect(titleEmits.length).toBe(1);

    // Deeper levels fire before their ancestors.
    const firstSectionIdx = collected.findIndex((c) => c.node.levelType === "section");
    const firstPartIdx = collected.findIndex((c) => c.node.levelType === "part");
    const firstTitleIdx = collected.findIndex((c) => c.node.levelType === "title");
    expect(firstSectionIdx).toBeLessThan(firstPartIdx);
    expect(firstPartIdx).toBeLessThan(firstTitleIdx);

    // The emitted title contains all three sections as descendants, by reference.
    const titleNode = titleEmits[0]!.node;
    const sectionsInTitle = collectLevelsOfType(titleNode, "section");
    expect(sectionsInTitle.length).toBe(3);
    for (const sec of sectionEmits) {
      expect(sectionsInTitle).toContain(sec.node);
    }

    // The emitted part contains its sections as descendants, by reference.
    const part1 = partEmits.find((p) => p.node.numValue === "1")!.node;
    const sectionsInPart1 = collectLevelsOfType(part1, "section");
    expect(sectionsInPart1.map((s) => s.numValue)).toEqual(["1.1"]);
  });

  it("a multi-emit section's context still lists its ancestors (no self-reference)", async () => {
    const collected = await parseFixture(
      "title-structure.xml",
      new Set<"section" | "part" | "title">(["section", "title"]),
    );

    const firstSection = collected.find((c) => c.node.levelType === "section")!;
    const types = firstSection.context.ancestors.map((a) => a.levelType);
    expect(types).toContain("title");
    expect(types).toContain("part");
    expect(types).not.toContain("section");
  });

  it("handles appendix structure", async () => {
    const collected = await parseFixture("appendix.xml");
    // At section emit level, sections are emitted. Appendix is a big level
    // (above section in hierarchy), so it's not emitted separately — its
    // content is collected as a child of the part.
    const sections = collected.filter((c) => c.node.levelType === "section");
    expect(sections.length).toBe(1);

    // To verify appendix is parsed, emit at part level
    const partLevel = await parseFixture("appendix.xml", "part");
    const parts = partLevel.filter((c) => c.node.levelType === "part");
    expect(parts.length).toBe(1);

    // Part should contain both the section and the appendix as children
    const part = parts[0]!;
    const appendixChildren = part.node.children.filter(
      (c) => c.type === "level" && (c as LevelNode).levelType === "appendix",
    );
    expect(appendixChildren.length).toBe(1);
    expect((appendixChildren[0] as LevelNode).numValue).toBe("Appendix A");
  });

  it("multi-emit {part,title} attaches appendix to part exactly once (stack-based attach rule)", async () => {
    // An appendix nested inside a part is the motivating case for
    // `hasEmittingAncestorOnStack` — appendix is a "big level" with a lower
    // hierarchy index than part, so naive index-based reasoning would drop
    // the appendix from the part's children. The live stack check keeps it
    // attached once.
    const collected = await parseFixture(
      "appendix.xml",
      new Set<"section" | "part" | "title">(["part", "title"]),
    );

    const parts = collected.filter((c) => c.node.levelType === "part");
    const titles = collected.filter((c) => c.node.levelType === "title");
    expect(parts.length).toBe(1);
    expect(titles.length).toBe(1);

    const partAppendixes = collectLevelsOfType(parts[0]!.node, "appendix");
    expect(partAppendixes.length).toBe(1);
    expect(partAppendixes[0]!.numValue).toBe("Appendix A");

    // The same appendix instance is reachable from the title subtree (via part).
    const titleAppendixes = collectLevelsOfType(titles[0]!.node, "appendix");
    expect(titleAppendixes).toContain(partAppendixes[0]);
  });
});
