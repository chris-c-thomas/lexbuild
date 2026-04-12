import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { TestContext } from "../test-helpers.js";
import { setupTestApp } from "../test-helpers.js";
import { FIXTURE_COUNTS } from "../db/test-fixtures.js";

let ctx: TestContext;

beforeAll(() => {
  ctx = setupTestApp();
});
afterAll(() => {
  ctx.cleanup();
});

describe("GET /api/fr/documents", () => {
  it("returns paginated list of all FR documents", async () => {
    const res = await ctx.app.request("/api/fr/documents");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;

    expect(body.data).toHaveLength(FIXTURE_COUNTS.fr);
    expect(body.pagination.total).toBe(FIXTURE_COUNTS.fr);
    expect(body.pagination.has_more).toBe(false);
  });

  it("sorts by -publication_date by default (newest first)", async () => {
    const res = await ctx.app.request("/api/fr/documents");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;
    const dates = body.data.map((d: { metadata: { publication_date: string } }) => d.metadata.publication_date);
    const sorted = [...dates].sort().reverse();
    expect(dates).toEqual(sorted);
  });

  it("filters by document_type", async () => {
    const res = await ctx.app.request("/api/fr/documents?document_type=rule");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;

    expect(body.data).toHaveLength(1);
    expect(body.data[0].metadata.document_type).toBe("rule");
  });

  it("filters by date_from", async () => {
    const res = await ctx.app.request("/api/fr/documents?date_from=2026-04-01");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;

    expect(body.data).toHaveLength(1);
    expect(body.data[0].identifier).toBe("/us/fr/2026-07001");
  });

  it("filters by date range", async () => {
    const res = await ctx.app.request("/api/fr/documents?date_from=2026-03-15&date_to=2026-03-16");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;

    expect(body.data).toHaveLength(2);
  });

  it("filters by document_type=proposed_rule", async () => {
    const res = await ctx.app.request("/api/fr/documents?document_type=proposed_rule");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;

    expect(body.data).toHaveLength(1);
    expect(body.data[0].metadata.document_number).toBe("2026-06030");
  });

  it("respects limit with has_more", async () => {
    const res = await ctx.app.request("/api/fr/documents?limit=2");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;

    expect(body.data).toHaveLength(2);
    expect(body.pagination.has_more).toBe(true);
    expect(body.pagination.next).toContain("offset=2");
  });

  it("returns empty list for nonexistent document_type filter", async () => {
    // Using a valid enum value that has no matching documents is tricky since the
    // schema validates the enum. We test with a type that has 0 results via date range.
    const res = await ctx.app.request("/api/fr/documents?date_from=2099-01-01");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;
    expect(body.data).toHaveLength(0);
  });
});

describe("GET /api/fr/documents/{identifier}", () => {
  it("returns a single document by document number", async () => {
    const res = await ctx.app.request("/api/fr/documents/2026-06029");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;

    expect(body.data.identifier).toBe("/us/fr/2026-06029");
    expect(body.data.source).toBe("fr");
    expect(body.data.body).toBeDefined();
  });

  it("includes FR-specific metadata fields", async () => {
    const res = await ctx.app.request("/api/fr/documents/2026-06029");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;
    const meta = body.data.metadata;

    expect(meta.document_number).toBe("2026-06029");
    expect(meta.document_type).toBe("rule");
    expect(meta.publication_date).toBe("2026-03-15");
    expect(meta.agency).toBe("Environmental Protection Agency");
    expect(meta.fr_citation).toBe("91 FR 12345");
    expect(meta.fr_volume).toBe(91);
    expect(meta.effective_date).toBe("2026-05-15");
    expect(meta.fr_action).toBe("Final rule");
  });

  it("parses JSON array fields (agencies, cfr_references, docket_ids)", async () => {
    const res = await ctx.app.request("/api/fr/documents/2026-06029");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;
    const meta = body.data.metadata;

    expect(meta.agencies).toEqual(["Environmental Protection Agency"]);
    expect(meta.cfr_references).toEqual(["40 CFR 50", "40 CFR 58"]);
    expect(meta.docket_ids).toEqual(["EPA-HQ-OAR-2024-0001"]);
  });

  it("returns proposed_rule with comments_close_date", async () => {
    const res = await ctx.app.request("/api/fr/documents/2026-06030");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;
    expect(body.data.metadata.document_type).toBe("proposed_rule");
    expect(body.data.metadata.comments_close_date).toBe("2026-06-16");
  });

  it("returns presidential_document", async () => {
    const res = await ctx.app.request("/api/fr/documents/2026-07001");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;
    expect(body.data.metadata.document_type).toBe("presidential_document");
    expect(body.data.metadata.agency).toBe("Executive Office of the President");
  });

  it("resolves URL-encoded full identifier", async () => {
    const encoded = encodeURIComponent("/us/fr/2026-06029");
    const res = await ctx.app.request(`/api/fr/documents/${encoded}`);
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;
    expect(body.data.identifier).toBe("/us/fr/2026-06029");
  });

  it("returns 404 for nonexistent document", async () => {
    const res = await ctx.app.request("/api/fr/documents/9999-99999");
    expect(res.status).toBe(404);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("sets ETag and supports conditional requests", async () => {
    const first = await ctx.app.request("/api/fr/documents/2026-06029");
    const etag = first.headers.get("ETag")!;
    expect(etag).toBeDefined();

    const second = await ctx.app.request("/api/fr/documents/2026-06029", {
      headers: { "If-None-Match": etag },
    });
    expect(second.status).toBe(304);
  });
});
