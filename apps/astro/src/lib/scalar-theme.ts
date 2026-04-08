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

/* When the API client (Test Request) is open, restore fixed positioning.
   The container background serves as the dark backdrop overlay behind the card. */
.scalar-container:has(.scalar-client) {
  position: fixed !important;
  overflow: hidden !important;
  height: 100dvh !important;
  width: 100dvw !important;
  top: 0 !important;
  left: 0 !important;
  z-index: 100 !important;
  background: rgba(0, 0, 0, 0.45) !important;
}

/* Card-like modal: inset from viewport edges with rounded corners and shadow.
   translateZ(0) establishes a containing block so the fixed-position X button
   is positioned relative to the card, not the viewport. */
.scalar-container:has(.scalar-client) > .scalar-client {
  position: absolute !important;
  inset: 2.5rem !important;
  width: auto !important;
  height: auto !important;
  border-radius: 12px !important;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
  overflow: hidden !important;
  transform: translateZ(0) !important;
  z-index: 1 !important;
}

/* Scalar's click-outside-to-close backdrop — hidden unconditionally.
   The container background handles the overlay tint instead. */
.scalar-app-exit {
  display: none !important;
}

/* X close button: solid subtle background for contrast against the card. */
.app-exit-button {
  background: var(--scalar-background-2, #f5f9fa) !important;
  color: var(--scalar-color-1, #1f2c38) !important;
  border: 1px solid var(--scalar-border-color, #d3e3e9) !important;
}
.app-exit-button:hover {
  background: var(--scalar-background-3, #e7f0f3) !important;
}
.dark-mode .app-exit-button {
  background: var(--scalar-background-2, #132230) !important;
  color: var(--scalar-color-1, #dce8f0) !important;
  border: 1px solid var(--scalar-border-color, #243a4e) !important;
}
.dark-mode .app-exit-button:hover {
  background: var(--scalar-background-3, #1c2d3c) !important;
}

/* ---- Sidebar styling (match docs/sources sidebars) ---- */
.t-doc__sidebar {
  position: sticky !important;
  top: 3.5rem !important;
  height: calc(100vh - 3.5rem) !important;
  overflow-y: auto !important;
  padding: 0.75rem !important;
  --scalar-sidebar-indent: 12px !important;

  /* Override Scalar sidebar tokens to match docs sidebar */
  --sidebar-c-1: var(--scalar-color-1) !important;
  --sidebar-c-2: var(--scalar-color-2) !important;
  --sidebar-b-hover: var(--scalar-background-3) !important;
  --sidebar-active-c: var(--scalar-color-1) !important;
  --scalar-sidebar-font-weight: 400 !important;
}

/* Group headers + top-level standalone items (Introduction): semibold, dark */
.t-doc__sidebar .group\\/group-button > button,
.t-doc__sidebar > ul > .group\\/item > button {
  font-weight: 600 !important;
  font-size: 0.875rem !important;
  color: var(--scalar-color-1) !important;
  padding: 0.375rem 0.5rem !important;
  border-radius: 6px !important;
}

/* All sidebar buttons: rounded with visible hover */
.t-doc__sidebar button {
  border-radius: 6px !important;
}
.t-doc__sidebar .group\\/item > button:hover,
.t-doc__sidebar .group\\/group-button > button:hover {
  background: var(--scalar-background-3) !important;
}

/* Active/selected item: prominent background highlight */
.t-doc__sidebar .group\\/item > button[aria-selected="true"],
.t-doc__sidebar .group\\/item > button.active {
  background: var(--scalar-background-3) !important;
  color: var(--scalar-color-1) !important;
  font-weight: 500 !important;
}

/* Endpoint items: match docs text size */
.t-doc__sidebar .group\\/items .group\\/item > button {
  font-size: 0.875rem !important;
  padding: 0.25rem 0.5rem !important;
}

/* GET badges: visible but compact, force IBM Plex Mono */
.t-doc__sidebar .sidebar-heading-type {
  font-family: "IBM Plex Mono", ui-monospace, monospace !important;
  font-size: 0.75rem !important;
  opacity: 0.9 !important;
  font-weight: 600 !important;
}

/* No pill-shaped elements — enforce rounded-sm (3px) globally in Scalar. */
.scalar-app button,
.scalar-app .scalar-card,
.scalar-app .schema-properties {
  border-radius: 3px !important;
}

/* Tighten section spacing — Scalar defaults to 90px top/bottom padding. */
.section {
  padding-top: 3rem !important;
  padding-bottom: 5rem !important;
}

/* ---- Section headings (tag names: System, U.S. Code, eCFR, etc.) ---- */
.section-header h2 {
  font-family: "IBM Plex Serif", serif !important;
  font-weight: 600 !important;
  letter-spacing: -0.01em !important;
  color: var(--scalar-color-1) !important;
}

/* Tag descriptions — refined body text under section headings */
.section-header + p,
.section-header ~ .section-description,
.section-container > .section-content p:first-of-type {
  font-size: 0.9375rem !important;
  line-height: 1.65 !important;
  color: var(--scalar-color-2) !important;
}

/* ---- Section dividers — subtle summer-green tinted top border ---- */
.light-mode .section:not(:first-of-type) {
  border-top: 1px solid #d3e4dc !important;
}
.dark-mode .section:not(:first-of-type) {
  border-top: 1px solid #354b43 !important;
}

/* ---- Operation headings (Health Check, List Sources, etc.) ---- */
.section-header h3 {
  font-weight: 600 !important;
  color: var(--scalar-color-1) !important;
}

/* Operation description text */
.section-header h3 + p,
.section-header ~ p {
  color: var(--scalar-color-2) !important;
  line-height: 1.6 !important;
}

/* ---- HTTP method badges (GET, POST, etc.) ---- */
.badge {
  font-family: "IBM Plex Mono", ui-monospace, monospace !important;
  font-weight: 600 !important;
  letter-spacing: 0.02em !important;
}

/* ---- Schema property names — medium weight for hierarchy ---- */
.property-name,
.property > .property-heading > span:first-child {
  font-weight: 500 !important;
  color: var(--scalar-color-1) !important;
}

/* ---- "required" labels — brand-tinted ---- */
.required-badge,
span.required {
  color: #487061 !important;
  font-weight: 600 !important;
  font-size: 0.7rem !important;
  text-transform: uppercase !important;
  letter-spacing: 0.04em !important;
}
.dark-mode .required-badge,
.dark-mode span.required {
  color: #98b8ab !important;
}

/* ---- Response status badges (200, 404) ---- */
.response-status-code {
  font-family: "IBM Plex Mono", ui-monospace, monospace !important;
  font-weight: 600 !important;
}

/* ---- Scalar cards (right-column code blocks) — subtle brand border ---- */
.scalar-card {
  border: 1px solid var(--scalar-border-color) !important;
}

/* ---- Operations list card (the endpoint listing per section) ---- */
.section-content .scalar-card {
  border: 1px solid var(--scalar-border-color) !important;
  background: var(--scalar-background-2) !important;
}

/* ---- "Show More" buttons: refined with subtle shadow ---- */
.show-more {
  background: var(--scalar-color-accent) !important;
  color: #fff !important;
  border: 1px solid var(--scalar-color-accent) !important;
  border-radius: 3px !important;
  padding: 0.375rem 1.25rem !important;
  font-weight: 500 !important;
  font-size: 0.8125rem !important;
  letter-spacing: 0.01em !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06) !important;
  transition: opacity 0.15s, box-shadow 0.15s !important;
}
.show-more svg {
  color: #fff !important;
}
.show-more:hover {
  opacity: 0.9 !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
}

/* ---- Introduction section — branded heading + badge spacing ---- */
.section-header h1 {
  font-family: "IBM Plex Serif", serif !important;
  font-weight: 600 !important;
  letter-spacing: -0.015em !important;
  color: var(--scalar-color-1) !important;
}

/* Version/OAS badges above the title — add breathing room below */
.section-header-label {
  margin-bottom: 0.5rem !important;
}

/* ---- Sticky cards (right column) — subtle elevation ---- */
.sticky-cards .scalar-card {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04) !important;
}
.dark-mode .sticky-cards .scalar-card {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.12) !important;
}

/* ---- Schema type labels (string, number, boolean, etc.) ---- */
.schema-type {
  font-family: "IBM Plex Mono", ui-monospace, monospace !important;
  font-size: 0.75rem !important;
  color: var(--scalar-color-3) !important;
}

/* ---- Endpoint path in operation headers ---- */
.endpoint-path,
.operation-path {
  font-family: "IBM Plex Mono", ui-monospace, monospace !important;
  font-weight: 500 !important;
}

/* Hide Scalar's AI Agent button (requires Scalar Cloud subscription). */
.agent-button-container {
  display: none !important;
}

/* Hide the API name/license badges (LexBuild | MIT) from the intro header.
   Redundant since the site header and page title already identify the API. */
.section-header-wrapper > .custom-scroll {
  display: none !important;
}

/* Hide Scalar's sidebar footer (dark mode toggle, MCP links, branding).
   The site navbar ThemeToggle is the single dark mode control. */
.darklight-reference {
  display: none !important;
}
`;
