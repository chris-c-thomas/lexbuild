/**
 * Parses a title specification string into an array of title numbers.
 *
 * Supports single numbers, comma-separated lists, ranges, and mixed:
 * - `"29"` → `[29]`
 * - `"1,3,8,11"` → `[1, 3, 8, 11]`
 * - `"1-5"` → `[1, 2, 3, 4, 5]`
 * - `"1-5,8,11"` → `[1, 2, 3, 4, 5, 8, 11]`
 */
export function parseTitles(input: string, maxTitle = 54): number[] {
  const trimmed = input.trim();
  if (trimmed === "") {
    throw new Error("Title specification cannot be empty");
  }

  const result = new Set<number>();
  const segments = trimmed.split(",");

  for (const segment of segments) {
    const part = segment.trim();
    if (part === "") {
      throw new Error(`Invalid title specification: "${input}" (empty segment)`);
    }

    if (part.includes("-")) {
      const [startStr, endStr, ...rest] = part.split("-");
      if (rest.length > 0 || !startStr || !endStr) {
        throw new Error(`Invalid range: "${part}" (expected format: start-end)`);
      }

      const start = parseIntStrict(startStr, input);
      const end = parseIntStrict(endStr, input);

      if (start > end) {
        throw new Error(`Invalid range: "${part}" (start ${start} must be ≤ end ${end})`);
      }

      validateTitleNumber(start, input, maxTitle);
      validateTitleNumber(end, input, maxTitle);

      for (let i = start; i <= end; i++) {
        result.add(i);
      }
    } else {
      const num = parseIntStrict(part, input);
      validateTitleNumber(num, input, maxTitle);
      result.add(num);
    }
  }

  return [...result].sort((a, b) => a - b);
}

/** Parse an integer strictly — no NaN, no floats. */
function parseIntStrict(str: string, fullInput: string): number {
  const trimmed = str.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid number "${trimmed}" in title specification: "${fullInput}"`);
  }
  return parseInt(trimmed, 10);
}

/** Validate that a title number is in the valid range. */
function validateTitleNumber(num: number, fullInput: string, max = 54): void {
  if (num < 1 || num > max) {
    throw new Error(`Title number ${num} out of range (must be 1-${max}) in: "${fullInput}"`);
  }
}
