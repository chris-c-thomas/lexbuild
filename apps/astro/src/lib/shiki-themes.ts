import type { ThemeRegistration } from "shiki";

/**
 * LexBuild brand themes for syntax highlighting.
 * Uses all 3 brand palettes for clear visual hierarchy:
 *   - Putty (warm brown/gold) for headings — most prominent
 *   - Slate-blue (cool blue) for body text, structural punctuation, blockquotes
 *   - Summer-green for bold/emphasis markers and code
 *
 * Shared between the runtime Shiki singleton (src/lib/shiki.ts) and the
 * pre-render script (scripts/generate-highlights.ts). Both must use the same
 * themes to produce consistent output.
 */
export const lexbuildLight: ThemeRegistration = {
  name: "lexbuild-light",
  type: "light",
  colors: {
    "editor.background": "#00000000",
    "editor.foreground": "#1f2c38",
  },
  tokenColors: [
    // YAML
    { scope: ["entity.name.tag.yaml"], settings: { foreground: "#476c85" } },
    { scope: ["string.quoted", "string.unquoted"], settings: { foreground: "#975826" } },
    { scope: ["constant.numeric", "constant.language"], settings: { foreground: "#487061" } },
    { scope: ["punctuation", "keyword.control.flow"], settings: { foreground: "#94b7c7" } },
    // Markdown — headings (putty palette — warm brown, distinct from cool body text)
    {
      scope: ["markup.heading", "entity.name.section.markdown"],
      settings: { foreground: "#643c21", fontStyle: "bold" },
    },
    { scope: ["punctuation.definition.heading"], settings: { foreground: "#975826" } },
    // Markdown — emphasis (summer-green for bold, slate-blue for italic)
    { scope: ["markup.bold"], settings: { foreground: "#3e5b51", fontStyle: "bold" } },
    { scope: ["punctuation.definition.bold"], settings: { foreground: "#6fa48e" } },
    { scope: ["markup.italic"], settings: { foreground: "#476c85", fontStyle: "italic" } },
    { scope: ["punctuation.definition.italic"], settings: { foreground: "#476c85" } },
    // Markdown — links
    { scope: ["string.other.link.title", "meta.link.inline"], settings: { foreground: "#476c85" } },
    { scope: ["markup.underline.link"], settings: { foreground: "#476c85" } },
    // Markdown — code
    { scope: ["markup.inline.raw"], settings: { foreground: "#487061" } },
    // Markdown — lists
    { scope: ["punctuation.definition.list"], settings: { foreground: "#476c85" } },
    { scope: ["markup.list"], settings: { foreground: "#1f2c38" } },
    // Markdown — blockquotes
    { scope: ["markup.quote"], settings: { foreground: "#476c85", fontStyle: "italic" } },
    { scope: ["punctuation.definition.quote"], settings: { foreground: "#476c85" } },
    // Markdown — horizontal rule / separators
    { scope: ["markup.heading.setext"], settings: { foreground: "#476c85" } },
    { scope: ["meta.separator"], settings: { foreground: "#476c85" } },
  ],
};

export const lexbuildDark: ThemeRegistration = {
  name: "lexbuild-dark",
  type: "dark",
  colors: {
    "editor.background": "#00000000",
    "editor.foreground": "#d3e3e9",
  },
  tokenColors: [
    // YAML
    { scope: ["entity.name.tag.yaml"], settings: { foreground: "#b4cfda" } },
    { scope: ["string.quoted", "string.unquoted"], settings: { foreground: "#f1dfb6" } },
    { scope: ["constant.numeric", "constant.language"], settings: { foreground: "#98b8ab" } },
    { scope: ["punctuation", "keyword.control.flow"], settings: { foreground: "#ffffff40" } },
    // Markdown — headings (putty palette — warm gold, distinct from cool body text)
    {
      scope: ["markup.heading", "entity.name.section.markdown"],
      settings: { foreground: "#e7c788", fontStyle: "bold" },
    },
    { scope: ["punctuation.definition.heading"], settings: { foreground: "#dca756" } },
    // Markdown — emphasis (summer-green for bold, slate-blue for italic)
    { scope: ["markup.bold"], settings: { foreground: "#b8d1c5", fontStyle: "bold" } },
    { scope: ["punctuation.definition.bold"], settings: { foreground: "#6fa48e" } },
    { scope: ["markup.italic"], settings: { foreground: "#b4cfda", fontStyle: "italic" } },
    { scope: ["punctuation.definition.italic"], settings: { foreground: "#6c9fb7" } },
    // Markdown — links
    { scope: ["string.other.link.title", "meta.link.inline"], settings: { foreground: "#8ab8d0" } },
    { scope: ["markup.underline.link"], settings: { foreground: "#6c9fb7" } },
    // Markdown — code
    { scope: ["markup.inline.raw"], settings: { foreground: "#98b8ab" } },
    // Markdown — lists
    { scope: ["punctuation.definition.list"], settings: { foreground: "#6c9fb7" } },
    { scope: ["markup.list"], settings: { foreground: "#d3e3e9" } },
    // Markdown — blockquotes
    { scope: ["markup.quote"], settings: { foreground: "#b4cfda", fontStyle: "italic" } },
    { scope: ["punctuation.definition.quote"], settings: { foreground: "#6c9fb7" } },
    // Markdown — horizontal rule / separators
    { scope: ["markup.heading.setext"], settings: { foreground: "#6c9fb7" } },
    { scope: ["meta.separator"], settings: { foreground: "#6c9fb7" } },
  ],
};
