"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
  { value: "featured", label: "Featured" },
];

type EsimVisibilityToolbarProps = {
  basePath: string;
  filter: string;
  search: string;
  searchPlaceholder: string;
  /** When provided, renders a country dropdown (plans page). */
  country?: string;
  countryOptions?: string[];
};

/**
 * Shared filter/search toolbar for the countries + plans admin pages. URL-driven
 * so the data stays server-rendered.
 */
export function EsimVisibilityToolbar({
  basePath,
  filter,
  search,
  searchPlaceholder,
  country,
  countryOptions,
}: EsimVisibilityToolbarProps) {
  const router = useRouter();
  const [term, setTerm] = useState(search);

  // Sync the input when the URL search param changes (submit / debounce /
  // browser back-forward) using the "adjust state during render" pattern.
  const [lastSearch, setLastSearch] = useState(search);
  if (search !== lastSearch) {
    setLastSearch(search);
    setTerm(search);
  }

  function apply(next: { filter?: string; q?: string; country?: string }) {
    const params = new URLSearchParams();
    const nextFilter = next.filter ?? filter;
    const nextCountry = next.country ?? country ?? "all";
    const nextQuery = (next.q ?? term).trim();

    if (nextFilter && nextFilter !== "all") params.set("filter", nextFilter);
    if (countryOptions && nextCountry && nextCountry !== "all") params.set("country", nextCountry);
    if (nextQuery) params.set("q", nextQuery);

    const queryString = params.toString();
    router.push(queryString ? `${basePath}?${queryString}` : basePath);
  }

  // Debounced auto-search: navigates 400ms after typing stops, only when the
  // term actually differs from the current URL. Enter/Search button still work.
  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed === search) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (filter && filter !== "all") params.set("filter", filter);
      if (countryOptions && country && country !== "all") params.set("country", country);
      if (trimmed) params.set("q", trimmed);
      const queryString = params.toString();
      router.push(queryString ? `${basePath}?${queryString}` : basePath);
    }, 400);

    return () => clearTimeout(timer);
  }, [term, search, filter, country, countryOptions, basePath, router]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        apply({});
      }}
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
      role="search"
    >
      <label className="sm:w-44">
        <span className="sr-only">Filter</span>
        <select
          value={filter}
          onChange={(event) => apply({ filter: event.target.value })}
          className="h-11 w-full rounded-lg border border-border-soft bg-white px-3 text-sm font-bold text-brand-navy outline-none focus:border-brand-blue dark:bg-white/10 dark:text-white"
        >
          {FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {countryOptions ? (
        <label className="sm:w-40">
          <span className="sr-only">Country</span>
          <select
            value={country ?? "all"}
            onChange={(event) => apply({ country: event.target.value })}
            className="h-11 w-full rounded-lg border border-border-soft bg-white px-3 text-sm font-bold text-brand-navy outline-none focus:border-brand-blue dark:bg-white/10 dark:text-white"
          >
            <option value="all">All countries</option>
            {countryOptions.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-soft bg-white px-3 dark:bg-white/10">
        <Search aria-hidden="true" className="size-4 shrink-0 text-brand-brown" />
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          autoComplete="off"
          className="h-11 min-w-0 flex-1 bg-transparent text-sm text-brand-navy outline-none placeholder:text-brand-brown dark:text-white"
        />
        {term ? (
          <button
            type="button"
            onClick={() => {
              setTerm("");
              apply({ q: "" });
            }}
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
