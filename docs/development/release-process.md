# Release Process

LexBuild uses [Changesets](https://github.com/changesets/changesets) for versioning and GitHub Actions for automated npm releases. All four published packages (`@lexbuild/core`, `@lexbuild/usc`, `@lexbuild/ecfr`, `@lexbuild/cli`) are versioned in lockstep -- when any package gets a version bump, all four move to the same version number.

## Lockstep Versioning

Lockstep versioning is configured via the `fixed` array in `.changeset/config.json`:

```json
{
  "fixed": [["@lexbuild/core", "@lexbuild/usc", "@lexbuild/ecfr", "@lexbuild/cli"]]
}
```

This means a changeset targeting any one of these packages causes all four to receive the same version bump. The Astro web app is excluded from versioning entirely -- it is listed in the `ignore` array and marked `"private": true`.

## Creating a Changeset

After making changes that should be included in a release, create a changeset:

```bash
pnpm changeset
```

The interactive prompt walks through three decisions:

1. **Select packages** -- choose which packages are affected by the change
2. **Choose bump type** -- patch, minor, or major
3. **Write a summary** -- a human-readable description of what changed

This creates a `.changeset/*.md` file describing the change. Commit this file along with the code changes.

### Version Bump Types

| Type | When to Use |
|------|-------------|
| `patch` | Bug fixes, internal refactors, documentation-only changes |
| `minor` | New features, new CLI commands, backward-compatible additions |
| `major` | Breaking changes to the output format, API, or CLI interface |

When multiple changesets exist for the same release, the highest bump type wins. For example, if one changeset specifies `patch` and another specifies `minor`, the resulting release is a `minor` bump.

## The Release Flow

The full release lifecycle involves seven steps, split between developer actions and CI automation:

### 1. Create a changeset

Run `pnpm changeset`, select packages, choose bump type, and write a summary. Commit the generated `.changeset/*.md` file as part of your PR.

### 2. CI validates the PR

The [CI pipeline](ci-cd.md) runs build, lint, typecheck, and test on Node.js 22 and 24. Both must pass.

### 3. Merge the PR to main

Standard GitHub merge. The changeset file is now on `main`.

### 4. Publish workflow detects changesets

The [Publish pipeline](ci-cd.md) runs on every push to `main`. When it finds unreleased changeset files, it runs `pnpm version-packages` (`changeset version`), which:

- Bumps versions in all four `package.json` files (lockstep)
- Updates `CHANGELOG.md` in each package
- Consumes (deletes) the `.changeset/*.md` files

### 5. Release PR opens or updates

The Changesets GitHub Action opens a PR titled "chore: version packages" containing the version bumps and changelog updates. If a release PR already exists, it is updated with the latest changes. This PR accumulates all pending changesets until merged.

### 6. Merge the release PR

Review the version bumps and changelog entries, then merge. This puts the updated `package.json` files and changelogs on `main` with no remaining changeset files.

### 7. Publish to npm

The Publish workflow runs again on the merge commit. With no changeset files remaining, it enters publish mode: `pnpm release` (`changeset publish`) publishes all four packages to npm with provenance attestation.

## Workspace Protocol

During development, internal dependencies use pnpm's `workspace:*` protocol:

```json
{
  "dependencies": {
    "@lexbuild/core": "workspace:*"
  }
}
```

This resolves to the local copy in the monorepo. When `changeset publish` runs, pnpm automatically replaces `workspace:*` with the concrete version number (e.g., `"1.10.1"`) in the published `package.json`.

The `updateInternalDependencies: "patch"` setting in the changeset config ensures that when a dependency bumps, its dependents also get their internal dependency version updated.

## Changeset Configuration

The full `.changeset/config.json`:

| Setting | Value | Purpose |
|---------|-------|---------|
| `fixed` | `[["@lexbuild/core", "@lexbuild/usc", "@lexbuild/ecfr", "@lexbuild/cli"]]` | Lockstep versioning across all published packages |
| `access` | `"public"` | Publish as public npm packages |
| `baseBranch` | `"main"` | Compare changesets against `main` |
| `commit` | `false` | The GitHub Action handles commits, not the CLI |
| `changelog` | `"@changesets/cli/changelog"` | Built-in changelog generator |
| `updateInternalDependencies` | `"patch"` | Bump internal dependency versions on release |
| `ignore` | `["@lexbuild/astro"]` | Exclude the Astro web app from versioning |

## Quick Reference

```bash
# Create a changeset (interactive)
pnpm changeset

# Preview version bumps locally (does not publish)
pnpm version-packages

# Build and publish (normally done by CI, not locally)
pnpm release
```
