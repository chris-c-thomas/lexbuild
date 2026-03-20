import { useState, useEffect, useCallback } from "react";
import { Monitor, Sun, Moon } from "lucide-react";

type Theme = "system" | "light" | "dark";

const THEMES: Theme[] = ["system", "light", "dark"];

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

function applyTheme(theme: Theme) {
  const isDark =
    theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  document.getElementById("theme-color")?.setAttribute("content", isDark ? "#0e1821" : "#ffffff");
  localStorage.setItem("theme", theme);
}

const LABELS: Record<Theme, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};

/** Three-way theme toggle: system, light, dark. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  // Listen for OS preference changes when in system mode
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (getStoredTheme() === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const selectTheme = useCallback((t: Theme) => {
    setTheme(t);
    applyTheme(t);
  }, []);

  return (
    <div
      className="relative inline-flex h-8 w-[76px] items-center rounded-full border border-slate-blue-200 bg-slate-blue-50 p-0.5 dark:border-slate-blue-700 dark:bg-slate-blue-900"
      role="radiogroup"
      aria-label="Theme"
    >
      {/* Sliding indicator */}
      <span
        className="absolute h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 dark:bg-slate-blue-700"
        style={{
          transform: `translateX(${THEMES.indexOf(theme) * 24}px)`,
        }}
      />
      {/* Buttons */}
      {THEMES.map((t) => {
        const Icon = t === "system" ? Monitor : t === "light" ? Sun : Moon;
        const isActive = theme === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={LABELS[t]}
            title={LABELS[t]}
            onClick={() => selectTheme(t)}
            className={`relative z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-colors ${
              isActive
                ? "text-slate-blue-700 dark:text-slate-blue-200"
                : "text-slate-blue-500 hover:text-slate-blue-700 dark:text-slate-blue-500 dark:hover:text-slate-blue-300"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
