import { Breadcrumbs } from "@/components/breadcrumbs";

/** Title layout — adds breadcrumbs above content for all title/chapter/section pages. */
export default function TitleLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Breadcrumbs />
      {children}
    </>
  );
}
