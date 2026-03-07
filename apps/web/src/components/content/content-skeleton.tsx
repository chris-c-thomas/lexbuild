/** Shared loading skeleton for all content viewer pages. */
export function ContentSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-5 w-48 rounded bg-muted" />
      <div className="h-8 w-96 rounded bg-muted" />
      <div className="h-32 rounded-lg bg-muted" />
      <div className="h-6 w-40 rounded bg-muted" />
      <div className="space-y-3">
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-5/6 rounded bg-muted" />
        <div className="h-4 w-4/6 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-3/4 rounded bg-muted" />
      </div>
    </div>
  );
}
