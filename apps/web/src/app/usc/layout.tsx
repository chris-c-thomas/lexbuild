import { Sidebar } from "@/components/sidebar/sidebar";
import { SearchDialog } from "@/components/search/search-dialog";

/** USC layout — sidebar navigation + scrollable content pane. */
export default function UscLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </main>
      <SearchDialog />
    </div>
  );
}
