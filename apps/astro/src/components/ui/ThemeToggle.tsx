import { useState, useEffect, useCallback } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  // Migrate legacy "system" or unknown values to "light"
  localStorage.setItem("theme", "light");
  return "light";
}

function applyTheme(theme: Theme) {
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  document.getElementById("theme-color")?.setAttribute("content", isDark ? "#0e1821" : "#ffffff");
  localStorage.setItem("theme", theme);
}

/** Two-way theme toggle: light and dark. Defaults to light. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }, [theme]);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="border-border bg-muted hover:bg-muted/80 relative inline-flex h-8 w-[52px] cursor-pointer items-center rounded-full border p-0.5 transition-colors">
      {/* Sliding indicator */}
      <span
        className="bg-background absolute h-6 w-6 rounded-full shadow-sm transition-transform duration-200"
        style={{ transform: isDark ? "translateX(20px)" : "translateX(0px)" }}
      />
      {/* Icons */}
      <span
        className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
          !isDark ? "text-foreground" : "text-muted-foreground"
        }`}>
        <Sun className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span
        className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
          isDark ? "text-foreground" : "text-muted-foreground"
        }`}>
        <Moon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </button>
  );
}
