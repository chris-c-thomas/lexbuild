import type { ContentFrontmatter } from "@/lib/types";
import { toTitleCase } from "@/lib/utils";

interface FrontmatterPanelProps {
  frontmatter: ContentFrontmatter;
}

/** Displays metadata from frontmatter, adapting fields based on field presence. */
export function FrontmatterPanel({ frontmatter }: FrontmatterPanelProps) {
  const isTitle = frontmatter.chapter_count !== undefined;
  const isSection = frontmatter.section_number !== undefined;

  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
        <MetaItem label="Identifier" value={frontmatter.identifier} />
        <MetaItem label="Currency" value={frontmatter.currency} />
        <MetaItem label="Positive Law" value={frontmatter.positive_law ? "Yes" : "No"} />
        <MetaItem label="Last Updated" value={frontmatter.last_updated} />

        {isTitle && (
          <>
            <MetaItem label="Chapters" value={String(frontmatter.chapter_count)} />
            <MetaItem label="Sections" value={String(frontmatter.section_count)} />
            <MetaItem
              label="Est. Tokens"
              value={frontmatter.total_token_estimate?.toLocaleString() ?? "—"}
            />
          </>
        )}

        {isSection && (
          <>
            {frontmatter.chapter_name && (
              <MetaItem
                label="Chapter"
                value={`${frontmatter.chapter_number} — ${toTitleCase(frontmatter.chapter_name)}`}
              />
            )}
            {frontmatter.source_credit && (
              <MetaItem
                label="Source"
                value={frontmatter.source_credit}
                className="col-span-2 sm:col-span-3 lg:col-span-4"
              />
            )}
          </>
        )}

        {!isTitle && !isSection && frontmatter.chapter_name && (
          <MetaItem
            label="Chapter"
            value={`${frontmatter.chapter_number} — ${toTitleCase(frontmatter.chapter_name)}`}
          />
        )}
      </dl>
    </div>
  );
}

function MetaItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-blue-600 dark:text-slate-blue-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}
