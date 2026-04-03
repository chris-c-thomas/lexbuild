/**
 * SEO builder functions — pure, testable, no Astro imports.
 *
 * All functions are side-effect-free and receive `siteUrl` as a parameter
 * rather than reading from `import.meta.env`.
 */

import type { SourceId, Granularity, ContentFrontmatter, Breadcrumb, PageSEO } from "./types.js";
import { toTitleCase } from "./utils.js";

// --- Internal parameter types ---

/** Navigation context for index pages that don't have ContentFrontmatter. */
interface NavContext {
  titleNumber?: number;
  titleName?: string;
  chapterNumber?: string;
  chapterName?: string;
  partNumber?: string;
  partName?: string;
  sectionCount?: number;
  chapterCount?: number;
  partCount?: number;
  tokenEstimate?: number;
  // FR-specific
  year?: number;
  month?: number;
  monthName?: string;
  documentCount?: number;
}

interface BuildPageSEOParams {
  source: SourceId;
  granularity: Granularity;
  frontmatter: ContentFrontmatter | null;
  breadcrumbs: Breadcrumb[];
  /** Relative path like "/usc/title-01/chapter-01" */
  canonicalUrl: string;
  /** Base URL like "https://lexbuild.dev" */
  siteUrl: string;
  nav?: NavContext;
}

interface JsonLdParams {
  source: SourceId;
  granularity: Granularity;
  frontmatter: ContentFrontmatter | null;
  /** Fully qualified canonical URL */
  canonicalUrl: string;
  siteUrl: string;
  breadcrumbs: Breadcrumb[];
  nav?: NavContext;
}

// --- buildPageSEO ---

/** Build the complete PageSEO object for a content page. */
export function buildPageSEO(params: BuildPageSEOParams): PageSEO {
  const { source, granularity, frontmatter, breadcrumbs, canonicalUrl, siteUrl, nav } = params;
  const fullCanonicalUrl = new URL(canonicalUrl, siteUrl).href;

  return {
    title: buildTitle(source, granularity, frontmatter, nav),
    description: buildDescription(source, granularity, frontmatter, nav),
    canonicalUrl: fullCanonicalUrl,
    ogType: granularity === "section" || granularity === "document" ? "article" : "website",
    ogImage: `${siteUrl}/og-image.png`,
    jsonLd: buildJsonLd({
      source,
      granularity,
      frontmatter,
      canonicalUrl: fullCanonicalUrl,
      siteUrl,
      breadcrumbs,
      nav,
    }),
  };
}

// --- buildTitle ---

/**
 * Build the page title for SEO. Does NOT include the " | LexBuild" suffix.
 *
 * Replicates the existing inline logic from the catch-all routes.
 */
export function buildTitle(
  source: SourceId,
  granularity: Granularity,
  fm: ContentFrontmatter | null,
  nav?: NavContext,
): string {
  // FR pages
  if (source === "fr") {
    if (granularity === "document" && fm) {
      return fm.title ? toTitleCase(fm.title) : `FR Document ${fm.document_number ?? ""}`;
    }
    if (granularity === "month" && nav) {
      return `Federal Register — ${nav.monthName ?? ""} ${nav.year ?? ""}`;
    }
    if (granularity === "year" && nav) {
      return `Federal Register — ${nav.year ?? ""}`;
    }
    return "Federal Register";
  }

  // Section pages: use frontmatter title
  if (granularity === "section" && fm) {
    return fm.title ? toTitleCase(fm.title) : `${source.toUpperCase()} Section`;
  }

  // Index pages: build from NavContext
  const titleNum = nav?.titleNumber ?? fm?.title_number;
  const titleName = nav?.titleName ? toTitleCase(nav.titleName) : fm?.title_name ? toTitleCase(fm.title_name) : "";

  if (granularity === "title") {
    return `Title ${titleNum} — ${titleName}`;
  }

  if (granularity === "chapter") {
    const chNum = nav?.chapterNumber ?? "";
    const chName = nav?.chapterName ? toTitleCase(nav.chapterName) : "";
    return `Title ${titleNum}, Chapter ${chNum} — ${chName}`;
  }

  if (granularity === "part") {
    const partNum = nav?.partNumber ?? "";
    const partName = nav?.partName ? toTitleCase(nav.partName) : "";
    return `Title ${titleNum}, Part ${partNum} — ${partName}`;
  }

  return `Title ${titleNum}`;
}

// --- buildDescription ---

/**
 * Build meta description. Target 120-155 chars. No programmatic truncation.
 */
export function buildDescription(
  source: SourceId,
  granularity: Granularity,
  fm: ContentFrontmatter | null,
  nav?: NavContext,
): string {
  // FR descriptions
  if (source === "fr") {
    if (granularity === "document" && fm) {
      const typeLabel = fm.document_type?.replace(/_/g, " ") ?? "document";
      const agencies = fm.agencies?.join(", ") ?? "";
      return `${fm.fr_citation ?? fm.document_number ?? ""} — ${typeLabel}. ${agencies ? `${agencies}. ` : ""}Federal Register.`;
    }
    if (granularity === "month" && nav) {
      return `${nav.documentCount?.toLocaleString() ?? 0} Federal Register documents from ${nav.monthName ?? ""} ${nav.year ?? ""}.`;
    }
    if (granularity === "year" && nav) {
      return `${nav.documentCount?.toLocaleString() ?? 0} Federal Register documents from ${nav.year ?? ""}.`;
    }
    return "Federal Register documents as structured Markdown.";
  }

  const titleNum = nav?.titleNumber ?? fm?.title_number;
  const titleName = nav?.titleName ? toTitleCase(nav.titleName) : fm?.title_name ? toTitleCase(fm.title_name) : "";
  const sourceName = source === "usc" ? "U.S. Code" : "Code of Federal Regulations";

  // ── Title index ──
  if (granularity === "title") {
    const chCount = nav?.chapterCount ?? fm?.chapter_count ?? 0;
    const secCount = nav?.sectionCount ?? fm?.section_count ?? 0;

    if (source === "ecfr") {
      const partCount = nav?.partCount ?? fm?.part_count ?? 0;
      return `Title ${titleNum}, ${titleName} of the ${sourceName}. ${chCount} chapters, ${partCount} parts, ${secCount.toLocaleString()} sections as Markdown.`;
    }
    return `Title ${titleNum}, ${titleName} of the ${sourceName}. ${chCount} chapters, ${secCount.toLocaleString()} sections as structured Markdown.`;
  }

  // ── Chapter index ──
  if (granularity === "chapter") {
    const chNum = nav?.chapterNumber ?? "";
    const chName = nav?.chapterName ? toTitleCase(nav.chapterName) : "";
    return `Chapter ${chNum}, ${chName}. Title ${titleNum}, ${titleName} — ${sourceName}.`;
  }

  // ── Part index (eCFR only) ──
  if (granularity === "part") {
    const partNum = nav?.partNumber ?? "";
    const partName = nav?.partName ? toTitleCase(nav.partName) : "";
    const chNum = nav?.chapterNumber ?? "";
    return `Part ${partNum}, ${partName}. Chapter ${chNum}, Title ${titleNum}, ${titleName} — ${sourceName}.`;
  }

  // ── Section ──
  if (granularity === "section" && fm) {
    const sectionName = fm.section_name ? toTitleCase(fm.section_name) : "";

    if (source === "usc") {
      const chapterCtx = fm.chapter_name ? `Chapter ${fm.chapter_number}, ${toTitleCase(fm.chapter_name)}` : "";
      return `${fm.title_number} U.S.C. § ${fm.section_number ?? ""}${sectionName ? ` — ${sectionName}` : ""}. ${chapterCtx ? `${chapterCtx}. ` : ""}Title ${fm.title_number}, ${toTitleCase(fm.title_name)}.`;
    }

    // eCFR section
    const partCtx = fm.part_name ? `Part ${fm.part_number}, ${toTitleCase(fm.part_name)}` : "";
    return `${fm.title_number} CFR § ${fm.section_number ?? ""}${sectionName ? ` — ${sectionName}` : ""}. ${partCtx ? `${partCtx}. ` : ""}Title ${fm.title_number}, ${toTitleCase(fm.title_name)}.`;
  }

  // Fallback
  return `${sourceName} as structured Markdown for LLMs, RAG, and semantic search.`;
}

// --- buildJsonLd ---

/**
 * Build JSON-LD structured data. Returns an array of objects (without @context).
 * The JsonLd.astro component wraps them in a @graph structure with @context.
 */
export function buildJsonLd(params: JsonLdParams): Record<string, unknown>[] {
  const { source, granularity, frontmatter, canonicalUrl, siteUrl, breadcrumbs, nav } = params;

  const breadcrumbLd = buildBreadcrumbJsonLd(breadcrumbs, siteUrl);
  const isPartOf = { "@type": "WebSite", name: "LexBuild", url: siteUrl };

  // FR document pages → Article type
  if (granularity === "document" && frontmatter) {
    const article: Record<string, unknown> = {
      "@type": "Article",
      name: frontmatter.title ? toTitleCase(frontmatter.title) : undefined,
      url: canonicalUrl,
      identifier: frontmatter.document_number,
      isPartOf,
    };
    if (frontmatter.publication_date) {
      article.datePublished = frontmatter.publication_date;
    }
    if (frontmatter.agencies && frontmatter.agencies.length > 0) {
      article.author = frontmatter.agencies.map((a) => ({
        "@type": "GovernmentOrganization",
        name: a,
      }));
    }
    return [article, breadcrumbLd];
  }

  // Section pages → Legislation type
  if (granularity === "section" && frontmatter) {
    const legislation: Record<string, unknown> = {
      "@type": "Legislation",
      name: frontmatter.title ? toTitleCase(frontmatter.title) : undefined,
      url: canonicalUrl,
      legislationIdentifier: frontmatter.identifier,
      legislationType: source === "usc" ? "Statute" : "Regulation",
      legislationJurisdiction: "US",
      isPartOf,
    };

    if (frontmatter.last_updated) {
      legislation.dateModified = frontmatter.last_updated;
    }

    // Repealed sections
    if (frontmatter.legal_status === "repealed" || frontmatter.status === "repealed") {
      legislation.legislationDateVersion = frontmatter.last_updated;
    }

    return [legislation, breadcrumbLd];
  }

  // Index pages → WebPage type
  const webPage: Record<string, unknown> = {
    "@type": "WebPage",
    name: buildTitle(source, granularity, frontmatter, nav),
    url: canonicalUrl,
    description: buildDescription(source, granularity, frontmatter, nav),
    isPartOf,
  };

  return [webPage, breadcrumbLd];
}

/**
 * Build BreadcrumbList JSON-LD from route breadcrumbs.
 *
 * Each breadcrumb becomes a ListItem. The last item (current page) omits the
 * `item` URL per Google's spec.
 */
export function buildBreadcrumbJsonLd(breadcrumbs: Breadcrumb[], siteUrl: string): Record<string, unknown> {
  const items = breadcrumbs.map((crumb, i) => {
    const isLast = i === breadcrumbs.length - 1;
    const entry: Record<string, unknown> = {
      "@type": "ListItem",
      position: i + 1,
      name: crumb.label,
    };
    if (!isLast) {
      entry.item = new URL(crumb.href, siteUrl).href;
    }
    return entry;
  });

  return {
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}
