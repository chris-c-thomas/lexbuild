import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const CLI_PATH = resolve(import.meta.dirname, "../dist/index.js");
const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

describe("lexbuild CLI", () => {
  it("shows help text with all commands", () => {
    const output = execFileSync("node", [CLI_PATH, "--help"], {
      encoding: "utf-8",
    });
    expect(output).toContain("lexbuild");
    expect(output).toContain("convert-usc");
    expect(output).toContain("download-usc");
    expect(output).toContain("convert-ecfr");
    expect(output).toContain("download-ecfr");
  });

  it("shows version from package.json", () => {
    const output = execFileSync("node", [CLI_PATH, "--version"], {
      encoding: "utf-8",
    });
    expect(output.trim()).toBe(pkg.version);
  });

  it("shows convert-usc command help", () => {
    const output = execFileSync("node", [CLI_PATH, "convert-usc", "--help"], {
      encoding: "utf-8",
    });
    expect(output).toContain("Convert U.S. Code XML");
    expect(output).toContain("--output");
    expect(output).toContain("--titles");
    expect(output).toContain("--input-dir");
    expect(output).toContain("--link-style");
  });

  it("shows download-usc command help", () => {
    const output = execFileSync("node", [CLI_PATH, "download-usc", "--help"], {
      encoding: "utf-8",
    });
    expect(output).toContain("Download U.S. Code XML");
    expect(output).toContain("--titles");
    expect(output).toContain("--all");
    expect(output).toContain("--release-point");
  });

  it("shows convert-ecfr command help", () => {
    const output = execFileSync("node", [CLI_PATH, "convert-ecfr", "--help"], {
      encoding: "utf-8",
    });
    expect(output).toContain("Convert eCFR XML");
    expect(output).toContain("--output");
    expect(output).toContain("--titles");
    expect(output).toContain("--granularity");
  });

  it("shows download-ecfr command help", () => {
    const output = execFileSync("node", [CLI_PATH, "download-ecfr", "--help"], {
      encoding: "utf-8",
    });
    expect(output).toContain("Download eCFR XML");
    expect(output).toContain("--titles");
    expect(output).toContain("--all");
  });

  it("bare download command shows source selection message", () => {
    try {
      execFileSync("node", [CLI_PATH, "download"], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      // Should not reach here — command should exit with error
      expect.unreachable("Expected process to exit with error");
    } catch (err) {
      const stderr = (err as { stderr: string }).stderr;
      expect(stderr).toContain("download-usc");
      expect(stderr).toContain("download-ecfr");
    }
  });

  it("bare convert command shows source selection message", () => {
    try {
      execFileSync("node", [CLI_PATH, "convert"], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      expect.unreachable("Expected process to exit with error");
    } catch (err) {
      const stderr = (err as { stderr: string }).stderr;
      expect(stderr).toContain("convert-usc");
      expect(stderr).toContain("convert-ecfr");
    }
  });
});
