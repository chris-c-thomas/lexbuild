/**
 * Static Scalar API reference configuration.
 *
 * These values map directly to Scalar's configuration object — the same shape
 * shown in the "Configure" dev tools panel on localhost. Copy the JSON from
 * that panel here when tweaking settings via the UI.
 *
 * Dynamic values (`url`, `darkMode`) are merged by ApiReference.tsx at runtime.
 */

import type { ApiReferenceConfiguration } from "@scalar/api-reference-react";
import { SCALAR_THEME_CSS } from "./scalar-theme";

export const SCALAR_CONFIG: Partial<ApiReferenceConfiguration> = {
  theme: "none",
  withDefaultFonts: false,
  customCss: SCALAR_THEME_CSS,
  defaultOpenFirstTag: false,
  defaultOpenAllTags: false,
  defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
  hiddenClients: {
    c: true,
    csharp: true,
    clojure: true,
    go: true,
    java: true,
    kotlin: true,
    objc: true,
    ocaml: true,
    php: true,
    powershell: true,
    r: true,
    ruby: true,
    swift: true,
  },
  expandAllResponses: true,
  hideClientButton: true,
  hideDarkModeToggle: true,
  hideModels: true,
  hideSearch: true,
};
