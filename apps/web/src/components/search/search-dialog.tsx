"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PagefindResult {
  id: string;
  url: string;
  excerpt: string;
  meta?: { title?: string };
}

interface PagefindResponse {
  results: { id: string; data: () => Promise<PagefindResult> }[];
}

interface Pagefind {
  search: (query: string) => Promise<PagefindResponse>;
  init: () => Promise<void>;
}

/** Cmd+K search dialog powered by Pagefind. Loads the index on first open. */
export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PagefindResult[]>([]);
  const [loading, setLoading] = useState(false);
  const pagefindRef = useRef<Pagefind | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  // Load Pagefind on first open
  const loadPagefind = useCallback(async () => {
    if (pagefindRef.current) return pagefindRef.current;
    try {
      // Pagefind generates this file at build time
      const pf = await import(
        // @ts-expect-error — Pagefind is a generated asset, not a typed module
        /* webpackIgnore: true */ "/_pagefind/pagefind.js"
      );
      await pf.init();
      pagefindRef.current = pf as Pagefind;
      return pf as Pagefind;
    } catch {
      return null;
    }
  }, []);

  // Search on query change (debounced 200ms)
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timeout = setTimeout(() => {
      (async () => {
        try {
          const pf = await loadPagefind();
          if (!pf || controller.signal.aborted) {
            setLoading(false);
            return;
          }

          const response = await pf.search(query);
          if (controller.signal.aborted) return;

          const items = await Promise.all(response.results.slice(0, 10).map((r) => r.data()));
          if (!controller.signal.aborted) {
            setResults(items);
            setLoading(false);
          }
        } catch {
          if (!controller.signal.aborted) {
            setResults([]);
            setLoading(false);
          }
        }
      })();
    }, 200);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, loadPagefind]);

  function navigate(result: PagefindResult) {
    setOpen(false);
    // Pagefind URLs are already absolute paths (e.g. "/usc/title-01/chapter-01/section-1/")
    router.push(result.url);
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)} />
      <div className="fixed inset-x-4 top-[15vh] z-50 mx-auto max-w-xl rounded-xl border border-border bg-background shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sections..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => setOpen(false)}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {loading && query.trim() && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">Searching...</div>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              No results found.
            </div>
          )}
          {!query.trim() && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              Type to search the U.S. Code...
            </div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(r)}
              className={cn(
                "w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent",
              )}
            >
              <div className="text-sm font-medium text-foreground">{r.meta?.title ?? r.url}</div>
              {r.excerpt && (
                <div
                  className="mt-0.5 line-clamp-2 text-xs text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: sanitizeExcerpt(r.excerpt) }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>{" "}
          to toggle search
        </div>
      </div>
    </>
  );
}

/**
 * Sanitize Pagefind excerpt HTML — allow only <mark> tags for highlighting.
 * Uses DOMParser for safe parsing (always available in "use client" components).
 */
function sanitizeExcerpt(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const toUnwrap: Element[] = [];

  while (walker.nextNode()) {
    const el = walker.currentNode as Element;
    if (el.tagName !== "MARK") {
      toUnwrap.push(el);
    }
  }

  for (const el of toUnwrap) {
    el.replaceWith(...Array.from(el.childNodes));
  }

  return doc.body.innerHTML;
}

/** Small trigger button for the sidebar header. */
export function SearchTrigger() {
  return (
    <button
      onClick={() =>
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
      }
      className="rounded p-1 text-muted-foreground hover:text-foreground"
      aria-label="Search"
    >
      <Search className="h-4 w-4" />
    </button>
  );
}
