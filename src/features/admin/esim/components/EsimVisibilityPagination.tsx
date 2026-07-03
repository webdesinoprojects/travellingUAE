import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type EsimVisibilityPaginationProps = {
  basePath: string;
  page: number;
  pageCount: number;
  total: number;
  /** Extra query params to preserve across page links (filter/country/q). */
  params: Record<string, string>;
  unit?: string;
  unitPlural?: string;
};

export function EsimVisibilityPagination({
  basePath,
  page,
  pageCount,
  total,
  params,
  unit = "plan",
  unitPlural = "plans",
}: EsimVisibilityPaginationProps) {
  if (total === 0) return null;

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs font-bold text-brand-brown">
        Page {page} of {pageCount} · {total} {total === 1 ? unit : unitPlural}
      </p>
      <div className="flex items-center gap-2">
        <PageLink basePath={basePath} params={params} page={page - 1} disabled={page <= 1} label="Previous page">
          <ChevronLeft aria-hidden="true" className="size-4" />
          Prev
        </PageLink>
        <PageLink
          basePath={basePath}
          params={params}
          page={page + 1}
          disabled={page >= pageCount}
          label="Next page"
        >
          Next
          <ChevronRight aria-hidden="true" className="size-4" />
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  basePath,
  params,
  page,
  disabled,
  label,
  children,
}: {
  basePath: string;
  params: Record<string, string>;
  page: number;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    "inline-flex min-h-11 items-center gap-1 rounded-lg border border-border-soft px-4 text-sm font-black";

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={`${className} cursor-not-allowed bg-white/50 text-brand-brown/50 dark:bg-white/[0.04]`}
      >
        {children}
      </span>
    );
  }

  const search = new URLSearchParams(params);
  if (page > 1) search.set("page", String(page));
  else search.delete("page");
  const queryString = search.toString();

  return (
    <Link
      href={queryString ? `${basePath}?${queryString}` : basePath}
      aria-label={label}
      className={`${className} bg-white text-brand-navy hover:bg-[#fffaf2] dark:bg-white/10 dark:text-white`}
    >
      {children}
    </Link>
  );
}
