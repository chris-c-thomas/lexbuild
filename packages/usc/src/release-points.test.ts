import { describe, it, expect } from "vitest";
import { parseReleasePointFromHtml, parseReleasePointHistoryFromHtml } from "./release-points.js";

/**
 * Representative HTML fixture based on the OLRC download page structure.
 * Simplified to the elements that matter for release point extraction.
 */
const OLRC_HTML_FIXTURE = `
<html>
<body>
<h3 class="releasepointinformation">Public Law 119-73 (01/23/2026) , except 119-60</h3>
<div>
  <a href="/releasepoints/us/pl/119/73not60/xml_uscAll@119-73not60.zip">XML (All Titles)</a>
  <a href="/releasepoints/us/pl/119/73not60/xml_usc01@119-73not60.zip">XML</a>
  <a href="/releasepoints/us/pl/119/73not60/xml_usc02@119-73not60.zip">XML</a>
</div>
</body>
</html>
`;

/** Fixture without the bulk download URL (only per-title links) */
const OLRC_HTML_NO_BULK = `
<html>
<body>
<h3 class="releasepointinformation">Public Law 119-80 (03/15/2026)</h3>
<div>
  <a href="/releasepoints/us/pl/119/80/xml_usc01@119-80.zip">XML</a>
  <a href="/releasepoints/us/pl/119/80/xml_usc02@119-80.zip">XML</a>
</div>
</body>
</html>
`;

/** Fixture with multiline h3 content */
const OLRC_HTML_MULTILINE_H3 = `
<html>
<body>
<h3 class="releasepointinformation">
  Public Law 119-73 (01/23/2026) , except 119-60
</h3>
<a href="/releasepoints/us/pl/119/73not60/xml_uscAll@119-73not60.zip">XML</a>
</body>
</html>
`;

/** Fixture with no recognizable release point links */
const OLRC_HTML_NO_LINKS = `
<html>
<body>
<h3 class="releasepointinformation">Public Law 119-73</h3>
<p>No download links here</p>
</body>
</html>
`;

/** Fixture without exclusions in release point */
const OLRC_HTML_NO_EXCLUSIONS = `
<html>
<body>
<h3 class="releasepointinformation">Public Law 119-43 (08/15/2025)</h3>
<a href="/releasepoints/us/pl/119/43/xml_uscAll@119-43.zip">XML</a>
</body>
</html>
`;

describe("parseReleasePointFromHtml", () => {
  it("extracts release point from bulk download URL", () => {
    const result = parseReleasePointFromHtml(OLRC_HTML_FIXTURE);
    expect(result).not.toBeNull();
    expect(result!.releasePoint).toBe("119-73not60");
  });

  it("extracts description from h3 heading", () => {
    const result = parseReleasePointFromHtml(OLRC_HTML_FIXTURE);
    expect(result).not.toBeNull();
    expect(result!.description).toBe("Public Law 119-73 (01/23/2026) , except 119-60");
  });

  it("falls back to single-title URL when bulk URL is absent", () => {
    const result = parseReleasePointFromHtml(OLRC_HTML_NO_BULK);
    expect(result).not.toBeNull();
    expect(result!.releasePoint).toBe("119-80");
    expect(result!.description).toBe("Public Law 119-80 (03/15/2026)");
  });

  it("handles release points without exclusion suffixes", () => {
    const result = parseReleasePointFromHtml(OLRC_HTML_NO_EXCLUSIONS);
    expect(result).not.toBeNull();
    expect(result!.releasePoint).toBe("119-43");
  });

  it("handles multiline h3 content", () => {
    const result = parseReleasePointFromHtml(OLRC_HTML_MULTILINE_H3);
    expect(result).not.toBeNull();
    expect(result!.releasePoint).toBe("119-73not60");
    expect(result!.description).toBe("Public Law 119-73 (01/23/2026) , except 119-60");
  });

  it("returns null when no download links are found", () => {
    const result = parseReleasePointFromHtml(OLRC_HTML_NO_LINKS);
    expect(result).toBeNull();
  });

  it("returns null for empty HTML", () => {
    expect(parseReleasePointFromHtml("")).toBeNull();
  });

  it("returns empty description when h3 is missing", () => {
    const html = `<a href="xml_uscAll@119-80.zip">XML</a>`;
    const result = parseReleasePointFromHtml(html);
    expect(result).not.toBeNull();
    expect(result!.releasePoint).toBe("119-80");
    expect(result!.description).toBe("");
  });
});

// --- parseReleasePointHistoryFromHtml ---

/** Representative HTML fixture based on the OLRC prior release points page */
const PRIOR_RELEASES_FIXTURE = `
<html>
<body>
<ul class="releasepoints">
  <li class="releasepoint">
    <a class="releasepoint" href="releasepoints/us/pl/119/72not60/usc-rp@119-72not60.htm">
      Public Law 119-72 (01/20/2026), except 119-60, affecting titles 38, 42.
    </a>
  </li>
  <li class="releasepoint">
    <a class="releasepoint" href="releasepoints/us/pl/119/69not60/usc-rp@119-69not60.htm">
      Public Law 119-69 (01/14/2026), except 119-60, affecting title 42.
    </a>
  </li>
  <li class="releasepoint">
    <a class="releasepoint" href="releasepoints/us/pl/119/43/usc-rp@119-43.htm">
      Public Law 119-43 (08/15/2025), affecting titles 2, 5, 10, 26, 42.
    </a>
  </li>
</ul>
</body>
</html>
`;

/** Fixture with a single release point (singular "title") */
const PRIOR_RELEASES_SINGLE_TITLE = `
<ul class="releasepoints">
  <li class="releasepoint">
    <a class="releasepoint" href="releasepoints/us/pl/118/200/usc-rp@118-200.htm">
      Public Law 118-200 (12/01/2024), affecting title 26.
    </a>
  </li>
</ul>
`;

/** Fixture with no release point links */
const PRIOR_RELEASES_EMPTY = `
<html><body><p>No releases available.</p></body></html>
`;

describe("parseReleasePointHistoryFromHtml", () => {
  it("extracts multiple release points in order", () => {
    const results = parseReleasePointHistoryFromHtml(PRIOR_RELEASES_FIXTURE);
    expect(results).toHaveLength(3);
    expect(results[0]!.releasePoint).toBe("119-72not60");
    expect(results[1]!.releasePoint).toBe("119-69not60");
    expect(results[2]!.releasePoint).toBe("119-43");
  });

  it("extracts dates from descriptions", () => {
    const results = parseReleasePointHistoryFromHtml(PRIOR_RELEASES_FIXTURE);
    expect(results[0]!.date).toBe("01/20/2026");
    expect(results[1]!.date).toBe("01/14/2026");
    expect(results[2]!.date).toBe("08/15/2025");
  });

  it("extracts affected titles (plural)", () => {
    const results = parseReleasePointHistoryFromHtml(PRIOR_RELEASES_FIXTURE);
    expect(results[0]!.affectedTitles).toEqual([38, 42]);
    expect(results[2]!.affectedTitles).toEqual([2, 5, 10, 26, 42]);
  });

  it("extracts affected titles (singular)", () => {
    const results = parseReleasePointHistoryFromHtml(PRIOR_RELEASES_SINGLE_TITLE);
    expect(results).toHaveLength(1);
    expect(results[0]!.affectedTitles).toEqual([26]);
  });

  it("normalizes whitespace in descriptions", () => {
    const results = parseReleasePointHistoryFromHtml(PRIOR_RELEASES_FIXTURE);
    // The fixture has newlines and extra spaces inside <a> tags
    expect(results[0]!.description).not.toContain("\n");
    expect(results[0]!.description).toMatch(
      /^Public Law 119-72 \(01\/20\/2026\), except 119-60, affecting titles 38, 42\.$/,
    );
  });

  it("handles release points without exclusion suffixes", () => {
    const results = parseReleasePointHistoryFromHtml(PRIOR_RELEASES_FIXTURE);
    expect(results[2]!.releasePoint).toBe("119-43");
  });

  it("returns empty array for HTML with no release point links", () => {
    expect(parseReleasePointHistoryFromHtml(PRIOR_RELEASES_EMPTY)).toEqual([]);
  });

  it("returns empty array for empty HTML", () => {
    expect(parseReleasePointHistoryFromHtml("")).toEqual([]);
  });
});
