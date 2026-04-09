---
applyTo: "apps/astro/src/**/*.{astro,ts,tsx,css}"
---

# Astro UI Instructions

These instructions apply to the Astro web app and docs site.

- Preserve the existing Astro 6 SSR plus React island architecture. Keep complex typed logic in frontmatter or TypeScript modules; Astro template expressions are plain JavaScript, not TypeScript.
- The Astro app consumes generated content as data. Do not import converter package code into the app.
- Tailwind CSS uses the Tailwind 4 `@tailwindcss/vite` integration. Keep styling aligned with the current setup instead of introducing a parallel styling system.
- The design system is existing LexBuild UI, not a blank-slate redesign:
  - IBM Plex Sans, Serif, and Mono are the only site fonts
  - shadcn/ui is configured with the `radix-nova` preset and zinc base theme
  - preserve the slate-blue accent system and semantic tokens in `src/styles/global.css`
- Prefer Tailwind utilities in templates. Use scoped CSS only when Tailwind cannot express the rule cleanly.
- Tailwind 4 `@theme inline` values are build-time only. When scoped CSS needs theme-aware values, use runtime CSS variables from `:root` and `.dark`.
- Keep interactive UI accessible: keyboard support, visible focus states, labels for icon buttons, and sane dialog or sheet semantics.
- Search is environment-sensitive:
  - `ENABLE_SEARCH` gates rendering of the search UI
  - `MEILI_URL` starting with `/` means proxy mode through the app
  - do not expose server-only Meilisearch credentials in browser code
  - keep `src/lib/search.ts` and `src/components/search/SearchDialog.tsx` aligned when search behavior changes
- Docs UI and content are linked:
  - docs pages live in `src/content/docs/`
  - docs navigation lives in `src/lib/docs-nav.ts`
  - the interactive API reference lives in `src/components/api-reference/ApiReference.tsx`
- Keep markdown rendering and content safety intact. Do not weaken sanitization or bypass the existing markdown pipeline when changing content display.
- For third-party embedded UI such as Scalar, use the existing theme and integration points instead of trying to style internals with unrelated Tailwind classes.