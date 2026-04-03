import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { SectionNavEntry } from "@/lib/types";

interface SectionListProps {
  sections: SectionNavEntry[];
  basePath: string;
  currentPath: string;
}

/**
 * Virtualized section list for chapters/parts with many sections.
 * Renders only visible items for performance (some parts have 500+ sections).
 * Falls back to a plain list for small section counts (< 100).
 */
export function SectionList({ sections, basePath, currentPath }: SectionListProps) {
  if (sections.length < 100) {
    return (
      <ul className="space-y-px">
        {sections.map((section) => {
          const href = `${basePath}/${section.file}`;
          const isActive = currentPath === href;
          return (
            <li key={section.file}>
              <a
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-baseline gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}>
                <span className="text-slate-blue-700 dark:text-slate-blue-400 shrink-0 font-mono text-[0.65rem] font-semibold">
                  §{section.number}
                </span>
                <span className="min-w-0 truncate">{section.name}</span>
              </a>
            </li>
          );
        })}
      </ul>
    );
  }

  return <VirtualizedSectionList sections={sections} basePath={basePath} currentPath={currentPath} />;
}

function VirtualizedSectionList({ sections, basePath, currentPath }: SectionListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: sections.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="max-h-[60vh] overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const section = sections[virtualRow.index]!;
          const href = `${basePath}/${section.file}`;
          const isActive = currentPath === href;

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}>
              <a
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-baseline gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}>
                <span className="text-slate-blue-700 dark:text-slate-blue-400 shrink-0 font-mono text-[0.65rem] font-semibold">
                  §{section.number}
                </span>
                <span className="min-w-0 truncate">{section.name}</span>
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
