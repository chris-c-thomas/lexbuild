/**
 * Custom Scalar API reference theme matching LexBuild's brand identity.
 *
 * Color values are derived from `apps/astro/src/styles/global.css` (the
 * authoritative palette). Uses `theme: "none"` in the Scalar config so
 * these variables have full control without fighting a built-in theme.
 *
 * Omits font `@import` since the Astro app loads IBM Plex via `@fontsource`
 * packages.
 */
export const SCALAR_THEME_CSS = /* css */ `
/* ---- Light mode ---- */
.light-mode {
  --scalar-font: "IBM Plex Sans", system-ui, sans-serif;
  --scalar-font-code: "IBM Plex Mono", ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace;

  /* Text hierarchy */
  --scalar-color-1: #1f2c38;                   /* slate-blue-950 — foreground */
  --scalar-color-2: #3f5869;                   /* slate-blue-800 — secondary */
  --scalar-color-3: #6c9fb7;                   /* slate-blue-500 — muted */
  --scalar-color-accent: #476c85;              /* slate-blue-700 — primary brand */
  --scalar-color-disabled: #94b7c7;            /* slate-blue-400 */
  --scalar-color-ghost: #d3e3e9;               /* slate-blue-200 */

  /* Backgrounds */
  --scalar-background-1: #ffffff;
  --scalar-background-2: #f5f9fa;              /* slate-blue-50 — surface */
  --scalar-background-3: #e7f0f3;              /* slate-blue-100 */
  --scalar-background-accent: rgba(71, 108, 133, 0.08);

  /* Borders */
  --scalar-border-color: #d3e3e9;              /* slate-blue-200 */

  /* Semantic colors */
  --scalar-color-green: #487061;               /* summer-green-700 */
  --scalar-color-blue: #5285a3;                /* slate-blue-600 */

  /* Sidebar */
  --scalar-sidebar-background-1: #f5f9fa;      /* slate-blue-50 */
  --scalar-sidebar-item-hover-color: #476c85;  /* slate-blue-700 */
  --scalar-sidebar-color-active: #476c85;

  /* Buttons */
  --scalar-button-1: #476c85;
  --scalar-button-1-color: #ffffff;
  --scalar-button-1-hover: #3f5869;            /* slate-blue-800 */

  /* Radius — tighter to match Astro's rounded-sm */
  --scalar-radius: 3px;
  --scalar-radius-lg: 5px;
  --scalar-radius-xl: 7px;
}

/* ---- Dark mode ---- */
.dark-mode {
  --scalar-font: "IBM Plex Sans", system-ui, sans-serif;
  --scalar-font-code: "IBM Plex Mono", ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace;

  /* Text hierarchy */
  --scalar-color-1: #dce8f0;                   /* dark foreground */
  --scalar-color-2: #94b7c7;                   /* slate-blue-400 */
  --scalar-color-3: #7a98ab;                   /* dark muted-foreground */
  --scalar-color-accent: #94b7c7;              /* slate-blue-400 — dark primary */
  --scalar-color-disabled: #3f5869;            /* slate-blue-800 */
  --scalar-color-ghost: #243a4e;               /* dark border */

  /* Backgrounds */
  --scalar-background-1: #0e1821;              /* dark background */
  --scalar-background-2: #132230;              /* dark surface */
  --scalar-background-3: #1c2d3c;              /* dark muted */
  --scalar-background-accent: rgba(148, 183, 199, 0.1);

  /* Borders */
  --scalar-border-color: #243a4e;              /* dark border */

  /* Semantic colors */
  --scalar-color-green: #98b8ab;               /* summer-green-400 */
  --scalar-color-blue: #94b7c7;                /* slate-blue-400 */

  /* Sidebar */
  --scalar-sidebar-background-1: #0b1219;      /* deeper than bg */
  --scalar-sidebar-color-active: #94b7c7;

  /* Buttons */
  --scalar-button-1: #94b7c7;
  --scalar-button-1-color: #0e1821;
  --scalar-button-1-hover: #b4cfda;            /* slate-blue-300 */

  /* Radius */
  --scalar-radius: 3px;
  --scalar-radius-lg: 5px;
  --scalar-radius-xl: 7px;
}

/* ---- Embedded layout overrides ---- */
/* Scalar defaults to a fixed full-viewport container. Override to flow within the page. */
.scalar-container {
  position: static !important;
  overflow: visible !important;
  height: auto !important;
  width: auto !important;
}

.scalar-app-exit {
  display: none !important;
}

/* Make Scalar's sidebar sticky below the site header */
.t-doc__sidebar {
  position: sticky !important;
  top: 3.5rem !important;
  height: calc(100vh - 3.5rem) !important;
  overflow-y: auto !important;
}

/* Hide Scalar's sidebar footer (dark mode toggle, MCP links, branding).
   The site navbar ThemeToggle is the single dark mode control. */
.darklight-reference {
  display: none !important;
}
`;
