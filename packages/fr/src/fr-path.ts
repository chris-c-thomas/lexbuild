/**
 * Output path builder for Federal Register directory structure.
 *
 * FR path structure:
 *   output/fr/{YYYY}/{MM}/{document_number}.md
 *
 * Downloads path structure:
 *   downloads/fr/{YYYY}/{MM}/{document_number}.xml
 *   downloads/fr/{YYYY}/{MM}/{document_number}.json
 */

import { join } from "node:path";

/**
 * Build the output file path for an FR document.
 *
 * @param documentNumber - FR document number (e.g., "2026-06029")
 * @param publicationDate - Publication date in YYYY-MM-DD format
 * @param outputRoot - Output root directory (e.g., "./output")
 * @returns Full output file path (e.g., "output/fr/2026/03/2026-06029.md")
 */
export function buildFrOutputPath(documentNumber: string, publicationDate: string, outputRoot: string): string {
  const { year, month } = parseDateComponents(publicationDate);
  return join(outputRoot, "fr", year, month, `${documentNumber}.md`);
}

/**
 * Build the download file path for an FR document XML.
 *
 * @param documentNumber - FR document number
 * @param publicationDate - Publication date in YYYY-MM-DD format
 * @param downloadRoot - Download root directory (e.g., "./downloads/fr")
 * @returns Full download file path (e.g., "downloads/fr/2026/03/2026-06029.xml")
 */
export function buildFrDownloadXmlPath(documentNumber: string, publicationDate: string, downloadRoot: string): string {
  const { year, month } = parseDateComponents(publicationDate);
  return join(downloadRoot, year, month, `${documentNumber}.xml`);
}

/**
 * Build the download file path for an FR document JSON metadata.
 *
 * @param documentNumber - FR document number
 * @param publicationDate - Publication date in YYYY-MM-DD format
 * @param downloadRoot - Download root directory
 * @returns Full download file path (e.g., "downloads/fr/2026/03/2026-06029.json")
 */
export function buildFrDownloadJsonPath(documentNumber: string, publicationDate: string, downloadRoot: string): string {
  const { year, month } = parseDateComponents(publicationDate);
  return join(downloadRoot, year, month, `${documentNumber}.json`);
}

/**
 * Build the directory path for a year/month within the FR output structure.
 */
export function buildMonthDir(year: string, month: string, outputRoot: string): string {
  return join(outputRoot, "fr", year, month);
}

/**
 * Build the directory path for a year.
 */
export function buildYearDir(year: string, outputRoot: string): string {
  return join(outputRoot, "fr", year);
}

/**
 * Parse a YYYY-MM-DD date string into year and month components.
 */
function parseDateComponents(date: string): { year: string; month: string } {
  const parts = date.split("-");
  return {
    year: parts[0] || "0000",
    month: parts[1] || "00",
  };
}
