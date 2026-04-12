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

describe("GET /api/usc/documents", () => {
  it("returns paginated list of all USC documents", async () => {
    const res = await ctx.app.request("/api/usc/documents");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;

    expect(body.data).toHaveLength(FIXTURE_COUNTS.usc);
    expect(body.pagination.total).toBe(FIXTURE_COUNTS.usc);
    expect(body.pagination.has_more).toBe(false);
  });

  it("filters by title_number", async () => {
    const res = await ctx.app.request("/api/usc/documents?title_number=1");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;

    expect(body.data).toHaveLength(3);
    expect(body.pagination.total).toBe(3);
    for (const doc of body.data) {
      expect(doc.metadata.title_number).toBe(1);
    }
  });

  it("respects limit parameter", async () => {
    const res = await ctx.app.request("/api/usc/documents?limit=2");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;

    expect(body.data).toHaveLength(2);
    expect(body.pagination.limit).toBe(2);
    expect(body.pagination.has_more).toBe(true);
    expect(body.pagination.next).toContain("offset=2");
  });

  it("respects offset parameter", async () => {
    const res = await ctx.app.request("/api/usc/documents?limit=2&offset=2");
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;

    expect(body.data).toHaveLength(2);
    expect(body.pagination.offset).toBe(2);
  });

  it("uses cursor pagination without returning total counts", async () => {
    const firstPage = await ctx.app.request("/api/usc/documents?limit=2");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const firstBody = (await firstPage.json()) as any;
    const cursor = firstBody.data[1].identifier as string;

    const res = await ctx.app.request(`/api/usc/documents?limit=1&cursor=${encodeURIComponent(cursor)}`);
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;

    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBeNull();
    expect(body.pagination.offset).toBe(0);
    expect(body.pagination.next).toContain("cursor=");
    expect(body.pagination.next).not.toContain("offset=");
  });

  it("returns documents sorted by identifier by default", async () => {
    const res = await ctx.app.request("/api/usc/documents");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;
    const identifiers = body.data.map((d: { identifier: string }) => d.identifier);
    const sorted = [...identifiers].sort();
    expect(identifiers).toEqual(sorted);
  });

  it("returns listing metadata without body content", async () => {
    const res = await ctx.app.request("/api/usc/documents");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;
    for (const doc of body.data) {
      expect(doc.id).toBeDefined();
      expect(doc.identifier).toBeDefined();
      expect(doc.source).toBe("usc");
      expect(doc.metadata.display_title).toBeDefined();
      expect(doc.body).toBeUndefined();
    }
  });

  it("includes meta with api_version and format_version", async () => {
    const res = await ctx.app.request("/api/usc/documents");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;
    expect(body.meta.api_version).toBe("v1");
    expect(body.meta.format_version).toBeDefined();
    expect(body.meta.timestamp).toBeDefined();
  });
});

describe("GET /api/usc/documents/{identifier}", () => {
  // Hono {identifier} param matches a single path segment, so shorthand identifiers
  // containing "/" (e.g., t1/s1) must be URL-encoded when passed in the URL path.
  const t1s1 = encodeURIComponent("/us/usc/t1/s1");
  const t26s7801 = encodeURIComponent("/us/usc/t26/s7801");

  it("returns a single document by URL-encoded identifier", async () => {
    const res = await ctx.app.request(`/api/usc/documents/${t1s1}`);
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;

    expect(body.data.identifier).toBe("/us/usc/t1/s1");
    expect(body.data.source).toBe("usc");
    expect(body.data.metadata.display_title).toBe("1 U.S.C. 1 - Words denoting number, gender, and so forth");
    expect(body.data.body).toBeDefined();
    expect(body.data.body).toContain("# 1 U.S.C. 1");
  });

  it("returns a different document by identifier", async () => {
    const res = await ctx.app.request(`/api/usc/documents/${t26s7801}`);
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;
    expect(body.data.identifier).toBe("/us/usc/t26/s7801");
    expect(body.data.metadata.display_title).toContain("7801");
  });

  it("returns 404 for nonexistent document", async () => {
    const encoded = encodeURIComponent("/us/usc/t99/s999");
    const res = await ctx.app.request(`/api/usc/documents/${encoded}`);
    expect(res.status).toBe(404);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("DOCUMENT_NOT_FOUND");
    expect(body.error.status).toBe(404);
  });

  it("sets ETag header on response", async () => {
    const res = await ctx.app.request(`/api/usc/documents/${t1s1}`);
    expect(res.status).toBe(200);
    const etag = res.headers.get("ETag");
    expect(etag).toBeDefined();
    expect(etag).toMatch(/^".+"$/);
  });

  it("returns 304 when If-None-Match matches ETag", async () => {
    const first = await ctx.app.request(`/api/usc/documents/${t1s1}`);
    const etag = first.headers.get("ETag")!;

    const second = await ctx.app.request(`/api/usc/documents/${t1s1}`, {
      headers: { "If-None-Match": etag },
    });
    expect(second.status).toBe(304);
  });

  it("returns markdown with ?format=markdown", async () => {
    const res = await ctx.app.request(`/api/usc/documents/${t1s1}?format=markdown`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/markdown");
    const text = await res.text();
    expect(text).toContain("---");
    expect(text).toContain("# 1 U.S.C. 1");
  });

  it("returns plain text with ?format=text", async () => {
    const res = await ctx.app.request(`/api/usc/documents/${t1s1}?format=text`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
  });

  it("returns metadata only with ?fields=metadata", async () => {
    const res = await ctx.app.request(`/api/usc/documents/${t1s1}?fields=metadata`);
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;
    expect(body.data.metadata.identifier).toBe("/us/usc/t1/s1");
    expect(body.data.body).toBeUndefined();
  });

  it("includes USC-specific source_credit in metadata", async () => {
    const res = await ctx.app.request(`/api/usc/documents/${t1s1}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;
    expect(body.data.metadata.source_credit).toBeDefined();
    expect(body.data.metadata.source_credit).toContain("1947");
  });

  it("includes meta with api_version and format_version", async () => {
    const res = await ctx.app.request(`/api/usc/documents/${t1s1}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertion
    const body = (await res.json()) as any;
    expect(body.meta.api_version).toBe("v1");
    expect(body.meta.format_version).toBeDefined();
  });
});
