import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type EsimOrdersPaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  status: string;
  search: string;
};

export function EsimOrdersPagination({
  page,
  pageCount,
  total,
  status,
  search,
}: EsimOrdersPaginationProps) {
  if (total === 0) return null;

  const hasPrev = page > 1;
  const hasNext = page < pageCount;

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs font-bold text-brand-brown">
        Page {page} of {pageCount} · {total} order{total === 1 ? "" : "s"}
      </p>
      <div className="flex items-center gap-2">
        <PageLink
          page={page - 1}
          status={status}
          search={search}
          disabled={!hasPrev}
          ariaLabel="Previous page"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Prev
        </PageLink>
        <PageLink
          page={page + 1}
          status={status}
          search={search}
          disabled={!hasNext}
          ariaLabel="Next page"
        >
          Next
          <ChevronRight aria-hidden="true" className="size-4" />
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  page,
  status,
  search,
  disabled,
  ariaLabel,
  children,
}: {
  page: number;
  status: string;
  search: string;
  disabled: boolean;
  ariaLabel: string;
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

  const params = new URLSearchParams();
  if (status && status !== "all") params.set("status", status);
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  const queryString = params.toString();

  return (
    <Link
      href={queryString ? `/admin/esim/orders?${queryString}` : "/admin/esim/orders"}
      aria-label={ariaLabel}
      className={`${className} bg-white text-brand-navy hover:bg-[#fffaf2] dark:bg-white/10 dark:text-white`}
    >
      {children}
    </Link>
  );
}
