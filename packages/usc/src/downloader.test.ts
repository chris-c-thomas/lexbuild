import { describe, it, expect } from "vitest";
import {
  buildDownloadUrl,
  buildAllTitlesUrl,
  releasePointToPath,
  CURRENT_RELEASE_POINT,
  USC_TITLE_NUMBERS,
} from "./downloader.js";

describe("releasePointToPath", () => {
  it("converts simple release point", () => {
    expect(releasePointToPath("119-43")).toBe("119/43");
  });

  it("converts release point with exclusion suffix", () => {
    expect(releasePointToPath("119-73not60")).toBe("119/73not60");
  });

  it("handles release point without hyphen", () => {
    expect(releasePointToPath("latest")).toBe("latest");
  });
});

describe("buildDownloadUrl", () => {
  it("builds URL for Title 1 with current release point", () => {
    const url = buildDownloadUrl(1, CURRENT_RELEASE_POINT);
    expect(url).toBe(
      `https://uscode.house.gov/download/releasepoints/us/pl/119/73not60/xml_usc01@119-73not60.zip`,
    );
  });

  it("builds URL for Title 26 with current release point", () => {
    const url = buildDownloadUrl(26, CURRENT_RELEASE_POINT);
    expect(url).toBe(
      `https://uscode.house.gov/download/releasepoints/us/pl/119/73not60/xml_usc26@119-73not60.zip`,
    );
  });

  it("zero-pads single-digit title numbers", () => {
    const url = buildDownloadUrl(5, "119-43");
    expect(url).toContain("xml_usc05@119-43.zip");
  });

  it("does not pad double-digit title numbers", () => {
    const url = buildDownloadUrl(42, "119-43");
    expect(url).toContain("xml_usc42@119-43.zip");
  });

  it("uses custom release point", () => {
    const url = buildDownloadUrl(1, "118-200");
    expect(url).toBe(
      "https://uscode.house.gov/download/releasepoints/us/pl/118/200/xml_usc01@118-200.zip",
    );
  });
});

describe("buildAllTitlesUrl", () => {
  it("builds URL for all titles zip", () => {
    const url = buildAllTitlesUrl(CURRENT_RELEASE_POINT);
    expect(url).toBe(
      `https://uscode.house.gov/download/releasepoints/us/pl/119/73not60/xml_uscAll@119-73not60.zip`,
    );
  });
});

describe("constants", () => {
  it("has 54 USC title numbers", () => {
    expect(USC_TITLE_NUMBERS).toHaveLength(54);
    expect(USC_TITLE_NUMBERS[0]).toBe(1);
    expect(USC_TITLE_NUMBERS[53]).toBe(54);
  });

  it("has a non-empty release point", () => {
    expect(CURRENT_RELEASE_POINT).toBeTruthy();
    expect(CURRENT_RELEASE_POINT).toContain("-");
  });
});
