import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchEcfrTitlesMeta, buildEcfrApiDownloadUrl } from "./ecfr-api-downloader.js";

/** Mock /titles API response matching the real ecfr.gov shape */
const TITLES_API_RESPONSE = {
  titles: [
    {
      number: 1,
      name: "General Provisions",
      latest_amended_on: "2022-12-29",
      latest_issue_date: "2024-05-17",
      up_to_date_as_of: "2026-03-13",
      reserved: false,
    },
    {
      number: 35,
      name: "Panama Canal",
      latest_amended_on: null,
      latest_issue_date: null,
      up_to_date_as_of: "2026-03-13",
      reserved: true,
    },
    {
      number: 17,
      name: "Commodity and Securities Exchanges",
      latest_amended_on: "2026-03-10",
      latest_issue_date: "2026-03-10",
      up_to_date_as_of: "2026-03-13",
      reserved: false,
    },
  ],
  meta: {
    date: "2026-03-13",
    import_in_progress: false,
  },
};

describe("fetchEcfrTitlesMeta", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("maps snake_case API fields to camelCase", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(TITLES_API_RESPONSE), { status: 200 }),
    );

    const result = await fetchEcfrTitlesMeta();

    expect(result.date).toBe("2026-03-13");
    expect(result.importInProgress).toBe(false);
    expect(result.titles).toHaveLength(3);

    const title1 = result.titles[0]!;
    expect(title1.number).toBe(1);
    expect(title1.name).toBe("General Provisions");
    expect(title1.latestAmendedOn).toBe("2022-12-29");
    expect(title1.latestIssueDate).toBe("2024-05-17");
    expect(title1.upToDateAsOf).toBe("2026-03-13");
    expect(title1.reserved).toBe(false);
  });

  it("identifies reserved titles", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(TITLES_API_RESPONSE), { status: 200 }),
    );

    const result = await fetchEcfrTitlesMeta();
    const title35 = result.titles.find((t) => t.number === 35);
    expect(title35).toBeDefined();
    expect(title35!.reserved).toBe(true);
  });

  it("throws on non-200 response", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response("Server Error", { status: 500 }));

    await expect(fetchEcfrTitlesMeta()).rejects.toThrow("HTTP 500");
  });
});

describe("buildEcfrApiDownloadUrl", () => {
  it("builds the correct URL for a title and date", () => {
    const url = buildEcfrApiDownloadUrl(17, "2026-03-13");
    expect(url).toBe("https://www.ecfr.gov/api/versioner/v1/full/2026-03-13/title-17.xml");
  });

  it("builds URL for single-digit title without padding", () => {
    const url = buildEcfrApiDownloadUrl(1, "2025-01-01");
    expect(url).toBe("https://www.ecfr.gov/api/versioner/v1/full/2025-01-01/title-1.xml");
  });
});
