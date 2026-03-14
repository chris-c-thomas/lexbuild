# Testing

LexBuild uses [Vitest](https://vitest.dev/) as its test framework across all packages. Tests are co-located with source files, snapshot tests guard output stability against pinned expected files, and a shared fixtures directory provides synthetic XML inputs that the entire test suite builds on. This guide covers how to run tests, how to write new ones, and how the fixture and snapshot system works.

## Test Framework

Each package has its own `vitest.config.ts` at its root:

- `packages/core/vitest.config.ts`
- `packages/usc/vitest.config.ts`
- `packages/cli/vitest.config.ts`

All configurations use `environment: "node"` with `globals: false`, meaning you must explicitly import Vitest functions (`describe`, `it`, `expect`) in every test file.

## Running Tests

### All packages

```bash
pnpm turbo test
```

This runs tests across all packages in the monorepo. Turborepo ensures that each package is built before its tests run.

### A single package

Use `--filter` to scope to one package:

```bash
pnpm turbo test --filter=@lexbuild/core
pnpm turbo test --filter=@lexbuild/usc
pnpm turbo test --filter=@lexbuild/cli
```

### A single test file

To run one specific test file, use `pnpm exec vitest` from the package directory:

```bash
cd packages/usc
pnpm exec vitest run src/converter.test.ts
```

Or run it in watch mode for rapid iteration:

```bash
cd packages/usc
pnpm exec vitest src/converter.test.ts
```

## Co-Located Test Files

Test files live alongside the source files they test, using the `.test.ts` suffix:

```
packages/core/src/ast/
  ├── builder.ts
  ├── builder.test.ts
  ├── types.ts
packages/usc/src/
  ├── converter.ts
  ├── converter.test.ts
  ├── downloader.ts
  ├── downloader.test.ts
  ├── snapshot.test.ts
```

This convention makes it easy to find the tests for any module -- they are always in the same directory.

## Test Structure and Naming

### `describe` blocks

Organize `describe` blocks to mirror the module's exported API. Each public function or behavior gets its own block:

```typescript
import { describe, it, expect } from "vitest";

describe("convertTitle", () => {
  describe("section granularity", () => {
    it("writes one file per section into chapter directories", async () => {
      // ...
    });
  });

  describe("duplicate sections", () => {
    it("disambiguates with -2 suffix for second occurrence", async () => {
      // ...
    });
  });
});
```

### Descriptive test names

Test names should read as complete descriptions of the behavior being tested. Include the input characteristics and expected outcome:

```typescript
// Good -- describes input and expected behavior
it("converts <subsection> with chapeau to indented bold-lettered paragraph")
it("disambiguates duplicate section numbers with -2 suffix")
it("skips <section> elements inside <quotedContent>")
it("renders XHTML table as Markdown pipe table")

// Avoid -- too vague
it("works correctly")
it("handles edge case")
```

## Test Fixtures

LexBuild uses a shared fixtures directory at the repository root with two subdirectories:

### `fixtures/fragments/` -- XML inputs

Small, synthetic XML snippets that exercise specific features or edge cases. These are committed to the repository and used by unit and snapshot tests.

Current fixtures:

| File | Tests |
|------|-------|
| `simple-section.xml` | Basic section with heading, content, and source credit |
| `section-with-subsections.xml` | Nested subsection hierarchy with chapeau |
| `section-with-notes.xml` | Editorial notes, statutory notes, and amendment history |
| `section-with-table.xml` | XHTML table inside a section |
| `section-with-layout.xml` | USLM layout table (column-based) |
| `section-with-status.xml` | Sections with repealed, transferred, reserved, and current statuses |
| `duplicate-sections.xml` | Multiple sections sharing the same number within a chapter |

These fixtures are intentionally small (1-2 KB each) -- just enough XML to exercise the behavior under test without unnecessary noise.

### `fixtures/expected/` -- Pinned output

Expected Markdown output files that snapshot tests compare against. Each file corresponds to a specific fixture and conversion configuration:

| File | Fixture | Configuration |
|------|---------|---------------|
| `simple-section.md` | `simple-section.xml` | Default (all notes, section granularity) |
| `subsections.md` | `section-with-subsections.xml` | Default |
| `notes-all.md` | `section-with-notes.xml` | All notes included |
| `notes-none.md` | `section-with-notes.xml` | All notes excluded |
| `notes-amendments-only.md` | `section-with-notes.xml` | Only amendment notes |
| `notes-statutory-only.md` | `section-with-notes.xml` | Only statutory notes |
| `table.md` | `section-with-table.xml` | Default |
| `layout.md` | `section-with-layout.xml` | Default |
| `title-granularity.md` | `simple-section.xml` | Title granularity mode |
| `duplicate-first.md` | `duplicate-sections.xml` | First occurrence |
| `duplicate-second.md` | `duplicate-sections.xml` | Second occurrence (suffixed) |
| `duplicate-other.md` | `duplicate-sections.xml` | Non-duplicate sibling |
| `status-repealed.md` | `section-with-status.xml` | Repealed section |
| `status-transferred.md` | `section-with-status.xml` | Transferred section |
| `status-reserved.md` | `section-with-status.xml` | Reserved section |
| `status-current.md` | `section-with-status.xml` | Current section (no status field) |

### `downloads/usc/xml/` -- Full XML files

The complete U.S. Code XML files downloaded from the OLRC (e.g., `usc01.xml` through `usc54.xml`). These are gitignored because they total approximately 650 MB. Download them with the CLI if you need to run manual integration tests against real data:

```bash
node packages/cli/dist/index.js download --titles 1
node packages/cli/dist/index.js download --all
```

## Snapshot Tests

Snapshot tests are the primary mechanism for catching unintended changes to Markdown output. They live in `packages/usc/src/snapshot.test.ts` and work by converting a fixture XML file, then comparing the rendered Markdown against a pinned expected file in `fixtures/expected/`.

### How they work

Each snapshot test follows this pattern:

1. Create a temporary output directory.
2. Call `convertTitle()` with a fixture XML file and specific options.
3. Read the generated Markdown file from the temp directory.
4. Compare it against the corresponding file in `fixtures/expected/` using Vitest's `toMatchFileSnapshot()`.
5. Clean up the temp directory.

If the output differs from the expected file in any way, the test fails and shows a diff of the changes.

### Updating snapshots

When you intentionally change how Markdown is rendered -- for example, changing how notes are formatted or adjusting heading levels -- the snapshot tests will fail. To update the expected files:

```bash
cd packages/usc
pnpm exec vitest run --update
```

This regenerates all expected files in `fixtures/expected/`. After updating:

1. **Review every changed file carefully.** Run `git diff fixtures/expected/` and inspect each change. Confirm that every difference is a direct consequence of your intentional rendering change.
2. **Watch for unintended side effects.** A change to note rendering should not alter how tables or subsections are rendered. If unrelated snapshots changed, investigate before committing.
3. **Commit the updated snapshots with your code change.** The snapshot files and the code change that caused them to update should be in the same commit.

### When to update snapshots

Update snapshots only when you have intentionally changed the rendering output. Valid reasons include:

- Adding a new Markdown formatting rule (e.g., rendering a new element type)
- Changing how existing elements are rendered (e.g., adjusting indentation or heading levels)
- Modifying frontmatter fields or structure
- Changing how notes are filtered or categorized

Do not update snapshots to "fix" a failing test without understanding why the output changed. If a snapshot fails unexpectedly, it likely means your code change has an unintended side effect that needs to be addressed.

## Writing Tests for New Features

When adding a new feature or fixing a bug, follow this workflow:

### 1. Create a fixture (if needed)

If your change involves a new XML pattern or edge case that existing fixtures do not cover, create a new fixture in `fixtures/fragments/`:

```bash
# Create a new fixture file
# Keep it minimal -- just enough XML to exercise the behavior
```

A fixture is a minimal USLM XML document wrapped in `<uscDoc>`, `<meta>`, and `<main>` elements. Look at `fixtures/fragments/simple-section.xml` as a template. Include only the elements needed to test the behavior -- keep fixtures small and focused.

### 2. Write the test first

Write the test before (or alongside) the implementation. For unit tests, add a `.test.ts` file next to the module you are changing. For output-related changes, add a snapshot test in `packages/usc/src/snapshot.test.ts`:

```typescript
it("renders <proviso> text inline within content", async () => {
  const result = await convertTitle({
    ...DEFAULTS,
    input: resolve(FIXTURES_DIR, "section-with-proviso.xml"),
    output: outputDir,
  });

  const content = await readFile(result.files[0]!, "utf-8");
  await expect(content).toMatchFileSnapshot(
    join(EXPECTED_DIR, "proviso.md"),
  );
});
```

### 3. Add expected output (for snapshot tests)

The first time you run a new snapshot test, the expected file will not exist. Vitest will create it automatically. Review the generated file to confirm it matches your expectations, then commit it alongside your test.

Alternatively, you can write the expected Markdown file by hand first if you want to define the contract before implementing the feature.

### 4. Run your tests

```bash
# Run the specific package's tests
pnpm turbo test --filter=@lexbuild/usc

# Or run a single file for faster iteration
cd packages/usc
pnpm exec vitest run src/snapshot.test.ts
```

### 5. Run the full suite before submitting

Always verify that your changes do not break anything in other packages:

```bash
pnpm turbo test && pnpm turbo lint && pnpm turbo typecheck
```

## Tips

- **Keep fixtures minimal.** A fixture that tests table rendering should not also include notes, cross-references, and status attributes unless those are relevant to the test.
- **One behavior per test.** Each `it()` block should test one thing. If you are testing how notes are filtered under different configurations, write a separate test for each configuration (as the existing notes snapshot tests demonstrate).
- **Use temp directories.** Snapshot tests create temporary output directories with `mkdtemp` and clean them up in `afterEach`. Follow the same pattern for any test that writes files.
- **Test edge cases explicitly.** The U.S. Code XML contains many anomalous structures (duplicate sections, missing headings, non-standard nesting). If you encounter a new edge case, add a fixture and test for it so it stays covered.
