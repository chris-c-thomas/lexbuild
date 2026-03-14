import { describe, it, expect, vi } from "vitest";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { XMLParser } from "./parser.js";
import type { Attributes } from "./parser.js";
import { XHTML_NS, DC_NS, DCTERMS_NS } from "./uslm-elements.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../../../fixtures/fragments");

describe("XMLParser", () => {
  describe("parseString", () => {
    it("emits openElement and closeElement for USLM elements with bare names", () => {
      const opens: Array<{ name: string; attrs: Attributes; ns: string }> = [];
      const closes: Array<{ name: string; ns: string }> = [];

      const parser = new XMLParser();
      parser.on("openElement", (name, attrs, ns) => {
        opens.push({ name, attrs, ns });
      });
      parser.on("closeElement", (name, ns) => {
        closes.push({ name, ns });
      });

      parser.parseString(
        `<section xmlns="http://xml.house.gov/schemas/uslm/1.0" identifier="/us/usc/t1/s1">` +
          `<num value="1">§ 1.</num>` +
          `<heading>Test</heading>` +
          `</section>`,
      );

      expect(opens.map((o) => o.name)).toEqual(["section", "num", "heading"]);
      expect(opens[0]!.attrs["identifier"]).toBe("/us/usc/t1/s1");
      expect(opens[1]!.attrs["value"]).toBe("1");

      expect(closes.map((c) => c.name)).toEqual(["num", "heading", "section"]);
    });

    it("prefixes elements in non-default namespaces", () => {
      const opens: Array<{ name: string; ns: string }> = [];

      const parser = new XMLParser();
      parser.on("openElement", (name, _attrs, ns) => {
        opens.push({ name, ns });
      });

      parser.parseString(
        `<meta xmlns="http://xml.house.gov/schemas/uslm/1.0" ` +
          `xmlns:dc="http://purl.org/dc/elements/1.1/" ` +
          `xmlns:dcterms="http://purl.org/dc/terms/">` +
          `<dc:title>Title 1</dc:title>` +
          `<dc:type>USCTitle</dc:type>` +
          `<docNumber>1</docNumber>` +
          `<dcterms:created>2025-12-03</dcterms:created>` +
          `</meta>`,
      );

      const names = opens.map((o) => o.name);
      expect(names).toContain("meta");
      expect(names).toContain("dc:title");
      expect(names).toContain("dc:type");
      expect(names).toContain("docNumber");
      expect(names).toContain("dcterms:created");

      // Verify namespaces
      const dcTitle = opens.find((o) => o.name === "dc:title");
      expect(dcTitle!.ns).toBe(DC_NS);

      const dctermsCreated = opens.find((o) => o.name === "dcterms:created");
      expect(dctermsCreated!.ns).toBe(DCTERMS_NS);
    });

    it("prefixes XHTML table elements", () => {
      const opens: Array<{ name: string; ns: string }> = [];

      const parser = new XMLParser();
      parser.on("openElement", (name, _attrs, ns) => {
        opens.push({ name, ns });
      });

      parser.parseString(
        `<note xmlns="http://xml.house.gov/schemas/uslm/1.0">` +
          `<table xmlns="http://www.w3.org/1999/xhtml">` +
          `<tr><td>cell</td></tr>` +
          `</table>` +
          `</note>`,
      );

      const names = opens.map((o) => o.name);
      expect(names).toContain("note"); // USLM default ns → bare name
      expect(names).toContain("xhtml:table"); // XHTML ns → prefixed
      expect(names).toContain("xhtml:tr");
      expect(names).toContain("xhtml:td");

      const table = opens.find((o) => o.name === "xhtml:table");
      expect(table!.ns).toBe(XHTML_NS);
    });

    it("emits text events", () => {
      const texts: string[] = [];

      const parser = new XMLParser();
      parser.on("text", (content) => {
        texts.push(content);
      });

      parser.parseString(
        `<heading xmlns="http://xml.house.gov/schemas/uslm/1.0">GENERAL PROVISIONS</heading>`,
      );

      expect(texts).toContain("GENERAL PROVISIONS");
    });

    it("strips xmlns declarations from attributes", () => {
      const opens: Array<{ name: string; attrs: Attributes }> = [];

      const parser = new XMLParser();
      parser.on("openElement", (name, attrs) => {
        opens.push({ name, attrs });
      });

      parser.parseString(
        `<uscDoc xmlns="http://xml.house.gov/schemas/uslm/1.0" ` +
          `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
          `identifier="/us/usc/t1" xml:lang="en">` +
          `</uscDoc>`,
      );

      const doc = opens[0]!;
      expect(doc.attrs["identifier"]).toBe("/us/usc/t1");
      expect(doc.attrs["xml:lang"]).toBe("en");
      // xmlns declarations should be stripped
      expect(doc.attrs["xmlns"]).toBeUndefined();
      expect(doc.attrs["xmlns:xsi"]).toBeUndefined();
    });

    it("emits end event after parsing", () => {
      const endFn = vi.fn();

      const parser = new XMLParser();
      parser.on("end", endFn);

      parser.parseString(`<root xmlns="http://xml.house.gov/schemas/uslm/1.0"/>`);

      expect(endFn).toHaveBeenCalledOnce();
    });
  });

  describe("parseStream", () => {
    it("parses a simple section fixture file", async () => {
      const elements: string[] = [];

      const parser = new XMLParser();
      parser.on("openElement", (name) => {
        elements.push(name);
      });

      const stream = createReadStream(resolve(FIXTURES_DIR, "simple-section.xml"), "utf-8");
      await parser.parseStream(stream);

      // Should contain expected elements from the fixture
      expect(elements).toContain("uscDoc");
      expect(elements).toContain("meta");
      expect(elements).toContain("dc:title");
      expect(elements).toContain("dcterms:created");
      expect(elements).toContain("title");
      expect(elements).toContain("chapter");
      expect(elements).toContain("section");
      expect(elements).toContain("num");
      expect(elements).toContain("heading");
      expect(elements).toContain("content");
      expect(elements).toContain("p");
      expect(elements).toContain("sourceCredit");
    });

    it("extracts identifiers from section fixture", async () => {
      const identifiers: string[] = [];

      const parser = new XMLParser();
      parser.on("openElement", (_name, attrs) => {
        if (attrs["identifier"]) {
          identifiers.push(attrs["identifier"]);
        }
      });

      const stream = createReadStream(resolve(FIXTURES_DIR, "simple-section.xml"), "utf-8");
      await parser.parseStream(stream);

      expect(identifiers).toContain("/us/usc/t1");
      expect(identifiers).toContain("/us/usc/t1/ch1");
      expect(identifiers).toContain("/us/usc/t1/s2");
    });

    it("parses section with subsections", async () => {
      const levels: Array<{ name: string; identifier: string | undefined }> = [];

      const parser = new XMLParser();
      parser.on("openElement", (name, attrs) => {
        if (["section", "subsection"].includes(name)) {
          levels.push({ name, identifier: attrs["identifier"] });
        }
      });

      const stream = createReadStream(resolve(FIXTURES_DIR, "section-with-subsections.xml"), "utf-8");
      await parser.parseStream(stream);

      expect(levels).toEqual([
        { name: "section", identifier: "/us/usc/t1/s7" },
        { name: "subsection", identifier: "/us/usc/t1/s7/a" },
        { name: "subsection", identifier: "/us/usc/t1/s7/b" },
        { name: "subsection", identifier: "/us/usc/t1/s7/c" },
      ]);
    });
  });
});
