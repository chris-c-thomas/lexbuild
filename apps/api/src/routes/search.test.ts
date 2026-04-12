import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { TestContext } from "../test-helpers.js";
import { setupTestApp } from "../test-helpers.js";
import { buildErrorResponse } from "../middleware/error-handler.js";
import {
  buildMeiliFilter,
  buildMeiliSort,
  buildSearchOptions,
  buildSearchPlans,
  executeSearchWithFallback,
  isMeiliTimeoutError,
  parseFacets,
  registerSearchRoutes,
  type SearchExecutor,
} from "./search.js";

let ctx: TestContext;

beforeAll(() => {
  ctx = setupTestApp();
});
afterAll(() => {
  ctx.cleanup();
});

function createSearchRouteApp(searchExecutor: SearchExecutor): OpenAPIHono {
  const app = new OpenAPIHono();
  app.onError((err, c) => buildErrorResponse(c, err, undefined));
  registerSearchRoutes(app, "http://127.0.0.1:7700", "", searchExecutor);
  return app;
}

describe("GET /api/search", () => {
  it("returns 503 when Meilisearch is unavailable", async () => {
    const res = await ctx.app.request("/api/search?q=test");
    expect(res.status).toBe(503);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;
    expect(body.error.status).toBe(503);
    expect(body.error.message).toContain("Search service is temporarily unavailable");
  });

  it("returns 200 after retrying without body snippets", async () => {
    const searchExecutor = vi
      .fn<SearchExecutor>()
      .mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"))
      .mockResolvedValueOnce({
        hits: [
          {
            id: "usc-1",
            source: "usc",
            identifier: "/us/usc/t42/s7401",
            heading: "Congressional findings",
            title_number: 42,
            title_name: "The Public Health and Welfare",
            status: "current",
            hierarchy: ["Title 42"],
            url: "/usc/title-42/s7401",
            _formatted: {
              heading: "<mark>Congressional</mark> findings",
              identifier: "/us/usc/t42/s7401",
            },
          },
        ],
        query: "environmental protection",
        processingTimeMs: 18,
        estimatedTotalHits: 1,
        facetDistribution: { source: { usc: 1 }, status: { current: 1 } },
      });

    const app = createSearchRouteApp(searchExecutor);
    const res = await app.request("/search?q=environmental%20protection");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;

    expect(body.data.hits).toHaveLength(1);
    expect(body.data.hits[0].highlights.heading).toContain("<mark>");
    expect(body.data.hits[0].highlights.body).toBeUndefined();
    expect(searchExecutor).toHaveBeenCalledTimes(2);
    expect(searchExecutor.mock.calls[0]![1].attributesToRetrieve).toContain("body");
    expect(searchExecutor.mock.calls[1]![1].attributesToRetrieve).not.toContain("body");
  });

  it("drops facets after repeated timeout retries", async () => {
    const searchExecutor = vi
      .fn<SearchExecutor>()
      .mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"))
      .mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"))
      .mockResolvedValueOnce({
        hits: [],
        query: "environmental protection",
        processingTimeMs: 11,
        estimatedTotalHits: 0,
      });

    const app = createSearchRouteApp(searchExecutor);
    const res = await app.request("/search?q=environmental%20protection&facets=source,status");
    expect(res.status).toBe(200);
    expect(searchExecutor).toHaveBeenCalledTimes(3);
    expect(searchExecutor.mock.calls[2]![1].facets).toBeUndefined();
  });

  it("returns 504 when all fallback attempts time out", async () => {
    const searchExecutor = vi.fn<SearchExecutor>().mockRejectedValue(new DOMException("timed out", "TimeoutError"));

    const app = createSearchRouteApp(searchExecutor);
    const res = await app.request("/search?q=environmental%20protection");
    expect(res.status).toBe(504);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;

    expect(body.error.message).toContain("timed out");
  });
});

describe("buildMeiliFilter", () => {
  it("returns undefined when no filter params are set", () => {
    expect(buildMeiliFilter({ q: "test", limit: 20, offset: 0, highlight: true })).toBeUndefined();
  });

  it("builds source filter", () => {
    const filter = buildMeiliFilter({
      q: "test",
      source: "usc",
      limit: 20,
      offset: 0,
      highlight: true,
    });
    expect(filter).toBe('source = "usc"');
  });

  it("builds title_number filter", () => {
    const filter = buildMeiliFilter({
      q: "test",
      title_number: 17,
      limit: 20,
      offset: 0,
      highlight: true,
    });
    expect(filter).toBe("title_number = 17");
  });

  it("builds document_type filter", () => {
    const filter = buildMeiliFilter({
      q: "test",
      document_type: "rule",
      limit: 20,
      offset: 0,
      highlight: true,
    });
    expect(filter).toBe('document_type = "rule"');
  });

  it("builds agency filter with sanitization", () => {
    const filter = buildMeiliFilter({
      q: "test",
      agency: 'EPA "injection',
      limit: 20,
      offset: 0,
      highlight: true,
    });
    expect(filter).toBe('agency = "EPA injection"');
  });

  it("builds date range filters", () => {
    const filter = buildMeiliFilter({
      q: "test",
      date_from: "2026-01-01",
      date_to: "2026-12-31",
      limit: 20,
      offset: 0,
      highlight: true,
    });
    expect(filter).toBe('publication_date >= "2026-01-01" AND publication_date <= "2026-12-31"');
  });

  it("combines multiple filters with AND", () => {
    const filter = buildMeiliFilter({
      q: "test",
      source: "fr",
      document_type: "rule",
      limit: 20,
      offset: 0,
      highlight: true,
    });
    expect(filter).toContain('source = "fr"');
    expect(filter).toContain('document_type = "rule"');
    expect(filter).toContain(" AND ");
  });

  it("builds status filter with sanitization", () => {
    const filter = buildMeiliFilter({
      q: "test",
      status: 'in_force"\\malicious',
      limit: 20,
      offset: 0,
      highlight: true,
    });
    expect(filter).toBe('status = "in_forcemalicious"');
  });
});

describe("buildMeiliSort", () => {
  it("returns undefined for undefined sort", () => {
    expect(buildMeiliSort(undefined)).toBeUndefined();
  });

  it("returns undefined for relevance sort", () => {
    expect(buildMeiliSort("relevance")).toBeUndefined();
  });

  it("builds ascending sort", () => {
    expect(buildMeiliSort("publication_date")).toEqual(["publication_date:asc"]);
  });

  it("builds descending sort with - prefix", () => {
    expect(buildMeiliSort("-publication_date")).toEqual(["publication_date:desc"]);
  });

  it("returns undefined for disallowed sort field", () => {
    expect(buildMeiliSort("some_random_field")).toBeUndefined();
  });

  it("handles all allowed sort fields", () => {
    expect(buildMeiliSort("title_number")).toEqual(["title_number:asc"]);
    expect(buildMeiliSort("identifier")).toEqual(["identifier:asc"]);
    expect(buildMeiliSort("-document_number")).toEqual(["document_number:desc"]);
  });
});

describe("parseFacets", () => {
  it("returns default facets when param is undefined", () => {
    expect(parseFacets(undefined)).toEqual(["source", "status"]);
  });

  it("parses comma-separated facet names", () => {
    const facets = parseFacets("source,document_type,agency");
    expect(facets).toEqual(["source", "document_type", "agency"]);
  });

  it("filters out disallowed facet names", () => {
    const facets = parseFacets("source,invalid_facet,title_number");
    expect(facets).toEqual(["source", "title_number"]);
    expect(facets).not.toContain("invalid_facet");
  });

  it("handles whitespace in facet params", () => {
    const facets = parseFacets("source , document_type , agency");
    expect(facets).toEqual(["source", "document_type", "agency"]);
  });

  it("returns empty array when all facets are invalid", () => {
    const facets = parseFacets("invalid1,invalid2");
    expect(facets).toEqual([]);
  });
});

describe("isMeiliTimeoutError", () => {
  it("detects direct DOMException timeouts", () => {
    expect(isMeiliTimeoutError(new DOMException("timed out", "TimeoutError"))).toBe(true);
  });

  it("detects wrapped DOMException timeouts", () => {
    const err = new Error("request failed", {
      cause: new DOMException("timed out", "TimeoutError"),
    });
    expect(isMeiliTimeoutError(err)).toBe(true);
  });

  it("ignores non-timeout errors", () => {
    expect(isMeiliTimeoutError(new Error("boom"))).toBe(false);
  });
});

describe("buildSearchPlans", () => {
  it("builds progressively leaner plans for highlighted faceted searches", () => {
    const plans = buildSearchPlans({ q: "test", limit: 20, offset: 0, highlight: true }, ["source", "status"]);

    expect(plans).toEqual([
      { includeBodySnippets: true, includeFacets: true, timeoutMs: 5000 },
      { includeBodySnippets: false, includeFacets: true, timeoutMs: 5000 },
      { includeBodySnippets: false, includeFacets: false, timeoutMs: 5000 },
    ]);
  });

  it("keeps a single plan for already-lean searches", () => {
    const plans = buildSearchPlans({ q: "test", limit: 20, offset: 0, highlight: false }, []);

    expect(plans).toHaveLength(1);
    expect(plans[0]).toEqual({ includeBodySnippets: false, includeFacets: false, timeoutMs: 5000 });
  });
});

describe("buildSearchOptions", () => {
  it("includes body retrieval for rich highlighted searches", () => {
    const options = buildSearchOptions(
      { q: "test", limit: 20, offset: 0, highlight: true },
      undefined,
      undefined,
      ["source", "status"],
      { includeBodySnippets: true, includeFacets: true, timeoutMs: 5000 },
    );

    expect(options.attributesToRetrieve).toContain("body");
    expect(options.attributesToHighlight).toEqual(["heading", "identifier", "body"]);
    expect(options.attributesToCrop).toEqual(["body"]);
    expect(options.facets).toEqual(["source", "status"]);
  });

  it("drops body retrieval and facets for lean fallback searches", () => {
    const options = buildSearchOptions(
      { q: "test", limit: 20, offset: 0, highlight: true },
      undefined,
      undefined,
      ["source", "status"],
      { includeBodySnippets: false, includeFacets: false, timeoutMs: 5000 },
    );

    expect(options.attributesToRetrieve).not.toContain("body");
    expect(options.attributesToHighlight).toEqual(["heading", "identifier"]);
    expect(options.attributesToCrop).toBeUndefined();
    expect(options.facets).toBeUndefined();
  });
});

describe("executeSearchWithFallback", () => {
  it("retries a timed-out rich search with leaner options", async () => {
    const executor = vi
      .fn(async (_searchOptions: Record<string, unknown>, _timeoutMs: number) =>
        Promise.resolve({
          hits: [],
          query: "test",
          processingTimeMs: 15,
          estimatedTotalHits: 0,
        }),
      )
      .mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"))
      .mockResolvedValueOnce({
        hits: [],
        query: "test",
        processingTimeMs: 15,
        estimatedTotalHits: 0,
      });

    await expect(
      executeSearchWithFallback(executor, { q: "test", limit: 20, offset: 0, highlight: true }, undefined, undefined, [
        "source",
        "status",
      ]),
    ).resolves.toMatchObject({ query: "test", estimatedTotalHits: 0 });

    expect(executor).toHaveBeenCalledTimes(2);
    expect(executor.mock.calls[0]![0].attributesToRetrieve).toContain("body");
    expect(executor.mock.calls[1]![0].attributesToRetrieve).not.toContain("body");
    expect(executor.mock.calls[1]![0].facets).toEqual(["source", "status"]);
  });

  it("drops facets after repeated timeout retries", async () => {
    const executor = vi
      .fn(async (_searchOptions: Record<string, unknown>, _timeoutMs: number) =>
        Promise.resolve({
          hits: [],
          query: "test",
          processingTimeMs: 12,
          estimatedTotalHits: 0,
        }),
      )
      .mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"))
      .mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"))
      .mockResolvedValueOnce({
        hits: [],
        query: "test",
        processingTimeMs: 12,
        estimatedTotalHits: 0,
      });

    await executeSearchWithFallback(
      executor,
      { q: "test", limit: 20, offset: 0, highlight: true },
      undefined,
      undefined,
      ["source", "status"],
    );

    expect(executor).toHaveBeenCalledTimes(3);
    expect(executor.mock.calls[2]![0].facets).toBeUndefined();
  });

  it("does not retry non-timeout errors", async () => {
    const executor = vi.fn().mockRejectedValue(new Error("unavailable"));

    await expect(
      executeSearchWithFallback(executor, { q: "test", limit: 20, offset: 0, highlight: true }, undefined, undefined, [
        "source",
        "status",
      ]),
    ).rejects.toThrow("unavailable");

    expect(executor).toHaveBeenCalledTimes(1);
  });
});
