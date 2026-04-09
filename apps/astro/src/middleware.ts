import { defineMiddleware } from "astro:middleware";

/**
 * Ensures HTML responses include `charset=utf-8` in the Content-Type header.
 *
 * Without this, the Astro Node adapter may send `Content-Type: text/html`
 * (no charset), causing crawlers like Bing to interpret UTF-8 bytes as
 * Latin-1 — mangling characters like § (becomes Â§) and — (becomes â&#128;&#148;)
 * in OpenGraph meta tags and other SEO-visible content.
 */
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("text/html") && !contentType.includes("charset")) {
    response.headers.set("content-type", "text/html; charset=utf-8");
  }

  return response;
});
