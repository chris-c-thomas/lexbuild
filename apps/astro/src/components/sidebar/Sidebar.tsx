import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { SidebarContent } from "./SidebarContent";
import type { SourceId } from "@/lib/types";

interface SidebarProps {
  sourceId: SourceId;
  currentPath: string;
}

const STORAGE_KEY = "lexbuild-sidebar-width";
const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 288; // w-72

export function Sidebar({ sourceId, currentPath }: SidebarProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const isDragging = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Apply stored width before first paint — no hydration mismatch (initial
  // render matches server at DEFAULT_WIDTH), no visible flash (runs before
  // the browser paints).
  useLayoutEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        setWidth(parsed);
      }
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !sidebarRef.current) return;
    const sidebarLeft = sidebarRef.current.getBoundingClientRect().left;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX - sidebarLeft));
    setWidth(newWidth);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    localStorage.setItem(STORAGE_KEY, String(Math.round(width)));
  }, [width]);

  return (
    <div
      ref={sidebarRef}
      style={{ width: `${width}px` }}
      className="relative hidden shrink-0 lg:sticky lg:top-14 lg:block lg:h-[calc(100vh-3.5rem)]">
      {/* Scrollable content area */}
      <div
        className="border-sidebar-border bg-sidebar h-full overflow-y-auto border-r"
        style={{ scrollbarGutter: "stable" }}>
        <SidebarContent sourceId={sourceId} currentPath={currentPath} />
      </div>

      {/* Drag handle — outside scroll container so it stays fixed */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="group absolute top-0 right-0 z-10 hidden h-full w-1.5 cursor-col-resize select-none lg:block"
        aria-hidden="true">
        <div className="bg-sidebar-accent-foreground/40 mx-auto h-full w-px opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-active:opacity-100" />
      </div>
    </div>
  );
}
