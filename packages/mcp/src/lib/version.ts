/**
 * Package version, injected at build time by tsup via `define`.
 * Avoids runtime filesystem reads that break when bundled output
 * moves relative to package.json.
 */
declare const __PKG_VERSION__: string | undefined;

/** The current package version, injected at build time. */
export const VERSION: string = typeof __PKG_VERSION__ !== "undefined" ? __PKG_VERSION__ : "0.0.0-dev";
