import { useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SidebarContent } from "./SidebarContent";
import type { SourceId } from "@/lib/types";

interface MobileNavProps {
  source?: SourceId;
  currentPath: string;
}

export function MobileNav({ source, currentPath }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>

      <SheetContent
        side="left"
        className="flex w-72 flex-col overflow-y-auto bg-sidebar p-0 sm:max-w-72"
      >
        <SheetHeader className="flex shrink-0 flex-row items-center gap-3 border-b border-sidebar-border px-4 py-3">
          <SheetTitle className="text-base font-bold text-sidebar-foreground">
            LexBuild
          </SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
          <div className="relative">
            <select
              value={source ?? ""}
              onChange={(e) => {
                window.location.href = `/${e.target.value}`;
              }}
              className="appearance-none rounded-md border border-sidebar-border bg-sidebar-accent py-1 pl-2.5 pr-7 text-xs font-medium text-sidebar-accent-foreground outline-none"
              aria-label="Select source"
            >
              <option value="usc">U.S. Code</option>
              <option value="ecfr">eCFR</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-sidebar-foreground/50" />
          </div>
        </SheetHeader>

        {/* Sidebar tree */}
        {source && (
          <SidebarContent sourceId={source} currentPath={currentPath} />
        )}

        {/* Fallback when no source (home page) */}
        {!source && (
          <nav className="flex flex-col gap-1 p-3">
            <a
              href="/usc"
              className="rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50"
            >
              U.S. Code
            </a>
            <a
              href="/ecfr"
              className="rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50"
            >
              eCFR
            </a>
          </nav>
        )}
      </SheetContent>
    </Sheet>
  );
}
