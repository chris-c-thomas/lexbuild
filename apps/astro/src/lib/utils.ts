import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Words that should remain lowercase in title case (AP style),
 * unless they are the first or last word.
 */
const MINOR_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "in",
  "nor",
  "of",
  "on",
  "or",
  "so",
  "the",
  "to",
  "up",
  "yet",
]);

/** Known abbreviations that should stay uppercase. */
const PRESERVE_UPPER = new Set(["USC", "CFR", "IRS", "NASA", "FBI", "CIA", "EPA", "FCC", "SEC"]);

/**
 * Converts an ALL-CAPS or mixed-case string to title case.
 * Returns already-mixed-case strings unchanged (only transforms
 * when the input is predominantly uppercase).
 *
 * Handles legal conventions: preserves "U.S.", "D.C.", known
 * abbreviations (USC, CFR), section symbols, and em dashes.
 */
export function toTitleCase(str: string): string {
  if (!str) return str;

  // Only transform strings that are predominantly uppercase.
  // If fewer than 50% of alpha chars are uppercase, return as-is.
  const alphaChars = str.replace(/[^a-zA-Z]/g, "");
  if (alphaChars.length === 0) return str;
  const upperCount = alphaChars.replace(/[^A-Z]/g, "").length;
  if (upperCount / alphaChars.length < 0.5) return str;

  // Split on spaces, preserving whitespace runs
  return str
    .split(/(\s+)/)
    .map((segment, idx, arr) => {
      // Preserve whitespace segments
      if (/^\s+$/.test(segment)) return segment;

      // Preserve abbreviations with periods (U.S., D.C., etc.)
      if (/^[A-Z]\.([A-Z]\.?)+$/.test(segment)) return segment;

      // Preserve known abbreviations
      if (PRESERVE_UPPER.has(segment)) return segment;

      // Preserve section symbol and em/en dashes
      if (segment === "§" || segment === "—" || segment === "–") return segment;

      const lower = segment.toLowerCase();

      // Find the first and last non-whitespace tokens for minor-word logic
      const nonWsTokens = arr.filter((s) => !/^\s+$/.test(s));
      const isFirst = segment === nonWsTokens[0];
      const isLast = segment === nonWsTokens[nonWsTokens.length - 1];

      // Minor words stay lowercase unless first or last
      if (!isFirst && !isLast && MINOR_WORDS.has(lower)) {
        return lower;
      }

      // Capitalize first letter, lowercase the rest
      // Handle leading punctuation (parentheses, quotes)
      return lower.replace(/[a-z]/, (c) => c.toUpperCase());
    })
    .join("");
}
