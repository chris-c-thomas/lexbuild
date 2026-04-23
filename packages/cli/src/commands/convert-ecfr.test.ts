import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { parseEcfrGranularityList } from "./convert-ecfr.js";

describe("parseEcfrGranularityList", () => {
  /** Build a ConvertEcfrCommandOptions with just the fields parseEcfrGranularityList reads. */
  const opts = (over: {
    granularities?: string;
    output?: string;
    outputSection?: string;
    outputPart?: string;
    outputChapter?: string;
    outputTitle?: string;
  }) =>
    ({
      output: over.output ?? "./output",
      all: false,
      inputDir: "./in",
      granularity: "section" as const,
      linkStyle: "plaintext" as const,
      includeSourceCredits: true,
      includeNotes: true,
      includeEditorialNotes: false,
      includeStatutoryNotes: false,
      includeAmendments: false,
      dryRun: false,
      verbose: false,
      ...over,
    }) as Parameters<typeof parseEcfrGranularityList>[0];

  it("returns empty array when --granularities is not set", () => {
    expect(parseEcfrGranularityList(opts({}))).toEqual([]);
  });

  it("parses all four eCFR granularities with matching --output-<g> flags", () => {
    const result = parseEcfrGranularityList(
      opts({
        granularities: "section,part,chapter,title",
        output: "./out",
        outputPart: "./out-p",
        outputChapter: "./out-c",
        outputTitle: "./out-t",
      }),
    );
    expect(result).toEqual([
      { granularity: "section", output: resolve("./out") },
      { granularity: "part", output: resolve("./out-p") },
      { granularity: "chapter", output: resolve("./out-c") },
      { granularity: "title", output: resolve("./out-t") },
    ]);
  });

  it("prefers --output-section over --output when both are set", () => {
    const result = parseEcfrGranularityList(
      opts({ granularities: "section", output: "./out", outputSection: "./out-s" }),
    );
    expect(result).toEqual([{ granularity: "section", output: resolve("./out-s") }]);
  });

  it("throws on unknown granularity name", () => {
    expect(() => parseEcfrGranularityList(opts({ granularities: "foo" }))).toThrow(/Unknown granularity "foo"/);
  });

  it("throws on duplicate granularity in the list", () => {
    expect(() =>
      parseEcfrGranularityList(opts({ granularities: "part,part", output: "./out", outputPart: "./out-p" })),
    ).toThrow(/Duplicate granularity "part"/);
  });

  it("throws when --output-part is missing for part granularity", () => {
    expect(() => parseEcfrGranularityList(opts({ granularities: "part", output: "./out" }))).toThrow(
      /Missing --output-part/,
    );
  });

  it("throws when --output-chapter is missing for chapter granularity", () => {
    expect(() => parseEcfrGranularityList(opts({ granularities: "chapter", output: "./out" }))).toThrow(
      /Missing --output-chapter/,
    );
  });

  it("throws when --output-title is missing for title granularity", () => {
    expect(() => parseEcfrGranularityList(opts({ granularities: "title", output: "./out" }))).toThrow(
      /Missing --output-title/,
    );
  });
});
