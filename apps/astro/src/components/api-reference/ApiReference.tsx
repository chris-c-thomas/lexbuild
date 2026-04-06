import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { useEffect, useLayoutEffect, useState } from "react";

import { SCALAR_THEME_CSS } from "@/lib/scalar-theme";

interface ApiReferenceProps {
  specUrl: string;
}

/** Scalar API Reference embedded as a React island with dark mode sync. */
export default function ApiReference({ specUrl }: ApiReferenceProps) {
  const [isDark, setIsDark] = useState(false);

  useLayoutEffect(() => {
    // Read initial theme from localStorage (project pattern for hydration-safe reads)
    setIsDark(localStorage.getItem("theme") === "dark");

    // Watch for dark mode toggles via class changes on <html>
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Directly sync body classes for Scalar's CSS variable scoping.
  // Scalar's useColorMode hook only reads darkMode config once during init,
  // so config prop changes alone don't toggle the theme after mount.
  useEffect(() => {
    if (isDark) {
      document.body.classList.add("dark-mode");
      document.body.classList.remove("light-mode");
    } else {
      document.body.classList.add("light-mode");
      document.body.classList.remove("dark-mode");
    }
  }, [isDark]);

  return (
    <ApiReferenceReact
      configuration={{
        url: specUrl,
        theme: "none",
        darkMode: isDark,
        withDefaultFonts: false,
        customCss: SCALAR_THEME_CSS,
        hideModals: { "search-modal": true },
      }}
    />
  );
}
