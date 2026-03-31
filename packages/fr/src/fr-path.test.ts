import { describe, it, expect } from "vitest";
import {
  buildFrOutputPath,
  buildFrDownloadXmlPath,
  buildFrDownloadJsonPath,
  buildMonthDir,
  buildYearDir,
} from "./fr-path.js";

describe("buildFrOutputPath", () => {
  it("builds path with fr/ prefix from output root", () => {
    const result = buildFrOutputPath("2026-06029", "2026-03-28", "./output");
    expect(result).toBe("output/fr/2026/03/2026-06029.md");
  });

  it("handles different dates", () => {
    const result = buildFrOutputPath("2025-00123", "2025-01-15", "/srv/output");
    expect(result).toBe("/srv/output/fr/2025/01/2025-00123.md");
  });

  it("falls back to 0000/00 for empty date", () => {
    const result = buildFrOutputPath("2026-06029", "", "./output");
    expect(result).toBe("output/fr/0000/00/2026-06029.md");
  });

  it("falls back to 0000/00 for malformed date", () => {
    const result = buildFrOutputPath("2026-06029", "baddate", "./output");
    expect(result).toBe("output/fr/baddate/00/2026-06029.md");
  });
});

describe("buildFrDownloadXmlPath", () => {
  it("builds XML download path without fr/ prefix", () => {
    const result = buildFrDownloadXmlPath("2026-06029", "2026-03-28", "./downloads/fr");
    expect(result).toBe("downloads/fr/2026/03/2026-06029.xml");
  });
});

describe("buildFrDownloadJsonPath", () => {
  it("builds JSON download path without fr/ prefix", () => {
    const result = buildFrDownloadJsonPath("2026-06029", "2026-03-28", "./downloads/fr");
    expect(result).toBe("downloads/fr/2026/03/2026-06029.json");
  });
});

describe("buildMonthDir", () => {
  it("builds month directory path with fr/ prefix", () => {
    const result = buildMonthDir("2026", "03", "./output");
    expect(result).toBe("output/fr/2026/03");
  });
});

describe("buildYearDir", () => {
  it("builds year directory path with fr/ prefix", () => {
    const result = buildYearDir("2026", "./output");
    expect(result).toBe("output/fr/2026");
  });
});
