import type { APIRoute } from "astro";

/** Health check endpoint for uptime monitoring. */
export const GET: APIRoute = () => {
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
