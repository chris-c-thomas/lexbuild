import { useState, useEffect, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { SectionList } from "./SectionList";
import { toTitleCase } from "@/lib/utils";
import type { SourceId, TitleSummary, ChapterNav, PartNav } from "@/lib/types";

interface SidebarContentProps {
  sourceId: SourceId;
  currentPath: string;
}

interface TitleNavData {
  chapters: ChapterNav[];
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

/** Parse the current path to determine which title/chapter/part is active. */
function parseActivePath(sourceId: SourceId, path: string) {
  const prefix = `/${sourceId}/`;
  if (!path.startsWith(prefix)) return { title: null, chapter: null, part: null };

  const segments = path.slice(prefix.length).split("/");
  return {
    title: segments[0] ?? null,
    chapter: segments[1] ?? null,
    part: segments[2]?.startsWith("part-") ? segments[2] : null,
  };
}

// ---------------------------------------------------------------------------
// SidebarContent — tree navigation (shared by desktop sidebar and mobile nav)
// ---------------------------------------------------------------------------

export function SidebarContent({ sourceId, currentPath }: SidebarContentProps) {
  const [titles, setTitles] = useState<TitleSummary[] | null>(null);
  const [expandedTitle, setExpandedTitle] = useState<string | null>(null);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [expandedPart, setExpandedPart] = useState<string | null>(null);
  const [titleNavCache, setTitleNavCache] = useState<Record<string, TitleNavData>>({});
  const [loadingTitle, setLoadingTitle] = useState<string | null>(null);

  const active = parseActivePath(sourceId, currentPath);

  // Fetch titles.json on mount
  useEffect(() => {
    fetch(`/nav/${sourceId}/titles.json`)
      .then((r) => r.json())
      .then((data: TitleSummary[]) => setTitles(data))
      .catch(() => setTitles([]));
  }, [sourceId]);

  // Auto-expand to the active item on initial load
  useEffect(() => {
    if (!active.title || expandedTitle) return;
    setExpandedTitle(active.title);
    if (active.chapter) setExpandedChapter(active.chapter);
    if (active.part) setExpandedPart(active.part);
  }, [active.title, active.chapter, active.part, expandedTitle]);

  // Lazy-load per-title nav JSON
  const loadTitleNav = useCallback(
    async (titleDir: string) => {
      if (titleNavCache[titleDir]) return;
      setLoadingTitle(titleDir);
      try {
        const res = await fetch(`/nav/${sourceId}/${titleDir}.json`);
        const data = (await res.json()) as TitleNavData;
        setTitleNavCache((prev) => ({ ...prev, [titleDir]: data }));
      } catch {
        // Silently fail — sidebar shows empty
      } finally {
        setLoadingTitle(null);
      }
    },
    [sourceId, titleNavCache],
  );

  // Load nav data when a title is expanded
  useEffect(() => {
    if (expandedTitle) {
      void loadTitleNav(expandedTitle);
    }
  }, [expandedTitle, loadTitleNav]);

  const toggleTitle = (dir: string) => {
    if (expandedTitle === dir) {
      setExpandedTitle(null);
      setExpandedChapter(null);
      setExpandedPart(null);
    } else {
      setExpandedTitle(dir);
      setExpandedChapter(null);
      setExpandedPart(null);
    }
  };

  const toggleChapter = (dir: string) => {
    if (expandedChapter === dir) {
      setExpandedChapter(null);
      setExpandedPart(null);
    } else {
      setExpandedChapter(dir);
      setExpandedPart(null);
    }
  };

  const togglePart = (dir: string) => {
    setExpandedPart(expandedPart === dir ? null : dir);
  };

  return (
    <div className="p-3">
      {!titles ? (
        <div className="space-y-2 p-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-6 animate-pulse rounded bg-sidebar-accent/50"
              style={{ width: `${60 + Math.random() * 30}%` }}
            />
          ))}
        </div>
      ) : titles.length === 0 ? (
        <p className="p-2 text-sm text-muted-foreground">No titles found.</p>
      ) : (
        <nav aria-label={`${sourceId.toUpperCase()} navigation`}>
          <ul className="space-y-0.5">
            {titles.map((title) => {
              const isExpanded = expandedTitle === title.directory;
              const titleNav = titleNavCache[title.directory];

              return (
                <li key={title.directory}>
                  {/* Title row */}
                  <button
                    onClick={() => toggleTitle(title.directory)}
                    className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      isExpanded
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    }`}
                    aria-expanded={isExpanded}
                  >
                    <ChevronRight
                      className={`size-3.5 shrink-0 text-sidebar-foreground/40 transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                    <span className="shrink-0 font-mono text-xs text-sidebar-foreground/50">
                      {title.number}
                    </span>
                    <span className="min-w-0 truncate font-medium">
                      {toTitleCase(title.name)}
                    </span>
                  </button>

                  {/* Chapters (expanded) */}
                  {isExpanded && (
                    <div className="ml-3 mt-0.5 border-l border-sidebar-border pl-2">
                      {loadingTitle === title.directory ? (
                        <div className="space-y-1.5 py-1">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div
                              key={i}
                              className="h-5 animate-pulse rounded bg-sidebar-accent/50"
                              style={{ width: `${50 + Math.random() * 40}%` }}
                            />
                          ))}
                        </div>
                      ) : titleNav ? (
                        <ChapterList
                          chapters={titleNav.chapters}
                          sourceId={sourceId}
                          titleDir={title.directory}
                          expandedChapter={expandedChapter}
                          expandedPart={expandedPart}
                          toggleChapter={toggleChapter}
                          togglePart={togglePart}
                          currentPath={currentPath}
                        />
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chapter list (second level)
// ---------------------------------------------------------------------------

interface ChapterListProps {
  chapters: ChapterNav[];
  sourceId: SourceId;
  titleDir: string;
  expandedChapter: string | null;
  expandedPart: string | null;
  toggleChapter: (dir: string) => void;
  togglePart: (dir: string) => void;
  currentPath: string;
}

function ChapterList({
  chapters,
  sourceId,
  titleDir,
  expandedChapter,
  expandedPart,
  toggleChapter,
  togglePart,
  currentPath,
}: ChapterListProps) {
  if (chapters.length === 0) {
    return <p className="py-1 text-xs text-muted-foreground">No chapters</p>;
  }

  return (
    <ul className="space-y-0.5">
      {chapters.map((chapter) => {
        const isExpanded = expandedChapter === chapter.directory;
        const hasParts = chapter.parts && chapter.parts.length > 0;
        const hasSections = chapter.sections && chapter.sections.length > 0;
        const basePath = `/${sourceId}/${titleDir}/${chapter.directory}`;

        return (
          <li key={chapter.directory}>
            <button
              onClick={() => toggleChapter(chapter.directory)}
              className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[0.8rem] transition-colors ${
                isExpanded
                  ? "bg-sidebar-accent/70 text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40"
              }`}
              aria-expanded={isExpanded}
            >
              <ChevronRight
                className={`size-3 shrink-0 text-sidebar-foreground/40 transition-transform ${
                  isExpanded ? "rotate-90" : ""
                }`}
              />
              <span className="shrink-0 font-mono text-[0.65rem] text-sidebar-foreground/50">
                Ch. {chapter.number}
              </span>
              <span className="min-w-0 truncate">{toTitleCase(chapter.name)}</span>
            </button>

            {isExpanded && (
              <div className="ml-3 mt-0.5 border-l border-sidebar-border/60 pl-2">
                {hasParts ? (
                  <PartList
                    parts={chapter.parts!}
                    sourceId={sourceId}
                    titleDir={titleDir}
                    chapterDir={chapter.directory}
                    expandedPart={expandedPart}
                    togglePart={togglePart}
                    currentPath={currentPath}
                  />
                ) : hasSections ? (
                  <SectionList
                    sections={chapter.sections!}
                    basePath={basePath}
                    currentPath={currentPath}
                  />
                ) : (
                  <p className="py-1 text-xs text-muted-foreground">Empty</p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Part list (third level — eCFR only)
// ---------------------------------------------------------------------------

interface PartListProps {
  parts: PartNav[];
  sourceId: SourceId;
  titleDir: string;
  chapterDir: string;
  expandedPart: string | null;
  togglePart: (dir: string) => void;
  currentPath: string;
}

function PartList({
  parts,
  sourceId,
  titleDir,
  chapterDir,
  expandedPart,
  togglePart,
  currentPath,
}: PartListProps) {
  return (
    <ul className="space-y-0.5">
      {parts.map((part) => {
        const isExpanded = expandedPart === part.directory;
        const basePath = `/${sourceId}/${titleDir}/${chapterDir}/${part.directory}`;

        return (
          <li key={part.directory}>
            <button
              onClick={() => togglePart(part.directory)}
              className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs transition-colors ${
                isExpanded
                  ? "bg-sidebar-accent/50 text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/30"
              }`}
              aria-expanded={isExpanded}
            >
              <ChevronRight
                className={`size-2.5 shrink-0 text-sidebar-foreground/40 transition-transform ${
                  isExpanded ? "rotate-90" : ""
                }`}
              />
              <span className="shrink-0 font-mono text-[0.6rem] text-sidebar-foreground/50">
                Pt. {part.number}
              </span>
              <span className="min-w-0 truncate">{toTitleCase(part.name)}</span>
            </button>

            {isExpanded && (
              <div className="ml-3 mt-0.5 border-l border-sidebar-border/40 pl-2">
                <SectionList
                  sections={part.sections}
                  basePath={basePath}
                  currentPath={currentPath}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
