import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { TestContext } from "../test-helpers.js";
import { setupTestApp } from "../test-helpers.js";

let ctx: TestContext;

beforeAll(() => {
  ctx = setupTestApp();
});
afterAll(() => {
  ctx.cleanup();
});

describe("USC hierarchy", () => {
  describe("GET /api/usc/titles", () => {
    it("returns all USC titles", async () => {
      const res = await ctx.app.request("/api/usc/titles");
      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;

      expect(body.data).toHaveLength(2);
      const titleNumbers = body.data.map((t: { title_number: number }) => t.title_number);
      expect(titleNumbers).toContain(1);
      expect(titleNumbers).toContain(26);
    });

    it("includes document_count and chapter_count per title", async () => {
      const res = await ctx.app.request("/api/usc/titles");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;

      const title1 = body.data.find((t: { title_number: number }) => t.title_number === 1);
      expect(title1.document_count).toBe(3);
      expect(title1.chapter_count).toBe(1);
      expect(title1.title_name).toBe("General Provisions");
      expect(title1.positive_law).toBe(true);
      expect(title1.url).toBe("/api/usc/titles/1");

      const title26 = body.data.find((t: { title_number: number }) => t.title_number === 26);
      expect(title26.document_count).toBe(1);
      expect(title26.positive_law).toBe(false);
    });

    it("includes meta with api_version and timestamp", async () => {
      const res = await ctx.app.request("/api/usc/titles");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;
      expect(body.meta.api_version).toBe("v1");
      expect(body.meta.timestamp).toBeDefined();
    });
  });

  describe("GET /api/usc/titles/{number}", () => {
    it("returns title detail with chapters", async () => {
      const res = await ctx.app.request("/api/usc/titles/1");
      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;

      expect(body.data.title_number).toBe(1);
      expect(body.data.title_name).toBe("General Provisions");
      expect(body.data.document_count).toBe(3);
      expect(body.data.positive_law).toBe(true);
      expect(body.data.chapters).toHaveLength(1);
      expect(body.data.chapters[0].chapter_number).toBe("1");
      expect(body.data.chapters[0].chapter_name).toBe("Rules of Construction");
      expect(body.data.chapters[0].document_count).toBe(3);
    });

    it("returns structured JSON 404 for nonexistent title", async () => {
      const res = await ctx.app.request("/api/usc/titles/999");
      expect(res.status).toBe(404);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;
      expect(body.error.status).toBe(404);
      expect(body.error.code).toBe("REQUEST_ERROR");
      expect(body.error.message).toContain("No USC title 999 found");
    });
  });
});

describe("eCFR hierarchy", () => {
  describe("GET /api/ecfr/titles", () => {
    it("returns all eCFR titles", async () => {
      const res = await ctx.app.request("/api/ecfr/titles");
      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;

      expect(body.data).toHaveLength(2);
      const titleNumbers = body.data.map((t: { title_number: number }) => t.title_number);
      expect(titleNumbers).toContain(17);
      expect(titleNumbers).toContain(40);
    });

    it("includes correct counts per eCFR title", async () => {
      const res = await ctx.app.request("/api/ecfr/titles");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;

      const title17 = body.data.find((t: { title_number: number }) => t.title_number === 17);
      expect(title17.document_count).toBe(2);
      expect(title17.title_name).toBe("Commodity and Securities Exchanges");
      expect(title17.url).toBe("/api/ecfr/titles/17");

      const title40 = body.data.find((t: { title_number: number }) => t.title_number === 40);
      expect(title40.document_count).toBe(1);
    });
  });

  describe("GET /api/ecfr/titles/{number}", () => {
    it("returns title detail with chapters", async () => {
      const res = await ctx.app.request("/api/ecfr/titles/17");
      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;

      expect(body.data.title_number).toBe(17);
      expect(body.data.document_count).toBe(2);
      expect(body.data.chapters).toHaveLength(1);
      expect(body.data.chapters[0].chapter_number).toBe("II");
      expect(body.data.chapters[0].chapter_name).toBe("Securities and Exchange Commission");
    });

    it("returns structured JSON 404 for nonexistent eCFR title", async () => {
      const res = await ctx.app.request("/api/ecfr/titles/999");
      expect(res.status).toBe(404);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;
      expect(body.error.status).toBe(404);
      expect(body.error.code).toBe("REQUEST_ERROR");
      expect(body.error.message).toContain("No eCFR title 999 found");
    });
  });
});

describe("FR hierarchy", () => {
  describe("GET /api/fr/years", () => {
    it("returns all FR publication years", async () => {
      const res = await ctx.app.request("/api/fr/years");
      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;

      expect(body.data).toHaveLength(1);
      expect(body.data[0].year).toBe(2026);
      expect(body.data[0].document_count).toBe(4);
      expect(body.data[0].url).toBe("/api/fr/years/2026");
    });

    it("includes meta with api_version", async () => {
      const res = await ctx.app.request("/api/fr/years");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;
      expect(body.meta.api_version).toBe("v1");
    });
  });

  describe("GET /api/fr/years/{year}", () => {
    it("returns year detail with monthly breakdown", async () => {
      const res = await ctx.app.request("/api/fr/years/2026");
      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;

      expect(body.data.year).toBe(2026);
      expect(body.data.document_count).toBe(4);
      expect(body.data.months).toHaveLength(2);

      const march = body.data.months.find((m: { month: number }) => m.month === 3);
      expect(march).toBeDefined();
      expect(march.document_count).toBe(3);
      expect(march.url).toBe("/api/fr/years/2026/03");

      const april = body.data.months.find((m: { month: number }) => m.month === 4);
      expect(april).toBeDefined();
      expect(april.document_count).toBe(1);
    });

    it("returns structured JSON 404 for nonexistent year", async () => {
      const res = await ctx.app.request("/api/fr/years/1900");
      expect(res.status).toBe(404);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;
      expect(body.error.status).toBe(404);
      expect(body.error.code).toBe("REQUEST_ERROR");
    });
  });

  describe("GET /api/fr/years/{year}/{month}", () => {
    it("returns month documents with pagination", async () => {
      const res = await ctx.app.request("/api/fr/years/2026/3");
      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;

      expect(body.data.year).toBe(2026);
      expect(body.data.month).toBe(3);
      expect(body.data.document_count).toBe(3);
      expect(body.data.documents).toHaveLength(3);

      for (const doc of body.data.documents) {
        expect(doc.id).toBeDefined();
        expect(doc.identifier).toBeDefined();
        expect(doc.display_title).toBeDefined();
        expect(doc.publication_date).toContain("2026-03");
      }

      expect(body.pagination.total).toBe(3);
      expect(body.pagination.has_more).toBe(false);
      expect(body.pagination.next).toBeNull();
    });

    it("respects limit parameter with has_more and next URL", async () => {
      const res = await ctx.app.request("/api/fr/years/2026/3?limit=1");
      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;

      expect(body.data.documents).toHaveLength(1);
      expect(body.pagination.total).toBe(3);
      expect(body.pagination.limit).toBe(1);
      expect(body.pagination.has_more).toBe(true);
      expect(body.pagination.next).toContain("/api/fr/years/2026/03");
      expect(body.pagination.next).toContain("offset=1");
      expect(body.pagination.next).toContain("limit=1");
    });

    it("respects offset parameter", async () => {
      const res = await ctx.app.request("/api/fr/years/2026/3?limit=1&offset=1");
      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;

      expect(body.data.documents).toHaveLength(1);
      expect(body.pagination.offset).toBe(1);
      expect(body.pagination.has_more).toBe(true);
    });

    it("returns April documents", async () => {
      const res = await ctx.app.request("/api/fr/years/2026/4");
      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;

      expect(body.data.documents).toHaveLength(1);
      expect(body.data.documents[0].document_type).toBe("presidential_document");
    });

    it("returns empty documents array when offset exceeds total", async () => {
      const res = await ctx.app.request("/api/fr/years/2026/3?offset=100");
      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;
      expect(body.data.documents).toHaveLength(0);
      expect(body.data.document_count).toBe(3);
      expect(body.pagination.total).toBe(3);
      expect(body.pagination.has_more).toBe(false);
      expect(body.pagination.next).toBeNull();
    });

    it("returns structured JSON 404 for month with no documents", async () => {
      const res = await ctx.app.request("/api/fr/years/2026/1");
      expect(res.status).toBe(404);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;
      expect(body.error.status).toBe(404);
      expect(body.error.code).toBe("REQUEST_ERROR");
    });

    it("returns structured JSON 404 for nonexistent year/month", async () => {
      const res = await ctx.app.request("/api/fr/years/1900/1");
      expect(res.status).toBe(404);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
      const body = (await res.json()) as any;
      expect(body.error.status).toBe(404);
      expect(body.error.code).toBe("REQUEST_ERROR");
    });
  });
});
