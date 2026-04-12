import { describe, it, expect } from "vitest";
import { parseLexbuildUri } from "./uri.js";

describe("parseLexbuildUri", () => {
  it("parses USC section URI", () => {
    const result = parseLexbuildUri("lexbuild://us/usc/t5/s552");
    expect(result.apiSource).toBe("usc");
    expect(result.identifier).toBe("/us/usc/t5/s552");
  });

  it("parses CFR section URI", () => {
    const result = parseLexbuildUri("lexbuild://us/cfr/t17/s240.10b-5");
    expect(result.apiSource).toBe("ecfr");
    expect(result.identifier).toBe("/us/cfr/t17/s240.10b-5");
  });

  it("parses FR document URI", () => {
    const result = parseLexbuildUri("lexbuild://us/fr/2026-06029");
    expect(result.apiSource).toBe("fr");
    expect(result.identifier).toBe("2026-06029");
  });

  it("handles USC URIs with deep paths", () => {
    const result = parseLexbuildUri("lexbuild://us/usc/t26/s401");
    expect(result.apiSource).toBe("usc");
    expect(result.identifier).toBe("/us/usc/t26/s401");
  });

  it("handles CFR section with alphanumeric numbers", () => {
    const result = parseLexbuildUri("lexbuild://us/cfr/t40/s50.1");
    expect(result.apiSource).toBe("ecfr");
    expect(result.identifier).toBe("/us/cfr/t40/s50.1");
  });

  it("throws for non-lexbuild URI", () => {
    expect(() => parseLexbuildUri("https://example.com")).toThrow("must start with lexbuild://");
  });

  it("throws for unknown source", () => {
    expect(() => parseLexbuildUri("lexbuild://us/stat/123")).toThrow("Unknown lexbuild URI source");
  });

  it("throws for empty FR document number", () => {
    expect(() => parseLexbuildUri("lexbuild://us/fr/")).toThrow("missing document number");
  });

  it("throws for empty string", () => {
    expect(() => parseLexbuildUri("")).toThrow("must start with lexbuild://");
  });
});
