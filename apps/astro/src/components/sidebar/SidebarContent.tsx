import { useState, useEffect, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { SectionList } from "./SectionList";
import { toTitleCase } from "@/lib/utils";
import type { SourceId, TitleSummary, ChapterNav, PartNav, FrYearSummary } from "@/lib/types";

interface SidebarContentProps {
  sourceId: SourceId;
  currentPath: string;
}

interface TitleNavData {
  chapters: ChapterNav[];
}

// --- State helpers ---

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

// --- SidebarContent — tree navigation (shared by desktop sidebar and mobile nav) ---

export function SidebarContent({ sourceId, currentPath }: SidebarContentProps) {
  if (sourceId === "fr") {
    return <FrSidebarContent currentPath={currentPath} />;
  }
  return <TitleSidebarContent sourceId={sourceId} currentPath={currentPath} />;
}

// --- FR sidebar — year/month tree ---

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseFrActivePath(path: string) {
  const prefix = "/fr/";
  if (!path.startsWith(prefix)) return { year: null, month: null };
  const segments = path.slice(prefix.length).split("/");
  return {
    year: segments[0] ?? null,
    month: segments[1] ?? null,
  };
}

function FrSidebarContent({ currentPath }: { currentPath: string }) {
  const [years, setYears] = useState<FrYearSummary[] | null>(null);
  const [yearsError, setYearsError] = useState(false);
  const [expandedYear, setExpandedYear] = useState<string | null>(null);
  const [userToggled, setUserToggled] = useState(false);
  const active = parseFrActivePath(currentPath);

  useEffect(() => {
    setYearsError(false);
    fetch("/nav/fr/years.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: FrYearSummary[]) => setYears(data))
      .catch(() => setYearsError(true));
  }, []);

  // Auto-expand to active year on initial load (only before user interacts)
  useEffect(() => {
    if (!active.year || userToggled) return;
    setExpandedYear(active.year);
  }, [active.year, userToggled]);

  const toggleYear = (year: string) => {
    setUserToggled(true);
    setExpandedYear(expandedYear === year ? null : year);
  };

  return (
    <div className="p-3">
      {yearsError ? (
        <p className="text-muted-foreground p-2 text-sm">Failed to load navigation.</p>
      ) : !years ? (
        <div className="space-y-2 p-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-sidebar-accent/50 h-6 animate-pulse rounded"
              style={{ width: `${[60, 75, 55, 70, 65, 80][i]}%` }}
            />
          ))}
        </div>
      ) : years.length === 0 ? (
        <p className="text-muted-foreground p-2 text-sm">No years found.</p>
      ) : (
        <nav aria-label="Federal Register navigation">
          <ul className="space-y-0.5">
            {years
              .slice()
              .sort((a, b) => b.year - a.year)
              .map((yr) => {
                const yearStr = String(yr.year);
                const isExpanded = expandedYear === yearStr;
                const isActiveYear = active.year === yearStr;

                return (
                  <li key={yr.year}>
                    <button
                      onClick={() => toggleYear(yearStr)}
                      className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        isExpanded
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                      }`}
                      aria-expanded={isExpanded}>
                      <ChevronRight
                        className={`text-sidebar-foreground/40 size-3.5 shrink-0 transition-transform ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      />
                      <span className="text-slate-blue-700 dark:text-slate-blue-400 shrink-0 font-mono text-xs font-semibold">
                        {yr.year}
                      </span>
                      <span className="min-w-0 truncate font-medium">{yr.documentCount.toLocaleString()} docs</span>
                    </button>

                    {isExpanded && (
                      <div className="border-sidebar-border mt-0.5 ml-3 border-l pl-2">
                        <ul className="space-y-0.5">
                          {yr.months
                            .slice()
                            .sort((a, b) => b.month - a.month)
                            .map((m) => {
                              const monthStr = String(m.month).padStart(2, "0");
                              const isActiveMonth = isActiveYear && active.month === monthStr;

                              return (
                                <li key={m.month}>
                                  <a
                                    href={`/fr/${yearStr}/${monthStr}`}
                                    className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[0.8rem] transition-colors ${
                                      isActiveMonth
                                        ? "bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium"
                                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40"
                                    }`}>
                                    <span className="text-slate-blue-700 dark:text-slate-blue-400 shrink-0 font-mono text-[0.65rem] font-semibold">
                                      {monthStr}
                                    </span>
                                    <span className="min-w-0 truncate">{MONTH_NAMES[m.month]}</span>
                                    <span className="text-muted-foreground ml-auto shrink-0 text-[0.6rem]">
                                      {m.documentCount.toLocaleString()}
                                    </span>
                                  </a>
                                </li>
                              );
                            })}
                        </ul>
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

// --- Title-based sidebar — USC/eCFR ---

function TitleSidebarContent({ sourceId, currentPath }: SidebarContentProps) {
  const [titles, setTitles] = useState<TitleSummary[] | null>(null);
  const [titlesError, setTitlesError] = useState(false);
  const [expandedTitle, setExpandedTitle] = useState<string | null>(null);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [expandedPart, setExpandedPart] = useState<string | null>(null);
  const [userToggled, setUserToggled] = useState(false);
  const [titleNavCache, setTitleNavCache] = useState<Record<string, TitleNavData>>({});
  const [failedTitles, setFailedTitles] = useState<Set<string>>(new Set());
  const [loadingTitle, setLoadingTitle] = useState<string | null>(null);

  const active = parseActivePath(sourceId, currentPath);

  // Fetch titles.json on mount (and when source changes)
  useEffect(() => {
    setTitlesError(false);
    setTitles(null);
    fetch(`/nav/${sourceId}/titles.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: TitleSummary[]) => setTitles(data))
      .catch(() => setTitlesError(true));
  }, [sourceId]);

  // Auto-expand to the active item on initial load (only before user interacts)
  useEffect(() => {
    if (!active.title || userToggled) return;
    setExpandedTitle(active.title);
    if (active.chapter) setExpandedChapter(active.chapter);
    if (active.part) setExpandedPart(active.part);
  }, [active.title, active.chapter, active.part, userToggled]);

  // Lazy-load per-title nav JSON
  const loadTitleNav = useCallback(
    async (titleDir: string) => {
      if (titleNavCache[titleDir]) return;
      setLoadingTitle(titleDir);
      try {
        const res = await fetch(`/nav/${sourceId}/${titleDir}.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as TitleNavData;
        setTitleNavCache((prev) => ({ ...prev, [titleDir]: data }));
      } catch {
        setFailedTitles((prev) => new Set(prev).add(titleDir));
      } finally {
        setLoadingTitle(null);
      }
    },
    [sourceId, titleNavCache],
  );

  // Load nav data when a title is expanded (skip if already failed — retry is manual)
  useEffect(() => {
    if (expandedTitle && !failedTitles.has(expandedTitle)) {
      void loadTitleNav(expandedTitle);
    }
  }, [expandedTitle, loadTitleNav, failedTitles]);

  const toggleTitle = (dir: string) => {
    setUserToggled(true);
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
      {titlesError ? (
        <p className="text-muted-foreground p-2 text-sm">Failed to load navigation.</p>
      ) : !titles ? (
        <div className="space-y-2 p-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-sidebar-accent/50 h-6 animate-pulse rounded"
              style={{ width: `${[75, 62, 85, 70, 88, 65, 80, 72][i]}%` }}
            />
          ))}
        </div>
      ) : titles.length === 0 ? (
        <p className="text-muted-foreground p-2 text-sm">No titles found.</p>
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
                    aria-expanded={isExpanded}>
                    <ChevronRight
                      className={`text-sidebar-foreground/40 size-3.5 shrink-0 transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                    <span className="text-slate-blue-700 dark:text-slate-blue-400 shrink-0 font-mono text-xs font-semibold">
                      {title.number}
                    </span>
                    <span className="min-w-0 truncate font-medium">{toTitleCase(title.name)}</span>
                  </button>

                  {/* Chapters (expanded) */}
                  {isExpanded && (
                    <div className="border-sidebar-border mt-0.5 ml-3 border-l pl-2">
                      {loadingTitle === title.directory ? (
                        <div className="space-y-1.5 py-1">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div
                              key={i}
                              className="bg-sidebar-accent/50 h-5 animate-pulse rounded"
                              style={{ width: `${[68, 82, 55][i]}%` }}
                            />
                          ))}
                        </div>
                      ) : failedTitles.has(title.directory) ? (
                        <div className="px-1 py-1.5">
                          <p className="text-muted-foreground text-xs">Failed to load.</p>
                          <button
                            onClick={() => {
                              setFailedTitles((prev) => {
                                const next = new Set(prev);
                                next.delete(title.directory);
                                return next;
                              });
                              void loadTitleNav(title.directory);
                            }}
                            className="text-slate-blue-700 dark:text-slate-blue-400 hover:text-slate-blue-900 dark:hover:text-slate-blue-200 mt-1 text-xs font-medium">
                            Retry
                          </button>
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

// --- Chapter list (second level) ---

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
    return <p className="text-muted-foreground py-1 text-xs">No chapters</p>;
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
              aria-expanded={isExpanded}>
              <ChevronRight
                className={`text-sidebar-foreground/40 size-3 shrink-0 transition-transform ${
                  isExpanded ? "rotate-90" : ""
                }`}
              />
              <span className="text-slate-blue-700 dark:text-slate-blue-400 shrink-0 font-mono text-[0.65rem] font-semibold">
                Ch. {chapter.number}
              </span>
              <span className="min-w-0 truncate">{toTitleCase(chapter.name)}</span>
            </button>

            {isExpanded && (
              <div className="border-sidebar-border/60 mt-0.5 ml-3 border-l pl-2">
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
                  <SectionList sections={chapter.sections!} basePath={basePath} currentPath={currentPath} />
                ) : (
                  <p className="text-muted-foreground py-1 text-xs">Empty</p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// --- Part list (third level — eCFR only) ---

interface PartListProps {
  parts: PartNav[];
  sourceId: SourceId;
  titleDir: string;
  chapterDir: string;
  expandedPart: string | null;
  togglePart: (dir: string) => void;
  currentPath: string;
}

function PartList({ parts, sourceId, titleDir, chapterDir, expandedPart, togglePart, currentPath }: PartListProps) {
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
              aria-expanded={isExpanded}>
              <ChevronRight
                className={`text-sidebar-foreground/40 size-2.5 shrink-0 transition-transform ${
                  isExpanded ? "rotate-90" : ""
                }`}
              />
              <span className="text-slate-blue-700 dark:text-slate-blue-400 shrink-0 font-mono text-[0.6rem] font-semibold">
                Pt. {part.number}
              </span>
              <span className="min-w-0 truncate">{toTitleCase(part.name)}</span>
            </button>

            {isExpanded && (
              <div className="border-sidebar-border/40 mt-0.5 ml-3 border-l pl-2">
                <SectionList sections={part.sections} basePath={basePath} currentPath={currentPath} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
