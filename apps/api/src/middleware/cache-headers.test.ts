import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { cacheHeaders } from "./cache-headers.js";

describe("cacheHeaders", () => {
  it("sets Cache-Control on 200 GET responses", async () => {
    const app = new Hono();
    app.use("*", cacheHeaders({ maxAge: 300 }));
    app.get("/data", (c) => c.json({ ok: true }));

    const res = await app.request("/data");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
  });

  it("includes s-maxage when configured", async () => {
    const app = new Hono();
    app.use("*", cacheHeaders({ maxAge: 60, sMaxAge: 3600 }));
    app.get("/data", (c) => c.json({ ok: true }));

    const res = await app.request("/data");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=3600");
  });

  it("includes stale-while-revalidate when configured", async () => {
    const app = new Hono();
    app.use("*", cacheHeaders({ maxAge: 60, staleWhileRevalidate: 120 }));
    app.get("/data", (c) => c.json({ ok: true }));

    const res = await app.request("/data");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60, stale-while-revalidate=120");
  });

  it("includes all directives when fully configured", async () => {
    const app = new Hono();
    app.use("*", cacheHeaders({ maxAge: 60, sMaxAge: 3600, staleWhileRevalidate: 120 }));
    app.get("/data", (c) => c.json({ ok: true }));

    const res = await app.request("/data");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=3600, stale-while-revalidate=120");
  });

  it("does not set Cache-Control on non-200 responses", async () => {
    const app = new Hono();
    app.use("*", cacheHeaders({ maxAge: 300 }));
    app.get("/not-found", (c) => c.json({ error: "not found" }, 404));

    const res = await app.request("/not-found");
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("does not set Cache-Control on POST requests", async () => {
    const app = new Hono();
    app.use("*", cacheHeaders({ maxAge: 300 }));
    app.post("/data", (c) => c.json({ ok: true }));

    const res = await app.request("/data", { method: "POST" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBeNull();
  });
});
