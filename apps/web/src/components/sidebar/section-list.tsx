"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import type { SectionNavEntry } from "@/lib/types";

interface SectionListProps {
  sections: SectionNavEntry[];
  titleDir: string;
  chapterDir: string;
  activeSectionSlug?: string;
}

const VIRTUALIZE_THRESHOLD = 100;
const ITEM_HEIGHT = 28;

/** Section list within a chapter. Virtualizes when > 100 entries. */
export function SectionList({
  sections,
  titleDir,
  chapterDir,
  activeSectionSlug,
}: SectionListProps) {
  if (sections.length > VIRTUALIZE_THRESHOLD) {
    return (
      <VirtualizedSectionList
        sections={sections}
        titleDir={titleDir}
        chapterDir={chapterDir}
        activeSectionSlug={activeSectionSlug}
      />
    );
  }

  return (
    <ul className="space-y-px">
      {sections.map((s) => (
        <SectionItem
          key={s.file}
          section={s}
          titleDir={titleDir}
          chapterDir={chapterDir}
          isActive={activeSectionSlug === s.file}
        />
      ))}
    </ul>
  );
}

function VirtualizedSectionList({
  sections,
  titleDir,
  chapterDir,
  activeSectionSlug,
}: SectionListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: sections.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 20,
  });

  // Scroll active item into view on mount
  useEffect(() => {
    if (activeSectionSlug) {
      const index = sections.findIndex((s) => s.file === activeSectionSlug);
      if (index >= 0) {
        virtualizer.scrollToIndex(index, { align: "center" });
      }
    }
  }, [activeSectionSlug, sections, virtualizer]);

  return (
    <div ref={parentRef} className="max-h-64 overflow-y-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const s = sections[virtualRow.index];
          if (!s) return null;
          return (
            <div
              key={s.file}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <SectionItem
                section={s}
                titleDir={titleDir}
                chapterDir={chapterDir}
                isActive={activeSectionSlug === s.file}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionItem({
  section,
  titleDir,
  chapterDir,
  isActive,
}: {
  section: SectionNavEntry;
  titleDir: string;
  chapterDir: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={`/usc/${titleDir}/${chapterDir}/${section.file}/`}
      className={cn(
        "block truncate rounded-md px-2 py-0.5 text-xs transition-colors",
        isActive
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
      title={`§ ${section.number} — ${section.name}`}
    >
      § {section.number}
      <span className="ml-1 opacity-70">{section.name}</span>
    </Link>
  );
}
