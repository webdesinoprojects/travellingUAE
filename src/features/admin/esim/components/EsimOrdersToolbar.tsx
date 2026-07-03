"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ESIM_ORDER_FILTERS } from "@/features/admin/esim/status";

type EsimOrdersToolbarProps = {
  status: string;
  search: string;
};

/**
 * Filter + search controls for the orders list. Drives the URL query only — the
 * data is fetched and rendered on the server, so no order rows travel to the
 * client as JSON (nothing shows up in the network panel beyond the rendered page).
 */
export function EsimOrdersToolbar({ status, search }: EsimOrdersToolbarProps) {
  const router = useRouter();
  const [term, setTerm] = useState(search);

  // Sync the input when the URL search param changes (submit / debounce /
  // browser back-forward) using the "adjust state during render" pattern.
  const [lastSearch, setLastSearch] = useState(search);
  if (search !== lastSearch) {
    setLastSearch(search);
    setTerm(search);
  }

  function apply(next: { status?: string; q?: string }) {
    const params = new URLSearchParams();
    const nextStatus = next.status ?? status;
    const nextQuery = (next.q ?? term).trim();

    if (nextStatus && nextStatus !== "all") params.set("status", nextStatus);
    if (nextQuery) params.set("q", nextQuery);

    const queryString = params.toString();
    // Navigating resets pagination back to page 1 (no page param carried over).
    router.push(queryString ? `/admin/esim/orders?${queryString}` : "/admin/esim/orders");
  }

  // Debounced auto-search: navigates 400ms after typing stops, only when the
  // term differs from the current URL. Enter and the Search button still work.
  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed === search) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (status && status !== "all") params.set("status", status);
      if (trimmed) params.set("q", trimmed);
      const queryString = params.toString();
      router.push(queryString ? `/admin/esim/orders?${queryString}` : "/admin/esim/orders");
    }, 400);

    return () => clearTimeout(timer);
  }, [term, search, status, router]);

  function clearSearch() {
    setTerm("");
    apply({ q: "" });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        apply({});
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
      role="search"
    >
      <label className="sm:w-56">
        <span className="sr-only">Filter by status</span>
        <select
          value={status}
          onChange={(event) => apply({ status: event.target.value })}
          className="h-11 w-full rounded-lg border border-border-soft bg-white px-3 text-sm font-bold text-brand-navy outline-none focus:border-brand-blue dark:bg-white/10 dark:text-white"
        >
          {ESIM_ORDER_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-soft bg-white px-3 dark:bg-white/10">
        <Search aria-hidden="true" className="size-4 shrink-0 text-brand-brown" />
        <input
          type="search"
          name="q"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search reference, email, plan, country, code"
          aria-label="Search eSIM orders"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 bg-transparent text-sm text-brand-navy outline-none placeholder:text-brand-brown dark:text-white"
        />
        {term ? (
          <button
            type="button"
            onClick={clearSearch}
            className="grid size-8 shrink-0 place-items-center rounded-md text-brand-brown hover:text-brand-navy dark:hover:text-white"
            aria-label="Clear search"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>

      <button
        type="submit"
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-navy px-5 text-sm font-black text-white dark:bg-brand-sand dark:text-brand-navy"
      >
        Search
      </button>
    </form>
  );
}
