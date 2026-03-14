import { describe, it, expect, vi } from "vitest";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { XMLParser } from "../xml/parser.js";
import { ASTBuilder } from "./uslm-builder.js";
import type { ASTBuilderOptions } from "./uslm-builder.js";
import type { LevelNode, ContentNode, InlineNode, EmitContext, SourceCreditNode } from "./types.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../../../fixtures/fragments");

/** Helper: parse an XML string and collect emitted sections */
function parseAndCollect(xml: string, emitAt: ASTBuilderOptions["emitAt"] = "section") {
  const emitted: Array<{ node: LevelNode; context: EmitContext }> = [];

  const builder = new ASTBuilder({
    emitAt,
    onEmit: (node, context) => {
      emitted.push({ node, context });
    },
  });

  const parser = new XMLParser();
  parser.on("openElement", (name, attrs) => builder.onOpenElement(name, attrs));
  parser.on("closeElement", (name) => builder.onCloseElement(name));
  parser.on("text", (text) => builder.onText(text));

  parser.parseString(xml);

  return { emitted, builder };
}

/** Helper: parse a fixture file and collect emitted sections */
async function parseFileAndCollect(
  filename: string,
  emitAt: ASTBuilderOptions["emitAt"] = "section",
) {
  const emitted: Array<{ node: LevelNode; context: EmitContext }> = [];

  const builder = new ASTBuilder({
    emitAt,
    onEmit: (node, context) => {
      emitted.push({ node, context });
    },
  });

  const parser = new XMLParser();
  parser.on("openElement", (name, attrs) => builder.onOpenElement(name, attrs));
  parser.on("closeElement", (name) => builder.onCloseElement(name));
  parser.on("text", (text) => builder.onText(text));

  const stream = createReadStream(resolve(FIXTURES_DIR, filename), "utf-8");
  await parser.parseStream(stream);

  return { emitted, builder };
}

describe("ASTBuilder", () => {
  describe("metadata extraction", () => {
    it("extracts document metadata from <meta> block", async () => {
      const { builder } = await parseFileAndCollect("simple-section.xml");
      const meta = builder.getDocumentMeta();

      expect(meta.dcTitle).toBe("Title 1");
      expect(meta.dcType).toBe("USCTitle");
      expect(meta.docNumber).toBe("1");
      expect(meta.positivelaw).toBe(true);
      expect(meta.created).toBe("2025-12-03T10:11:39");
      expect(meta.identifier).toBe("/us/usc/t1");
    });
  });

  describe("section emission", () => {
    it("emits a section node for simple-section.xml", async () => {
      const { emitted } = await parseFileAndCollect("simple-section.xml");

      expect(emitted).toHaveLength(1);
      const { node } = emitted[0]!;

      expect(node.type).toBe("level");
      expect(node.levelType).toBe("section");
      expect(node.identifier).toBe("/us/usc/t1/s2");
      expect(node.numValue).toBe("2");
      expect(node.num).toBe("§ 2.");
      expect(node.heading).toBe('"County" as including "parish", and so forth');
    });

    it("provides correct ancestor context", async () => {
      const { emitted } = await parseFileAndCollect("simple-section.xml");

      const { context } = emitted[0]!;
      expect(context.ancestors).toHaveLength(2);

      expect(context.ancestors[0]!.levelType).toBe("title");
      expect(context.ancestors[0]!.numValue).toBe("1");
      expect(context.ancestors[0]!.heading).toBe("GENERAL PROVISIONS");
      expect(context.ancestors[0]!.identifier).toBe("/us/usc/t1");

      expect(context.ancestors[1]!.levelType).toBe("chapter");
      expect(context.ancestors[1]!.numValue).toBe("1");
      expect(context.ancestors[1]!.heading).toBe("RULES OF CONSTRUCTION");
      expect(context.ancestors[1]!.identifier).toBe("/us/usc/t1/ch1");
    });

    it("emits section with content node containing text", async () => {
      const { emitted } = await parseFileAndCollect("simple-section.xml");
      const section = emitted[0]!.node;

      // Find the content node
      const contentNode = section.children.find((c) => c.type === "content") as
        | ContentNode
        | undefined;
      expect(contentNode).toBeDefined();
      expect(contentNode!.variant).toBe("content");
      expect(contentNode!.children.length).toBeGreaterThan(0);

      // Check that there is text
      const hasText = contentNode!.children.some(
        (c) =>
          c.type === "inline" && c.inlineType === "text" && c.text && c.text.includes("county"),
      );
      expect(hasText).toBe(true);
    });

    it("emits section with sourceCredit", async () => {
      const { emitted } = await parseFileAndCollect("simple-section.xml");
      const section = emitted[0]!.node;

      const sourceCredit = section.children.find((c) => c.type === "sourceCredit") as
        | SourceCreditNode
        | undefined;
      expect(sourceCredit).toBeDefined();
      expect(sourceCredit!.children.length).toBeGreaterThan(0);
    });
  });

  describe("section with subsections", () => {
    it("emits one section with subsection children", async () => {
      const { emitted } = await parseFileAndCollect("section-with-subsections.xml");

      expect(emitted).toHaveLength(1);
      const section = emitted[0]!.node;

      expect(section.levelType).toBe("section");
      expect(section.identifier).toBe("/us/usc/t1/s7");
      expect(section.numValue).toBe("7");
      expect(section.heading).toBe("Marriage");

      // Find subsection children
      const subsections = section.children.filter(
        (c) => c.type === "level" && c.levelType === "subsection",
      ) as LevelNode[];
      expect(subsections).toHaveLength(3);

      expect(subsections[0]!.numValue).toBe("a");
      expect(subsections[1]!.numValue).toBe("b");
      expect(subsections[2]!.numValue).toBe("c");
    });

    it("subsections have content children", async () => {
      const { emitted } = await parseFileAndCollect("section-with-subsections.xml");
      const section = emitted[0]!.node;

      const subsections = section.children.filter(
        (c) => c.type === "level" && c.levelType === "subsection",
      ) as LevelNode[];

      // Each subsection should have at least one content node
      for (const sub of subsections) {
        const content = sub.children.find((c) => c.type === "content") as ContentNode | undefined;
        expect(content).toBeDefined();
        expect(content!.children.length).toBeGreaterThan(0);
      }
    });
  });

  describe("onEmit callback", () => {
    it("calls onEmit for each section in the document", async () => {
      const onEmit = vi.fn();
      const builder = new ASTBuilder({ emitAt: "section", onEmit });

      const parser = new XMLParser();
      parser.on("openElement", (name, attrs) => builder.onOpenElement(name, attrs));
      parser.on("closeElement", (name) => builder.onCloseElement(name));
      parser.on("text", (text) => builder.onText(text));

      const stream = createReadStream(
        resolve(FIXTURES_DIR, "section-with-subsections.xml"),
        "utf-8",
      );
      await parser.parseStream(stream);

      expect(onEmit).toHaveBeenCalledTimes(1);
      expect(onEmit.mock.calls[0]![0].levelType).toBe("section");
    });
  });

  describe("inline XML elements", () => {
    it("handles inline string parsing", () => {
      const xml = `<uscDoc xmlns="http://xml.house.gov/schemas/uslm/1.0" identifier="/us/usc/t1">
        <meta><docNumber>1</docNumber></meta>
        <main>
        <title identifier="/us/usc/t1"><num value="1">Title 1—</num><heading>TEST</heading>
        <chapter identifier="/us/usc/t1/ch1"><num value="1">CH 1—</num><heading>TEST CH</heading>
        <section identifier="/us/usc/t1/s99"><num value="99">§ 99.</num><heading>Test</heading>
        <content><p>See <ref href="/us/usc/t2/s100">section 100 of Title 2</ref> for details.</p></content>
        </section>
        </chapter>
        </title>
        </main>
        </uscDoc>`;

      const { emitted } = parseAndCollect(xml);
      expect(emitted).toHaveLength(1);

      const section = emitted[0]!.node;
      const content = section.children.find((c) => c.type === "content") as ContentNode;
      expect(content).toBeDefined();

      // Should have inline children including a ref
      const refNode = content.children.find(
        (c) => c.type === "inline" && c.inlineType === "ref",
      ) as InlineNode | undefined;
      expect(refNode).toBeDefined();
      expect(refNode!.href).toBe("/us/usc/t2/s100");
    });
  });
});
