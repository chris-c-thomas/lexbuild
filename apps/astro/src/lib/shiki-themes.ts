import type { ThemeRegistration } from "shiki";

/**
 * LexBuild brand themes for syntax highlighting.
 * Uses slate-blue, summer-green, and putty palettes for both YAML and Markdown.
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
    "editor.foreground": "#354754",
  },
  tokenColors: [
    // YAML
    { scope: ["entity.name.tag.yaml"], settings: { foreground: "#476c85" } },
    { scope: ["string.quoted", "string.unquoted"], settings: { foreground: "#975826" } },
    { scope: ["constant.numeric", "constant.language"], settings: { foreground: "#558b75" } },
    { scope: ["punctuation", "keyword.control.flow"], settings: { foreground: "#94b7c7" } },
    // Markdown — headings
    { scope: ["markup.heading", "entity.name.section.markdown"], settings: { foreground: "#3f5869", fontStyle: "bold" } },
    { scope: ["punctuation.definition.heading"], settings: { foreground: "#94b7c7" } },
    // Markdown — emphasis
    { scope: ["markup.bold"], settings: { foreground: "#487061", fontStyle: "bold" } },
    { scope: ["punctuation.definition.bold"], settings: { foreground: "#98b8ab" } },
    { scope: ["markup.italic"], settings: { foreground: "#476c85", fontStyle: "italic" } },
    // Markdown — links
    { scope: ["string.other.link.title", "meta.link.inline"], settings: { foreground: "#5285a3" } },
    { scope: ["markup.underline.link"], settings: { foreground: "#94b7c7" } },
    // Markdown — code
    { scope: ["markup.inline.raw"], settings: { foreground: "#558b75" } },
    // Markdown — lists
    { scope: ["punctuation.definition.list"], settings: { foreground: "#6c9fb7" } },
    { scope: ["markup.list"], settings: { foreground: "#354754" } },
    // Markdown — blockquotes
    { scope: ["markup.quote"], settings: { foreground: "#476c85", fontStyle: "italic" } },
    { scope: ["punctuation.definition.quote"], settings: { foreground: "#94b7c7" } },
    // Markdown — horizontal rule
    { scope: ["markup.heading.setext"], settings: { foreground: "#94b7c7" } },
  ],
};

export const lexbuildDark: ThemeRegistration = {
  name: "lexbuild-dark",
  type: "dark",
  colors: {
    "editor.background": "#00000000",
    "editor.foreground": "#c4d0dc",
  },
  tokenColors: [
    // YAML
    { scope: ["entity.name.tag.yaml"], settings: { foreground: "#b4cfda" } },
    { scope: ["string.quoted", "string.unquoted"], settings: { foreground: "#f1dfb6" } },
    { scope: ["constant.numeric", "constant.language"], settings: { foreground: "#98b8ab" } },
    { scope: ["punctuation", "keyword.control.flow"], settings: { foreground: "#ffffff40" } },
    // Markdown — headings
    { scope: ["markup.heading", "entity.name.section.markdown"], settings: { foreground: "#d3e3e9", fontStyle: "bold" } },
    { scope: ["punctuation.definition.heading"], settings: { foreground: "#ffffff40" } },
    // Markdown — emphasis
    { scope: ["markup.bold"], settings: { foreground: "#b8d1c5", fontStyle: "bold" } },
    { scope: ["punctuation.definition.bold"], settings: { foreground: "#6fa48e" } },
    { scope: ["markup.italic"], settings: { foreground: "#b4cfda", fontStyle: "italic" } },
    // Markdown — links
    { scope: ["string.other.link.title", "meta.link.inline"], settings: { foreground: "#8ab8d0" } },
    { scope: ["markup.underline.link"], settings: { foreground: "#ffffff40" } },
    // Markdown — code
    { scope: ["markup.inline.raw"], settings: { foreground: "#98b8ab" } },
    // Markdown — lists
    { scope: ["punctuation.definition.list"], settings: { foreground: "#6c9fb7" } },
    { scope: ["markup.list"], settings: { foreground: "#c4d0dc" } },
    // Markdown — blockquotes
    { scope: ["markup.quote"], settings: { foreground: "#b4cfda", fontStyle: "italic" } },
    { scope: ["punctuation.definition.quote"], settings: { foreground: "#ffffff40" } },
    // Markdown — horizontal rule
    { scope: ["markup.heading.setext"], settings: { foreground: "#ffffff40" } },
  ],
};
