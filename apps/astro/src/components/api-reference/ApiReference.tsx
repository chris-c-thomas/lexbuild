import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { Component, useEffect, useLayoutEffect, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";

import { SCALAR_THEME_CSS } from "@/lib/scalar-theme";

interface ApiReferenceProps {
  specUrl: string;
}

/** Scalar API Reference embedded as a React island with dark mode sync. */
export default function ApiReference({ specUrl }: ApiReferenceProps) {
  const [isDark, setIsDark] = useState(false);

  useLayoutEffect(() => {
    // Determine initial theme. localStorage may throw in restricted contexts,
    // so fall back to the <html> class (always set by the inline head script).
    let dark: boolean;
    try {
      dark = localStorage.getItem("theme") === "dark";
    } catch {
      dark = document.documentElement.classList.contains("dark");
    }
    setIsDark(dark);

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

  // Scalar's useColorMode hook only reads darkMode config once during init,
  // so config prop changes alone don't toggle the theme after mount.
  // Directly sync body classes for Scalar's CSS variable scoping.
  useEffect(() => {
    if (isDark) {
      document.body.classList.add("dark-mode");
      document.body.classList.remove("light-mode");
    } else {
      document.body.classList.add("light-mode");
      document.body.classList.remove("dark-mode");
    }

    return () => {
      document.body.classList.remove("dark-mode", "light-mode");
    };
  }, [isDark]);

  return (
    <ApiReferenceErrorBoundary specUrl={specUrl}>
      <ApiReferenceReact
        configuration={{
          url: specUrl,
          theme: "none",
          darkMode: isDark,
          withDefaultFonts: false,
          customCss: SCALAR_THEME_CSS,
          // Hide Scalar's Cmd+K search to avoid conflicting with the site SearchDialog
          hideModals: { "search-modal": true },
        }}
      />
    </ApiReferenceErrorBoundary>
  );
}

interface ErrorBoundaryProps {
  specUrl: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/** Catches Scalar render failures and shows a fallback with a link to the raw spec. */
class ApiReferenceErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ApiReference] Render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "16rem",
            gap: "0.75rem",
          }}>
          <p style={{ color: "var(--muted-foreground)" }}>Failed to load the API reference.</p>
          <a href={this.props.specUrl} style={{ color: "var(--scalar-color-accent, #476c85)" }}>
            View the raw OpenAPI specification
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}
