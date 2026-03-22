# Testing

LexBuild uses Vitest across all packages with co-located test files, snapshot-based output stability checks, and shared fixtures.

## Test Framework

Each package has a `vitest.config.ts` with a consistent configuration:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
  },
});
```

The `globals: false` setting means all Vitest functions (`describe`, `it`, `expect`, etc.) must be explicitly imported.

## Running Tests

| Command | Scope |
|---|---|
| `pnpm turbo test` | All packages |
| `pnpm turbo test --filter=@lexbuild/core` | Core package only |
| `pnpm turbo test --filter=@lexbuild/usc` | USC package only |
| `pnpm turbo test --filter=@lexbuild/ecfr` | eCFR package only |
| `pnpm turbo test --filter=@lexbuild/cli` | CLI package only |

To run a single test file or use watch mode, `cd` into the package directory:

```bash
# Run a single file
cd packages/usc
pnpm exec vitest run src/converter.test.ts

# Watch mode (re-runs on save)
cd packages/usc
pnpm exec vitest src/converter.test.ts
```

## Co-Located Test Files

Tests live alongside their source files. A module and its tests share the same directory:

```
packages/core/src/xml/
├── parser.ts
├── parser.test.ts
├── uslm-elements.ts
└── uslm-elements.test.ts

packages/usc/src/
├── converter.ts
├── converter.test.ts
├── downloader.ts
└── downloader.test.ts
```

## Test Structure and Naming

Use `describe` blocks that mirror the module's exported API. Write descriptive test names that state the specific behavior under test:

```typescript
describe("renderSection", () => {
  it("converts <subsection> with chapeau to indented bold-lettered paragraph", () => {
    // ...
  });

  it("renders multiple <p> elements as separate paragraphs", () => {
    // ...
  });
});
```

Avoid vague names like "works correctly" or "handles edge case." The test name should describe what goes in and what comes out.

## Test Fixtures

### `fixtures/fragments/` -- XML Inputs

Small, synthetic XML snippets committed to the repository. Each fixture isolates a specific structure or edge case:

| Fixture | Tests |
|---|---|
| `simple-section.xml` | Basic section with heading and content |
| `section-with-subsections.xml` | Nested subsections with chapeau |
| `section-with-notes.xml` | Editorial, statutory, and amendment notes |
| `section-with-table.xml` | XHTML namespace table |
| `section-with-layout.xml` | USLM layout (column-based display) |
| `section-with-status.xml` | Repealed, transferred, reserved, and current sections |
| `duplicate-sections.xml` | Multiple sections with the same number |

eCFR-specific fixtures live in `fixtures/fragments/ecfr/`:

| Fixture | Tests |
|---|---|
| `simple-section.xml` | Basic eCFR section with authority citation |
| `section-with-authority.xml` | Authority and source notes |
| `section-with-emphasis.xml` | Inline formatting in regulatory text |
| `section-with-notes.xml` | eCFR editorial notes |
| `section-with-table.xml` | Tables in regulatory text |
| `appendix.xml` | Appendix structure |
| `title-structure.xml` | Full title/chapter/part/section hierarchy |

### `fixtures/expected/` -- Pinned Output

Expected Markdown output for snapshot comparison. Each file corresponds to a test case:

| Expected File | Verifies |
|---|---|
| `simple-section.md` | Basic section rendering |
| `subsections.md` | Subsection hierarchy and indentation |
| `notes-all.md` | All notes included (default) |
| `notes-none.md` | All notes excluded |
| `notes-amendments-only.md` | Selective amendment note inclusion |
| `notes-statutory-only.md` | Selective statutory note inclusion |
| `table.md` | XHTML table rendering |
| `layout.md` | Layout table rendering |
| `title-granularity.md` | Title-level output with enriched frontmatter |
| `duplicate-first.md` | First occurrence of a duplicate section |
| `duplicate-second.md` | Second occurrence (suffixed `-2`) |
| `duplicate-other.md` | Non-duplicate sibling section |
| `status-repealed.md` | Repealed section frontmatter and body |
| `status-transferred.md` | Transferred section |
| `status-reserved.md` | Reserved section |
| `status-current.md` | Current section (no status field) |

### `downloads/` -- Full XML Files (Gitignored)

Full title XML files downloaded via the CLI. These are not committed to the repository due to their size (approximately 650 MB for all USC titles, 830 MB for all eCFR titles). Download them locally when needed for integration testing:

```bash
node packages/cli/dist/index.js download-usc --all
node packages/cli/dist/index.js download-ecfr --all
```

## Snapshot Tests

Snapshot tests are the primary mechanism for catching unintended changes to Markdown output. The USC snapshot suite lives in `packages/usc/src/snapshot.test.ts`.

The pattern:

1. Create a temporary output directory.
2. Call `convertTitle()` with a fixture XML file and known options.
3. Read the generated Markdown file.
4. Compare against the pinned expected file in `fixtures/expected/`.
5. Clean up the temporary directory.

```typescript
it("simple-section", async () => {
  const result = await convertTitle({
    ...DEFAULTS,
    input: resolve(FIXTURES_DIR, "simple-section.xml"),
    output: outputDir,
  });

  const content = await readFile(result.files[0]!, "utf-8");
  await expect(content).toMatchFileSnapshot(join(EXPECTED_DIR, "simple-section.md"));
});
```

### Updating Snapshots

When you intentionally change rendering behavior, update the expected output:

```bash
cd packages/usc
pnpm exec vitest run --update
```

After updating, review the changes carefully:

```bash
git diff fixtures/expected/
```

Commit the updated snapshot files alongside the code change that caused them.

### When to Update vs. Fix

- **Update**: You intentionally changed rendering logic (added a new element handler, adjusted heading levels, modified frontmatter fields). The snapshot diff matches your intent.
- **Fix**: A snapshot changed unexpectedly. Investigate side effects before updating. An unintended change to `simple-section.md` while modifying table rendering is a red flag.

## Writing Tests for New Features

1. **Create a fixture** (if needed) in `fixtures/fragments/`. Keep it minimal -- just enough XML to exercise the feature.
2. **Write the test first.** Define the expected behavior before implementing.
3. **Add expected output.** Either write it manually or let the first test run generate it with `--update`.
4. **Run the targeted test** to verify your implementation.
5. **Run the full suite** before submitting to catch regressions:

```bash
pnpm turbo test
```
