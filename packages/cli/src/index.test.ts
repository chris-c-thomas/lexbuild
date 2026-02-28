import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const CLI_PATH = resolve(import.meta.dirname, "../dist/index.js");
const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

describe("law2md CLI", () => {
  it("shows help text", () => {
    const output = execFileSync("node", [CLI_PATH, "--help"], {
      encoding: "utf-8",
    });
    expect(output).toContain("law2md");
    expect(output).toContain("convert");
  });

  it("shows version from package.json", () => {
    const output = execFileSync("node", [CLI_PATH, "--version"], {
      encoding: "utf-8",
    });
    expect(output.trim()).toBe(pkg.version);
  });

  it("shows convert command help", () => {
    const output = execFileSync("node", [CLI_PATH, "convert", "--help"], {
      encoding: "utf-8",
    });
    expect(output).toContain("Convert USC XML");
    expect(output).toContain("--output");
    expect(output).toContain("--link-style");
  });
});
