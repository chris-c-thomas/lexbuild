/** Navigation item linking to a docs page. */
export interface DocsNavItem {
  title: string;
  slug: string;
  badge?: string;
  /** Render a separator line above this item in the sidebar. */
  separator?: boolean;
}

/** Top-level section grouping nav items. */
export interface DocsNavSection {
  title: string;
  items: DocsNavItem[];
}

/** Static navigation tree for the docs site. */
export const DOCS_NAV: DocsNavSection[] = [
  {
    title: "Getting Started",
    items: [
      { title: "Introduction", slug: "getting-started/introduction" },
      { title: "CLI Quickstart", slug: "getting-started/quickstart-cli" },
      { title: "Web Quickstart", slug: "getting-started/quickstart-web" },
      { title: "API Quickstart", slug: "getting-started/quickstart-api" },
    ],
  },
  {
    title: "CLI",
    items: [
      { title: "Installation", slug: "cli/installation" },
      { title: "Commands", slug: "cli/commands" },
      { title: "U.S. Code", slug: "cli/sources/us-code" },
      { title: "eCFR", slug: "cli/sources/ecfr" },
      { title: "Federal Register", slug: "cli/sources/federal-register" },
      { title: "Output Format", slug: "cli/output-format" },
      { title: "Configuration", slug: "cli/configuration" },
    ],
  },
  {
    title: "Web",
    items: [
      { title: "Browsing Content", slug: "web/browsing" },
      { title: "Search", slug: "web/search" },
      { title: "Content Viewer", slug: "web/content-viewer" },
      { title: "Frontmatter", slug: "web/frontmatter" },
    ],
  },
  {
    title: "API",
    items: [
      { title: "API Reference", slug: "api", badge: "Interactive" },
      { title: "Overview", slug: "api/overview", separator: true },
      { title: "Authentication", slug: "api/authentication" },
      { title: "Documents", slug: "api/endpoints/documents" },
      { title: "Hierarchy", slug: "api/endpoints/hierarchy" },
      { title: "Search", slug: "api/endpoints/search" },
      { title: "Sources & Stats", slug: "api/endpoints/sources" },
      { title: "Content Negotiation", slug: "api/content-negotiation" },
      { title: "Pagination", slug: "api/pagination" },
      { title: "Errors", slug: "api/errors" },
    ],
  },
  {
    title: "MCP",
    items: [
      { title: "Overview", slug: "mcp/overview", badge: "Coming Soon" },
    ],
  },
  {
    title: "Guides",
    items: [
      { title: "RAG Pipeline Integration", slug: "guides/rag-pipeline" },
      { title: "Legal Research", slug: "guides/legal-research" },
      { title: "Bulk Download", slug: "guides/bulk-download" },
    ],
  },
  {
    title: "Architecture",
    items: [
      { title: "Overview", slug: "architecture/overview" },
      { title: "Conversion Pipeline", slug: "architecture/conversion-pipeline" },
      { title: "AST Model", slug: "architecture/ast-model" },
      { title: "Extending LexBuild", slug: "architecture/extending" },
    ],
  },
  {
    title: "Reference",
    items: [
      { title: "CLI Reference", slug: "reference/cli-reference" },
      { title: "Output Format Spec", slug: "reference/output-format" },
      { title: "Identifier Format", slug: "reference/identifier-format" },
      { title: "USLM Elements", slug: "reference/uslm-elements" },
      { title: "eCFR Elements", slug: "reference/ecfr-elements" },
      { title: "FR Elements", slug: "reference/fr-elements" },
      { title: "Glossary", slug: "reference/glossary" },
    ],
  },
  {
    title: "Project",
    items: [
      { title: "Contributing", slug: "project/contributing" },
      { title: "Changelog", slug: "project/changelog" },
      { title: "License", slug: "project/license" },
    ],
  },
];

/** Flatten the nav tree into an ordered list of items for prev/next. */
export function flattenNav(): DocsNavItem[] {
  return DOCS_NAV.flatMap((section) => section.items);
}

/** Get previous and next items relative to a given slug. */
export function getPrevNext(slug: string): {
  prev: DocsNavItem | null;
  next: DocsNavItem | null;
} {
  const flat = flattenNav();
  const index = flat.findIndex((item) => item.slug === slug);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? (flat[index - 1] ?? null) : null,
    next: index < flat.length - 1 ? (flat[index + 1] ?? null) : null,
  };
}

/** Find the section title containing a given slug. */
export function getSectionForSlug(slug: string): string | null {
  for (const section of DOCS_NAV) {
    if (section.items.some((item) => item.slug === slug)) {
      return section.title;
    }
  }
  return null;
}
