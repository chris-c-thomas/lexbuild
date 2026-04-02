import { describe, it, expect } from "vitest";
import {
  buildPageSEO,
  buildTitle,
  buildDescription,
  buildJsonLd,
  buildBreadcrumbJsonLd,
} from "../seo.js";
import type { ContentFrontmatter, Breadcrumb } from "../types.js";

// --- Test fixtures ---

const SITE_URL = "https://lexbuild.dev";

const USC_SECTION_FM: ContentFrontmatter = {
  identifier: "/us/usc/t26/s501",
  source: "usc",
  legal_status: "official_legal_evidence",
  title: "EXEMPTION FROM TAX ON CORPORATIONS, CERTAIN TRUSTS, ETC.",
  title_number: 26,
  title_name: "INTERNAL REVENUE CODE",
  positive_law: true,
  currency: "119-73",
  last_updated: "2025-12-03",
  format_version: "1.1.0",
  generator: "lexbuild@1.9.0",
  section_number: "501",
  section_name: "EXEMPTION FROM TAX ON CORPORATIONS, CERTAIN TRUSTS, ETC.",
  chapter_number: 1,
  chapter_name: "NORMAL TAXES AND SURTAXES",
};

const ECFR_SECTION_FM: ContentFrontmatter = {
  identifier: "/us/cfr/t17/s240.10b-5",
  source: "ecfr",
  legal_status: "authoritative_unofficial",
  title: "EMPLOYMENT OF MANIPULATIVE AND DECEPTIVE DEVICES",
  title_number: 17,
  title_name: "COMMODITY AND SECURITIES EXCHANGES",
  positive_law: false,
  currency: "2025-01-15",
  last_updated: "2025-01-15",
  format_version: "1.1.0",
  generator: "lexbuild@1.9.0",
  section_number: "240.10b-5",
  section_name: "EMPLOYMENT OF MANIPULATIVE AND DECEPTIVE DEVICES",
  part_number: "240",
  part_name: "GENERAL RULES AND REGULATIONS, SECURITIES EXCHANGE ACT OF 1934",
  cfr_part: "240",
};

const REPEALED_SECTION_FM: ContentFrontmatter = {
  ...USC_SECTION_FM,
  legal_status: "repealed",
  status: "repealed",
  section_number: "3598",
  section_name: "REPEALED",
  title: "REPEALED",
};

const USC_SECTION_FM_EMPTY_NAME: ContentFrontmatter = {
  ...USC_SECTION_FM,
  section_name: "",
};

const USC_BREADCRUMBS: Breadcrumb[] = [
  { label: "USC", href: "/usc" },
  { label: "Title 26", href: "/usc/title-26" },
  { label: "Chapter 01", href: "/usc/title-26/chapter-01" },
  { label: "§ 501", href: "/usc/title-26/chapter-01/section-501" },
];

const ECFR_BREADCRUMBS: Breadcrumb[] = [
  { label: "eCFR", href: "/ecfr" },
  { label: "Title 17", href: "/ecfr/title-17" },
  { label: "Chapter II", href: "/ecfr/title-17/chapter-II" },
  { label: "Part 240", href: "/ecfr/title-17/chapter-II/part-240" },
  { label: "§ 240.10b-5", href: "/ecfr/title-17/chapter-II/part-240/section-240.10b-5" },
];

const TITLE_INDEX_BREADCRUMBS: Breadcrumb[] = [
  { label: "USC", href: "/usc" },
  { label: "Title 26", href: "/usc/title-26" },
];

// --- buildTitle ---

describe("buildTitle", () => {
  it("returns toTitleCase(frontmatter.title) for USC section", () => {
    const title = buildTitle("usc", "section", USC_SECTION_FM);
    expect(title).toContain("Exemption From Tax");
    expect(title).not.toBe(title.toUpperCase());
  });

  it("returns toTitleCase(frontmatter.title) for eCFR section", () => {
    const title = buildTitle("ecfr", "section", ECFR_SECTION_FM);
    expect(title).toContain("Employment of Manipulative");
  });

  it("builds title index heading from NavContext", () => {
    const title = buildTitle("usc", "title", null, {
      titleNumber: 26,
      titleName: "INTERNAL REVENUE CODE",
    });
    expect(title).toBe("Title 26 — Internal Revenue Code");
  });

  it("builds chapter index heading from NavContext", () => {
    const title = buildTitle("usc", "chapter", null, {
      titleNumber: 1,
      titleName: "GENERAL PROVISIONS",
      chapterNumber: "1",
      chapterName: "RULES OF CONSTRUCTION",
    });
    expect(title).toBe("Title 1, Chapter 1 — Rules of Construction");
  });

  it("builds part index heading from NavContext", () => {
    const title = buildTitle("ecfr", "part", null, {
      titleNumber: 17,
      titleName: "COMMODITY AND SECURITIES EXCHANGES",
      partNumber: "240",
      partName: "GENERAL RULES AND REGULATIONS, SECURITIES EXCHANGE ACT OF 1934",
    });
    expect(title).toContain("Title 17, Part 240");
    expect(title).toContain("General Rules");
  });
});

// --- buildDescription ---

describe("buildDescription", () => {
  it("builds USC title index description with counts", () => {
    const desc = buildDescription("usc", "title", null, {
      titleNumber: 26,
      titleName: "INTERNAL REVENUE CODE",
      chapterCount: 98,
      sectionCount: 10843,
    });
    expect(desc).toContain("Title 26");
    expect(desc).toContain("Internal Revenue Code");
    expect(desc).toContain("U.S. Code");
    expect(desc).toContain("98 chapters");
    expect(desc).toContain("10,843 sections");
  });

  it("builds eCFR title index description with part count", () => {
    const desc = buildDescription("ecfr", "title", null, {
      titleNumber: 17,
      titleName: "COMMODITY AND SECURITIES EXCHANGES",
      chapterCount: 4,
      partCount: 45,
      sectionCount: 3200,
    });
    expect(desc).toContain("Code of Federal Regulations");
    expect(desc).toContain("45 parts");
  });

  it("builds USC chapter index description", () => {
    const desc = buildDescription("usc", "chapter", null, {
      titleNumber: 1,
      titleName: "GENERAL PROVISIONS",
      chapterNumber: "1",
      chapterName: "RULES OF CONSTRUCTION",
    });
    expect(desc).toContain("Chapter 1");
    expect(desc).toContain("Rules of Construction");
    expect(desc).toContain("U.S. Code");
  });

  it("builds eCFR part index description", () => {
    const desc = buildDescription("ecfr", "part", null, {
      titleNumber: 17,
      titleName: "COMMODITY AND SECURITIES EXCHANGES",
      partNumber: "240",
      partName: "GENERAL RULES AND REGULATIONS",
      chapterNumber: "II",
    });
    expect(desc).toContain("Part 240");
    expect(desc).toContain("Chapter II");
  });

  it("builds USC section description with chapter context", () => {
    const desc = buildDescription("usc", "section", USC_SECTION_FM);
    expect(desc).toContain("26 U.S.C. § 501");
    expect(desc).toContain("Chapter 1");
    expect(desc).toContain("Title 26");
  });

  it("builds eCFR section description with part context", () => {
    const desc = buildDescription("ecfr", "section", ECFR_SECTION_FM);
    expect(desc).toContain("17 CFR § 240.10b-5");
    expect(desc).toContain("Part 240");
    expect(desc).toContain("Title 17");
  });

  it("omits dash for empty section_name", () => {
    const desc = buildDescription("usc", "section", USC_SECTION_FM_EMPTY_NAME);
    expect(desc).toContain("26 U.S.C. § 501.");
    expect(desc).not.toContain("— .");
  });

  it("returns fallback for null frontmatter on section", () => {
    const desc = buildDescription("usc", "section", null);
    expect(desc).toContain("U.S. Code");
  });
});

// --- buildBreadcrumbJsonLd ---

describe("buildBreadcrumbJsonLd", () => {
  it("produces BreadcrumbList with 1-indexed positions", () => {
    const result = buildBreadcrumbJsonLd(USC_BREADCRUMBS, SITE_URL);
    expect(result["@type"]).toBe("BreadcrumbList");
    const items = result.itemListElement as Record<string, unknown>[];
    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({ position: 1, name: "USC" });
    expect(items[1]).toMatchObject({ position: 2, name: "Title 26" });
    expect(items[3]).toMatchObject({ position: 4, name: "§ 501" });
  });

  it("last item omits the item URL", () => {
    const result = buildBreadcrumbJsonLd(USC_BREADCRUMBS, SITE_URL);
    const items = result.itemListElement as Record<string, unknown>[];
    expect(items[0]).toHaveProperty("item");
    expect(items[3]).not.toHaveProperty("item");
  });

  it("fully qualifies URLs with siteUrl", () => {
    const result = buildBreadcrumbJsonLd(USC_BREADCRUMBS, SITE_URL);
    const items = result.itemListElement as Record<string, unknown>[];
    expect(items[0]!.item).toBe("https://lexbuild.dev/usc");
    expect(items[1]!.item).toBe("https://lexbuild.dev/usc/title-26");
  });

  it("does not include @context", () => {
    const result = buildBreadcrumbJsonLd(USC_BREADCRUMBS, SITE_URL);
    expect(result).not.toHaveProperty("@context");
  });
});

// --- buildJsonLd ---

describe("buildJsonLd", () => {
  it("returns Legislation + BreadcrumbList for USC section", () => {
    const result = buildJsonLd({
      source: "usc",
      granularity: "section",
      frontmatter: USC_SECTION_FM,
      canonicalUrl: "https://lexbuild.dev/usc/title-26/chapter-01/section-501",
      siteUrl: SITE_URL,
      breadcrumbs: USC_BREADCRUMBS,
    });

    expect(result).toHaveLength(2);
    expect(result[0]!["@type"]).toBe("Legislation");
    expect(result[0]!.legislationType).toBe("Statute");
    expect(result[0]!.legislationJurisdiction).toBe("US");
    expect(result[0]!.legislationIdentifier).toBe("/us/usc/t26/s501");
    expect(result[1]!["@type"]).toBe("BreadcrumbList");
  });

  it("returns Legislation with Regulation type for eCFR section", () => {
    const result = buildJsonLd({
      source: "ecfr",
      granularity: "section",
      frontmatter: ECFR_SECTION_FM,
      canonicalUrl: "https://lexbuild.dev/ecfr/title-17/chapter-II/part-240/section-240.10b-5",
      siteUrl: SITE_URL,
      breadcrumbs: ECFR_BREADCRUMBS,
    });

    expect(result[0]!["@type"]).toBe("Legislation");
    expect(result[0]!.legislationType).toBe("Regulation");
  });

  it("includes legislationDateVersion for repealed sections", () => {
    const result = buildJsonLd({
      source: "usc",
      granularity: "section",
      frontmatter: REPEALED_SECTION_FM,
      canonicalUrl: "https://lexbuild.dev/usc/title-26/chapter-01/section-3598",
      siteUrl: SITE_URL,
      breadcrumbs: USC_BREADCRUMBS,
    });

    expect(result[0]!.legislationDateVersion).toBe("2025-12-03");
  });

  it("returns WebPage + BreadcrumbList for index page", () => {
    const result = buildJsonLd({
      source: "usc",
      granularity: "title",
      frontmatter: null,
      canonicalUrl: "https://lexbuild.dev/usc/title-26",
      siteUrl: SITE_URL,
      breadcrumbs: TITLE_INDEX_BREADCRUMBS,
      nav: { titleNumber: 26, titleName: "INTERNAL REVENUE CODE" },
    });

    expect(result).toHaveLength(2);
    expect(result[0]!["@type"]).toBe("WebPage");
    expect(result[0]!.isPartOf).toMatchObject({ "@type": "WebSite", name: "LexBuild" });
    expect(result[1]!["@type"]).toBe("BreadcrumbList");
  });

  it("does not include @context in returned objects", () => {
    const result = buildJsonLd({
      source: "usc",
      granularity: "section",
      frontmatter: USC_SECTION_FM,
      canonicalUrl: "https://lexbuild.dev/usc/title-26/chapter-01/section-501",
      siteUrl: SITE_URL,
      breadcrumbs: USC_BREADCRUMBS,
    });

    for (const obj of result) {
      expect(obj).not.toHaveProperty("@context");
    }
  });
});

// --- buildPageSEO ---

describe("buildPageSEO", () => {
  it("sets ogType to article for section pages", () => {
    const seo = buildPageSEO({
      source: "usc",
      granularity: "section",
      frontmatter: USC_SECTION_FM,
      breadcrumbs: USC_BREADCRUMBS,
      canonicalUrl: "/usc/title-26/chapter-01/section-501",
      siteUrl: SITE_URL,
    });

    expect(seo.ogType).toBe("article");
  });

  it("sets ogType to website for index pages", () => {
    const seo = buildPageSEO({
      source: "usc",
      granularity: "title",
      frontmatter: null,
      breadcrumbs: TITLE_INDEX_BREADCRUMBS,
      canonicalUrl: "/usc/title-26",
      siteUrl: SITE_URL,
      nav: { titleNumber: 26, titleName: "INTERNAL REVENUE CODE" },
    });

    expect(seo.ogType).toBe("website");
  });

  it("fully qualifies canonicalUrl", () => {
    const seo = buildPageSEO({
      source: "usc",
      granularity: "section",
      frontmatter: USC_SECTION_FM,
      breadcrumbs: USC_BREADCRUMBS,
      canonicalUrl: "/usc/title-26/chapter-01/section-501",
      siteUrl: SITE_URL,
    });

    expect(seo.canonicalUrl).toBe("https://lexbuild.dev/usc/title-26/chapter-01/section-501");
  });

  it("always sets ogImage", () => {
    const seo = buildPageSEO({
      source: "usc",
      granularity: "section",
      frontmatter: USC_SECTION_FM,
      breadcrumbs: USC_BREADCRUMBS,
      canonicalUrl: "/usc/title-26/chapter-01/section-501",
      siteUrl: SITE_URL,
    });

    expect(seo.ogImage).toBe("https://lexbuild.dev/og-image.png");
  });

  it("includes jsonLd array with Legislation and BreadcrumbList", () => {
    const seo = buildPageSEO({
      source: "usc",
      granularity: "section",
      frontmatter: USC_SECTION_FM,
      breadcrumbs: USC_BREADCRUMBS,
      canonicalUrl: "/usc/title-26/chapter-01/section-501",
      siteUrl: SITE_URL,
    });

    const jsonLd = seo.jsonLd as Record<string, unknown>[];
    expect(Array.isArray(jsonLd)).toBe(true);
    expect(jsonLd).toHaveLength(2);
  });
});
