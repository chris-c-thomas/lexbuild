/**
 * Test database fixtures for the Data API test suite.
 *
 * Creates a temporary on-disk SQLite database with the real schema
 * from @lexbuild/core, seeded with representative documents across all
 * three sources (USC, eCFR, FR).
 */
import Database from "better-sqlite3";
import {
  DOCUMENTS_TABLE_SQL,
  SCHEMA_META_TABLE_SQL,
  INDEXES_SQL,
  SCHEMA_VERSION,
  API_AGGREGATES_META_KEY,
} from "@lexbuild/core";
import type { ApiAggregates, FrYearAggregate } from "@lexbuild/core";

/** Minimal document fields for fixture insertion. */
interface FixtureDoc {
  id: string;
  source: "usc" | "ecfr" | "fr";
  identifier: string;
  title_number: number | null;
  title_name: string | null;
  section_number: string | null;
  section_name: string | null;
  chapter_number: string | null;
  chapter_name: string | null;
  subchapter_number: string | null;
  subchapter_name: string | null;
  part_number: string | null;
  part_name: string | null;
  legal_status: string;
  positive_law: number;
  status: string | null;
  currency: string | null;
  last_updated: string | null;
  display_title: string;
  document_number: string | null;
  document_type: string | null;
  publication_date: string | null;
  agency: string | null;
  fr_citation: string | null;
  fr_volume: number | null;
  effective_date: string | null;
  comments_close_date: string | null;
  fr_action: string | null;
  authority: string | null;
  regulatory_source: string | null;
  cfr_part: string | null;
  cfr_subpart: string | null;
  agencies: string | null;
  cfr_references: string | null;
  docket_ids: string | null;
  source_credit: string | null;
  frontmatter_yaml: string;
  markdown_body: string;
  file_path: string;
  content_hash: string;
  format_version: string;
  generator: string;
}

const YAML_TEMPLATE = (source: string, id: string) =>
  `source: "${source}"\nidentifier: "${id}"\nformat_version: "1.1.0"`;

const MD_TEMPLATE = (heading: string) => `# ${heading}\n\nThis is test content for ${heading}.\n`;

/** USC fixture documents (Title 1 and Title 26). */
const USC_DOCS: FixtureDoc[] = [
  {
    id: "us-usc-t1-s1",
    source: "usc",
    identifier: "/us/usc/t1/s1",
    title_number: 1,
    title_name: "General Provisions",
    section_number: "1",
    section_name: "Words denoting number, gender, and so forth",
    chapter_number: "1",
    chapter_name: "Rules of Construction",
    subchapter_number: null,
    subchapter_name: null,
    part_number: null,
    part_name: null,
    legal_status: "law",
    positive_law: 1,
    status: "in_force",
    currency: "2024-01-03",
    last_updated: "2024-01-03",
    display_title: "1 U.S.C. 1 - Words denoting number, gender, and so forth",
    document_number: null,
    document_type: null,
    publication_date: null,
    agency: null,
    fr_citation: null,
    fr_volume: null,
    effective_date: null,
    comments_close_date: null,
    fr_action: null,
    authority: null,
    regulatory_source: null,
    cfr_part: null,
    cfr_subpart: null,
    agencies: null,
    cfr_references: null,
    docket_ids: null,
    source_credit: "(July 30, 1947, ch. 388, 61 Stat. 633.)",
    frontmatter_yaml: YAML_TEMPLATE("usc", "/us/usc/t1/s1"),
    markdown_body: MD_TEMPLATE("1 U.S.C. 1"),
    file_path: "usc/title-01/chapter-1/section-1.md",
    content_hash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    format_version: "1.1.0",
    generator: "lexbuild-test",
  },
  {
    id: "us-usc-t1-s2",
    source: "usc",
    identifier: "/us/usc/t1/s2",
    title_number: 1,
    title_name: "General Provisions",
    section_number: "2",
    section_name: '"County" as including "parish", and so forth',
    chapter_number: "1",
    chapter_name: "Rules of Construction",
    subchapter_number: null,
    subchapter_name: null,
    part_number: null,
    part_name: null,
    legal_status: "law",
    positive_law: 1,
    status: "in_force",
    currency: "2024-01-03",
    last_updated: "2024-01-03",
    display_title: '1 U.S.C. 2 - "County" as including "parish"',
    document_number: null,
    document_type: null,
    publication_date: null,
    agency: null,
    fr_citation: null,
    fr_volume: null,
    effective_date: null,
    comments_close_date: null,
    fr_action: null,
    authority: null,
    regulatory_source: null,
    cfr_part: null,
    cfr_subpart: null,
    agencies: null,
    cfr_references: null,
    docket_ids: null,
    source_credit: "(July 30, 1947, ch. 388, 61 Stat. 633.)",
    frontmatter_yaml: YAML_TEMPLATE("usc", "/us/usc/t1/s2"),
    markdown_body: MD_TEMPLATE("1 U.S.C. 2"),
    file_path: "usc/title-01/chapter-1/section-2.md",
    content_hash: "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
    format_version: "1.1.0",
    generator: "lexbuild-test",
  },
  {
    id: "us-usc-t1-s3",
    source: "usc",
    identifier: "/us/usc/t1/s3",
    title_number: 1,
    title_name: "General Provisions",
    section_number: "3",
    section_name: '"Vessel" as including all means of water transportation',
    chapter_number: "1",
    chapter_name: "Rules of Construction",
    subchapter_number: null,
    subchapter_name: null,
    part_number: null,
    part_name: null,
    legal_status: "law",
    positive_law: 1,
    status: "in_force",
    currency: "2024-01-03",
    last_updated: "2024-01-03",
    display_title: "1 U.S.C. 3 - Vessel",
    document_number: null,
    document_type: null,
    publication_date: null,
    agency: null,
    fr_citation: null,
    fr_volume: null,
    effective_date: null,
    comments_close_date: null,
    fr_action: null,
    authority: null,
    regulatory_source: null,
    cfr_part: null,
    cfr_subpart: null,
    agencies: null,
    cfr_references: null,
    docket_ids: null,
    source_credit: "(July 30, 1947, ch. 388, 61 Stat. 633.)",
    frontmatter_yaml: YAML_TEMPLATE("usc", "/us/usc/t1/s3"),
    markdown_body: MD_TEMPLATE("1 U.S.C. 3"),
    file_path: "usc/title-01/chapter-1/section-3.md",
    content_hash: "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
    format_version: "1.1.0",
    generator: "lexbuild-test",
  },
  {
    id: "us-usc-t26-s7801",
    source: "usc",
    identifier: "/us/usc/t26/s7801",
    title_number: 26,
    title_name: "Internal Revenue Code",
    section_number: "7801",
    section_name: "Authority of Department of the Treasury",
    chapter_number: "80",
    chapter_name: "General Rules",
    subchapter_number: null,
    subchapter_name: null,
    part_number: null,
    part_name: null,
    legal_status: "non_positive_law",
    positive_law: 0,
    status: "in_force",
    currency: "2024-01-03",
    last_updated: "2024-01-03",
    display_title: "26 U.S.C. 7801 - Authority of Department of the Treasury",
    document_number: null,
    document_type: null,
    publication_date: null,
    agency: null,
    fr_citation: null,
    fr_volume: null,
    effective_date: null,
    comments_close_date: null,
    fr_action: null,
    authority: null,
    regulatory_source: null,
    cfr_part: null,
    cfr_subpart: null,
    agencies: null,
    cfr_references: null,
    docket_ids: null,
    source_credit: "(Aug. 16, 1954, ch. 736, 68A Stat. 915.)",
    frontmatter_yaml: YAML_TEMPLATE("usc", "/us/usc/t26/s7801"),
    markdown_body: MD_TEMPLATE("26 U.S.C. 7801"),
    file_path: "usc/title-26/chapter-80/section-7801.md",
    content_hash: "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
    format_version: "1.1.0",
    generator: "lexbuild-test",
  },
];

/** eCFR fixture documents (Title 17 and Title 40). */
const ECFR_DOCS: FixtureDoc[] = [
  {
    id: "us-cfr-t17-s240.10b-5",
    source: "ecfr",
    identifier: "/us/cfr/t17/s240.10b-5",
    title_number: 17,
    title_name: "Commodity and Securities Exchanges",
    section_number: "240.10b-5",
    section_name: "Employment of manipulative and deceptive devices",
    chapter_number: "II",
    chapter_name: "Securities and Exchange Commission",
    subchapter_number: null,
    subchapter_name: null,
    part_number: "240",
    part_name: "General Rules and Regulations, Securities Exchange Act of 1934",
    legal_status: "authoritative_unofficial",
    positive_law: 0,
    status: "in_force",
    currency: "2024-04-01",
    last_updated: "2024-04-01",
    display_title: "17 CFR 240.10b-5 - Employment of manipulative and deceptive devices",
    document_number: null,
    document_type: null,
    publication_date: null,
    agency: "Securities and Exchange Commission",
    fr_citation: null,
    fr_volume: null,
    effective_date: null,
    comments_close_date: null,
    fr_action: null,
    authority: "15 U.S.C. 78a et seq.",
    regulatory_source: "[17 FR 3301, Apr. 15, 1952]",
    cfr_part: "240",
    cfr_subpart: null,
    agencies: null,
    cfr_references: null,
    docket_ids: null,
    source_credit: null,
    frontmatter_yaml: YAML_TEMPLATE("ecfr", "/us/cfr/t17/s240.10b-5"),
    markdown_body: MD_TEMPLATE("17 CFR 240.10b-5"),
    file_path: "ecfr/title-17/chapter-II/part-240/section-240.10b-5.md",
    content_hash: "e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6",
    format_version: "1.1.0",
    generator: "lexbuild-test",
  },
  {
    id: "us-cfr-t17-s240.14a-1",
    source: "ecfr",
    identifier: "/us/cfr/t17/s240.14a-1",
    title_number: 17,
    title_name: "Commodity and Securities Exchanges",
    section_number: "240.14a-1",
    section_name: "Definitions",
    chapter_number: "II",
    chapter_name: "Securities and Exchange Commission",
    subchapter_number: null,
    subchapter_name: null,
    part_number: "240",
    part_name: "General Rules and Regulations, Securities Exchange Act of 1934",
    legal_status: "authoritative_unofficial",
    positive_law: 0,
    status: "in_force",
    currency: "2024-04-01",
    last_updated: "2024-04-01",
    display_title: "17 CFR 240.14a-1 - Definitions",
    document_number: null,
    document_type: null,
    publication_date: null,
    agency: "Securities and Exchange Commission",
    fr_citation: null,
    fr_volume: null,
    effective_date: null,
    comments_close_date: null,
    fr_action: null,
    authority: "15 U.S.C. 78a et seq.",
    regulatory_source: "[17 FR 3301, Apr. 15, 1952]",
    cfr_part: "240",
    cfr_subpart: null,
    agencies: null,
    cfr_references: null,
    docket_ids: null,
    source_credit: null,
    frontmatter_yaml: YAML_TEMPLATE("ecfr", "/us/cfr/t17/s240.14a-1"),
    markdown_body: MD_TEMPLATE("17 CFR 240.14a-1"),
    file_path: "ecfr/title-17/chapter-II/part-240/section-240.14a-1.md",
    content_hash: "f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1",
    format_version: "1.1.0",
    generator: "lexbuild-test",
  },
  {
    id: "us-cfr-t40-s60.1",
    source: "ecfr",
    identifier: "/us/cfr/t40/s60.1",
    title_number: 40,
    title_name: "Protection of Environment",
    section_number: "60.1",
    section_name: "Applicability",
    chapter_number: "I",
    chapter_name: "Environmental Protection Agency",
    subchapter_number: null,
    subchapter_name: null,
    part_number: "60",
    part_name: "Standards of Performance for New Stationary Sources",
    legal_status: "authoritative_unofficial",
    positive_law: 0,
    status: "in_force",
    currency: "2024-04-01",
    last_updated: "2024-04-01",
    display_title: "40 CFR 60.1 - Applicability",
    document_number: null,
    document_type: null,
    publication_date: null,
    agency: "Environmental Protection Agency",
    fr_citation: null,
    fr_volume: null,
    effective_date: null,
    comments_close_date: null,
    fr_action: null,
    authority: "42 U.S.C. 7401 et seq.",
    regulatory_source: "[36 FR 24877, Dec. 23, 1971]",
    cfr_part: "60",
    cfr_subpart: "A",
    agencies: null,
    cfr_references: null,
    docket_ids: null,
    source_credit: null,
    frontmatter_yaml: YAML_TEMPLATE("ecfr", "/us/cfr/t40/s60.1"),
    markdown_body: MD_TEMPLATE("40 CFR 60.1"),
    file_path: "ecfr/title-40/chapter-I/part-60/section-60.1.md",
    content_hash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd",
    format_version: "1.1.0",
    generator: "lexbuild-test",
  },
];

/** FR fixture documents (2026-03 and 2026-04). */
const FR_DOCS: FixtureDoc[] = [
  {
    id: "us-fr-2026-06029",
    source: "fr",
    identifier: "/us/fr/2026-06029",
    title_number: null,
    title_name: null,
    section_number: null,
    section_name: null,
    chapter_number: null,
    chapter_name: null,
    subchapter_number: null,
    subchapter_name: null,
    part_number: null,
    part_name: null,
    legal_status: "official",
    positive_law: 0,
    status: null,
    currency: null,
    last_updated: "2026-03-15",
    display_title: "Air Quality Standards Amendments",
    document_number: "2026-06029",
    document_type: "rule",
    publication_date: "2026-03-15",
    agency: "Environmental Protection Agency",
    fr_citation: "91 FR 12345",
    fr_volume: 91,
    effective_date: "2026-05-15",
    comments_close_date: null,
    fr_action: "Final rule",
    authority: null,
    regulatory_source: null,
    cfr_part: null,
    cfr_subpart: null,
    agencies: '["Environmental Protection Agency"]',
    cfr_references: '["40 CFR 50", "40 CFR 58"]',
    docket_ids: '["EPA-HQ-OAR-2024-0001"]',
    source_credit: null,
    frontmatter_yaml: YAML_TEMPLATE("fr", "/us/fr/2026-06029"),
    markdown_body: MD_TEMPLATE("Air Quality Standards Amendments"),
    file_path: "fr/2026/03/2026-06029.md",
    content_hash: "1111111111111111111111111111111111111111111111111111111111111111",
    format_version: "1.1.0",
    generator: "lexbuild-test",
  },
  {
    id: "us-fr-2026-06030",
    source: "fr",
    identifier: "/us/fr/2026-06030",
    title_number: null,
    title_name: null,
    section_number: null,
    section_name: null,
    chapter_number: null,
    chapter_name: null,
    subchapter_number: null,
    subchapter_name: null,
    part_number: null,
    part_name: null,
    legal_status: "official",
    positive_law: 0,
    status: null,
    currency: null,
    last_updated: "2026-03-16",
    display_title: "Proposed Emissions Standards for Heavy-Duty Vehicles",
    document_number: "2026-06030",
    document_type: "proposed_rule",
    publication_date: "2026-03-16",
    agency: "Environmental Protection Agency",
    fr_citation: "91 FR 12400",
    fr_volume: 91,
    effective_date: null,
    comments_close_date: "2026-06-16",
    fr_action: "Proposed rule",
    authority: null,
    regulatory_source: null,
    cfr_part: null,
    cfr_subpart: null,
    agencies: '["Environmental Protection Agency"]',
    cfr_references: '["40 CFR 86"]',
    docket_ids: '["EPA-HQ-OAR-2024-0002"]',
    source_credit: null,
    frontmatter_yaml: YAML_TEMPLATE("fr", "/us/fr/2026-06030"),
    markdown_body: MD_TEMPLATE("Proposed Emissions Standards"),
    file_path: "fr/2026/03/2026-06030.md",
    content_hash: "2222222222222222222222222222222222222222222222222222222222222222",
    format_version: "1.1.0",
    generator: "lexbuild-test",
  },
  {
    id: "us-fr-2026-06031",
    source: "fr",
    identifier: "/us/fr/2026-06031",
    title_number: null,
    title_name: null,
    section_number: null,
    section_name: null,
    chapter_number: null,
    chapter_name: null,
    subchapter_number: null,
    subchapter_name: null,
    part_number: null,
    part_name: null,
    legal_status: "official",
    positive_law: 0,
    status: null,
    currency: null,
    last_updated: "2026-03-17",
    display_title: "Securities Exchange Act Notice",
    document_number: "2026-06031",
    document_type: "notice",
    publication_date: "2026-03-17",
    agency: "Securities and Exchange Commission",
    fr_citation: "91 FR 12500",
    fr_volume: 91,
    effective_date: null,
    comments_close_date: null,
    fr_action: "Notice",
    authority: null,
    regulatory_source: null,
    cfr_part: null,
    cfr_subpart: null,
    agencies: '["Securities and Exchange Commission"]',
    cfr_references: null,
    docket_ids: null,
    source_credit: null,
    frontmatter_yaml: YAML_TEMPLATE("fr", "/us/fr/2026-06031"),
    markdown_body: MD_TEMPLATE("Securities Exchange Act Notice"),
    file_path: "fr/2026/03/2026-06031.md",
    content_hash: "3333333333333333333333333333333333333333333333333333333333333333",
    format_version: "1.1.0",
    generator: "lexbuild-test",
  },
  {
    id: "us-fr-2026-07001",
    source: "fr",
    identifier: "/us/fr/2026-07001",
    title_number: null,
    title_name: null,
    section_number: null,
    section_name: null,
    chapter_number: null,
    chapter_name: null,
    subchapter_number: null,
    subchapter_name: null,
    part_number: null,
    part_name: null,
    legal_status: "official",
    positive_law: 0,
    status: null,
    currency: null,
    last_updated: "2026-04-01",
    display_title: "Executive Order on Supply Chain Resilience",
    document_number: "2026-07001",
    document_type: "presidential_document",
    publication_date: "2026-04-01",
    agency: "Executive Office of the President",
    fr_citation: "91 FR 15000",
    fr_volume: 91,
    effective_date: "2026-04-01",
    comments_close_date: null,
    fr_action: "Executive order",
    authority: null,
    regulatory_source: null,
    cfr_part: null,
    cfr_subpart: null,
    agencies: '["Executive Office of the President"]',
    cfr_references: null,
    docket_ids: null,
    source_credit: null,
    frontmatter_yaml: YAML_TEMPLATE("fr", "/us/fr/2026-07001"),
    markdown_body: MD_TEMPLATE("Executive Order on Supply Chain Resilience"),
    file_path: "fr/2026/04/2026-07001.md",
    content_hash: "4444444444444444444444444444444444444444444444444444444444444444",
    format_version: "1.1.0",
    generator: "lexbuild-test",
  },
];

/** All fixture documents. */
export const FIXTURE_DOCS = [...USC_DOCS, ...ECFR_DOCS, ...FR_DOCS];

/** Number of fixture documents by source. */
export const FIXTURE_COUNTS = {
  usc: USC_DOCS.length,
  ecfr: ECFR_DOCS.length,
  fr: FR_DOCS.length,
  total: FIXTURE_DOCS.length,
} as const;

const INSERT_SQL =
  `INSERT INTO documents (` +
  `id, source, identifier, title_number, title_name, section_number, section_name, ` +
  `chapter_number, chapter_name, subchapter_number, subchapter_name, part_number, part_name, ` +
  `legal_status, positive_law, status, currency, last_updated, display_title, ` +
  `document_number, document_type, publication_date, agency, ` +
  `fr_citation, fr_volume, effective_date, comments_close_date, fr_action, ` +
  `authority, regulatory_source, cfr_part, cfr_subpart, ` +
  `agencies, cfr_references, docket_ids, source_credit, ` +
  `frontmatter_yaml, markdown_body, file_path, content_hash, format_version, generator` +
  `) VALUES (` +
  `@id, @source, @identifier, @title_number, @title_name, @section_number, @section_name, ` +
  `@chapter_number, @chapter_name, @subchapter_number, @subchapter_name, @part_number, @part_name, ` +
  `@legal_status, @positive_law, @status, @currency, @last_updated, @display_title, ` +
  `@document_number, @document_type, @publication_date, @agency, ` +
  `@fr_citation, @fr_volume, @effective_date, @comments_close_date, @fr_action, ` +
  `@authority, @regulatory_source, @cfr_part, @cfr_subpart, ` +
  `@agencies, @cfr_references, @docket_ids, @source_credit, ` +
  `@frontmatter_yaml, @markdown_body, @file_path, @content_hash, @format_version, @generator` +
  `)`;

function buildFixtureApiAggregates(): ApiAggregates {
  const frYears = new Map<number, FrYearAggregate>();
  for (const doc of FR_DOCS) {
    if (!doc.publication_date) continue;
    const year = Number.parseInt(doc.publication_date.slice(0, 4), 10);
    const month = Number.parseInt(doc.publication_date.slice(5, 7), 10);
    const existing = frYears.get(year);
    if (existing) {
      existing.document_count += 1;
      const monthEntry = existing.months.find((entry: FrYearAggregate["months"][number]) => entry.month === month);
      if (monthEntry) {
        monthEntry.document_count += 1;
      } else {
        existing.months.push({ month, document_count: 1 });
      }
      continue;
    }

    frYears.set(year, {
      year,
      document_count: 1,
      months: [{ month, document_count: 1 }],
    });
  }

  return {
    total_documents: FIXTURE_COUNTS.total,
    sources: {
      usc: {
        document_count: FIXTURE_COUNTS.usc,
        title_count: 2,
        last_updated: "2024-01-03",
      },
      ecfr: {
        document_count: FIXTURE_COUNTS.ecfr,
        title_count: 2,
        last_updated: "2024-04-01",
      },
      fr: {
        document_count: FIXTURE_COUNTS.fr,
        earliest_publication_date: "2026-03-15",
        latest_publication_date: "2026-04-01",
        document_types: {
          rule: 1,
          proposed_rule: 1,
          notice: 1,
          presidential_document: 1,
        },
        years: Array.from(frYears.values()),
      },
    },
  };
}

/**
 * Create and populate a test database at the given path.
 * Uses the real schema from @lexbuild/core with fixture data.
 */
export function createTestDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  db.exec(DOCUMENTS_TABLE_SQL);
  db.exec(SCHEMA_META_TABLE_SQL);
  for (const sql of INDEXES_SQL) {
    db.exec(sql);
  }

  db.prepare("INSERT INTO schema_meta (key, value) VALUES ('schema_version', ?)").run(String(SCHEMA_VERSION));
  db.prepare("INSERT INTO schema_meta (key, value) VALUES (?, ?)").run(
    API_AGGREGATES_META_KEY,
    JSON.stringify(buildFixtureApiAggregates()),
  );

  const insert = db.prepare(INSERT_SQL);
  const insertMany = db.transaction((docs: FixtureDoc[]) => {
    for (const doc of docs) {
      insert.run(doc);
    }
  });
  insertMany(FIXTURE_DOCS);

  return db;
}
