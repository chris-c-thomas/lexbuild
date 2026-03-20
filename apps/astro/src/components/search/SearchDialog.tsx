import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, X, ArrowRight } from "lucide-react";
import { getClient, type SearchResult } from "@/lib/search";

interface SearchDialogProps {
  meiliUrl: string;
  meiliSearchKey: string;
}

export function SearchDialog({ meiliUrl, meiliSearchKey }: SearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"usc" | "ecfr" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Initialize client with config from Astro
  useEffect(() => {
    getClient({ host: meiliUrl, apiKey: meiliSearchKey });
  }, [meiliUrl, meiliSearchKey]);

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults(null);
      setError(null);
      setSourceFilter(null);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback(async (q: string, source: "usc" | "ecfr" | null) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { search } = await import("@/lib/search");
      const result = await search(q, {
        source: source ?? undefined,
        limit: 20,
      });
      setResults(result);
    } catch (err) {
      setResults(null);
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("fetch") ||
        message.includes("connect") ||
        message.includes("ECONNREFUSED")
      ) {
        setError(
          "Search service is unavailable at this time. Meilisearch may be down or experiencing issues.",
        );
      } else {
        setError("Search failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query, sourceFilter), 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, sourceFilter, doSearch]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="border-input bg-background text-muted-foreground hover:bg-muted flex h-8 w-48 cursor-text items-center justify-between rounded-md border px-3 text-sm transition-colors"
      >
        <span className="flex items-center gap-2">
          <Search className="size-3.5" />
          <span className="hidden sm:inline">Search</span>
        </span>
        <kbd className="border-border bg-muted text-muted-foreground pointer-events-none hidden rounded border px-1.5 font-mono text-[0.65rem] font-medium select-none sm:inline">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
    );
  }

  return createPortal(
    <>
      {/* Backdrop — starts below the header (h-14 = 3.5rem) */}
      <div
        className="fixed inset-0 top-14 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div className="fixed inset-x-0 top-[15vh] z-50 mx-auto w-full max-w-xl px-4">
        <div className="border-border bg-background overflow-hidden rounded-xl border shadow-2xl">
          {/* Search input */}
          <div className="border-border flex items-center border-b px-4">
            <Search className="text-muted-foreground size-4 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search LexBuild"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search"
              autoComplete="off"
              spellCheck={false}
              className="placeholder:text-muted-foreground flex-1 bg-transparent px-3 py-3 text-sm outline-none focus-visible:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground rounded p-0.5"
              >
                <X className="size-3.5" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="border-border text-muted-foreground hover:text-foreground ml-2 rounded border px-1.5 py-0.5 text-[0.65rem]"
            >
              ESC
            </button>
          </div>

          {/* Source filter tabs */}
          <div className="border-border flex gap-1 border-b px-4 py-2">
            <FilterTab
              label="All"
              active={sourceFilter === null}
              onClick={() => setSourceFilter(null)}
            />
            <FilterTab
              label="U.S. Code"
              active={sourceFilter === "usc"}
              onClick={() => setSourceFilter("usc")}
              count={results?.facetDistribution?.source?.usc}
            />
            <FilterTab
              label="eCFR"
              active={sourceFilter === "ecfr"}
              onClick={() => setSourceFilter("ecfr")}
              count={results?.facetDistribution?.source?.ecfr}
            />
          </div>

          {/* Results */}
          <div
            className="max-h-[50vh] overflow-y-auto"
            style={{ overscrollBehavior: "contain" }}
            aria-live="polite"
          >
            {loading && (
              <div className="text-muted-foreground px-4 py-8 text-center text-sm">
                Searching...
              </div>
            )}

            {!loading && error && (
              <div className="text-destructive px-4 py-8 text-center text-sm">{error}</div>
            )}

            {!loading && !error && query && results && results.hits.length === 0 && (
              <div className="text-muted-foreground px-4 py-8 text-center text-sm">
                No results for {"\u201C"}
                {query}
                {"\u201D"}
              </div>
            )}

            {!loading && results && results.hits.length > 0 && (
              <ul className="py-1">
                {results.hits.map((hit) => (
                  <li key={hit.id}>
                    <a
                      href={hit.url}
                      className="hover:bg-muted flex items-center gap-3 px-4 py-2.5 transition-colors"
                      onClick={() => setOpen(false)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="bg-slate-blue-100 text-slate-blue-700 dark:bg-slate-blue-900 dark:text-slate-blue-300 shrink-0 rounded px-1.5 py-0.5 font-mono text-[0.6rem] font-medium uppercase">
                            {hit.source}
                          </span>
                          <span className="text-foreground truncate text-sm font-medium">
                            {hit.identifier}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                          {hit.heading}
                        </p>
                        <div className="text-muted-foreground/60 mt-0.5 flex items-center gap-1 text-[0.65rem]">
                          {hit.hierarchy.map((h, i) => (
                            <span key={i} className="flex items-center gap-1">
                              {i > 0 && <span>›</span>}
                              {h}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ArrowRight className="text-muted-foreground/40 size-3.5 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {!loading && !query && (
              <div className="text-muted-foreground px-4 py-8 text-center text-sm">
                Search across <span className="text-foreground font-medium">287,000+</span> sections
                of the U.S. law and regulations
              </div>
            )}
          </div>

          {/* Footer */}
          {results && results.hits.length > 0 && (
            <div className="border-border text-muted-foreground border-t px-4 py-2 text-[0.65rem]">
              {results.estimatedTotalHits.toLocaleString()} results in {results.processingTimeMs}ms
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

function FilterTab({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-slate-blue-600 dark:bg-slate-blue-500 dark:text-slate-blue-950 text-white"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
      {count !== undefined && <span className="ml-1 opacity-60">({count.toLocaleString()})</span>}
    </button>
  );
}
