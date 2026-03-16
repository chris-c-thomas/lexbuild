import { SidebarContent } from "./SidebarContent";
import type { SourceId } from "@/lib/types";

interface SidebarProps {
  sourceId: SourceId;
  currentPath: string;
}

export function Sidebar({ sourceId, currentPath }: SidebarProps) {
  return (
    <div className="hidden w-72 shrink-0 border-r border-sidebar-border bg-sidebar lg:sticky lg:top-14 lg:block lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto">
      <SidebarContent sourceId={sourceId} currentPath={currentPath} />
    </div>
  );
}
