import { useLayoutEffect, useState } from "react";
import { DOCS_NAV, type DocsNavSection } from "@/lib/docs-nav";

interface Props {
  currentPath: string;
}

const STORAGE_KEY = "lexbuild-docs-nav";

function getInitialExpanded(currentPath: string): Set<string> {
  const expanded = new Set<string>();
  // Auto-expand the section containing the current page
  const slug = currentPath.replace(/^\/docs\//, "").replace(/\/$/, "");
  for (const section of DOCS_NAV) {
    if (section.items.some((item) => item.slug === slug)) {
      expanded.add(section.title);
    }
  }
  return expanded;
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function SidebarSection({
  section,
  currentSlug,
  expanded,
  onToggle,
}: {
  section: DocsNavSection;
  currentSlug: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="text-sidebar-foreground hover:bg-sidebar-accent/50 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-semibold transition-colors">
        <ChevronRight
          className={`text-sidebar-foreground/40 size-3.5 shrink-0 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
        />
        {section.title}
      </button>
      {expanded && (
        <div className="border-sidebar-border mt-0.5 ml-3 border-l pl-2">
          <ul className="space-y-0.5 py-1">
            {section.items.map((item) => {
              const isActive = currentSlug === item.slug;
              return (
                <li key={item.slug}>
                  {item.separator ? (
                    <hr className="border-sidebar-border my-1.5 mx-2" />
                  ) : null}
                  <a
                    href={`/docs/${item.slug}`}
                    className={`block rounded-md px-2 py-1 text-sm transition-colors ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    }`}>
                    {item.title}
                    {item.badge ? (
                      <span className="bg-slate-blue-100 dark:bg-slate-blue-900 text-slate-blue-700 dark:text-slate-blue-300 ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium">
                        {item.badge}
                      </span>
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function DocsSidebar({ currentPath }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => getInitialExpanded(currentPath));

  // Restore expanded state from sessionStorage after hydration
  useLayoutEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        const restored = new Set(parsed);
        // Always include the section with the current page
        const slug = currentPath.replace(/^\/docs\//, "").replace(/\/$/, "");
        for (const section of DOCS_NAV) {
          if (section.items.some((item) => item.slug === slug)) {
            restored.add(section.title);
          }
        }
        setExpanded(restored);
      }
    } catch {
      // Ignore storage errors
    }
  }, [currentPath]);

  function toggle(title: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }

  const currentSlug = currentPath.replace(/^\/docs\//, "").replace(/\/$/, "");

  return (
    <nav className="space-y-1 p-3" aria-label="Documentation">
      {DOCS_NAV.map((section) => (
        <SidebarSection
          key={section.title}
          section={section}
          currentSlug={currentSlug}
          expanded={expanded.has(section.title)}
          onToggle={() => toggle(section.title)}
        />
      ))}
    </nav>
  );
}
