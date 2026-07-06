"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

/** Kept short per project convention - long debounces read as sluggish. */
const DEBOUNCE_MS = 250;

/**
 * Debounced, uncontrolled search box. The parent supplies `initialValue` once
 * and receives updates via `onChange` after typing settles; remount with a new
 * `key` (see PlanToolbar's reset button) to snap it back to a cleared value.
 */
export function PlanSearchInput({
  initialValue,
  onChange,
}: {
  initialValue: string;
  onChange: (value: string) => void;
}) {
  const [term, setTerm] = useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => onChange(term), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce fires on term only; onChange is stable per render from the parent's updater.
  }, [term]);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-soft bg-surface px-3">
      <Search className="size-4 shrink-0 text-brand-navy/40 dark:text-white/40" aria-hidden="true" />
      <input
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search plan, country, or operator"
        aria-label="Search eSIM plans"
        autoComplete="off"
        className="h-11 min-w-0 flex-1 bg-transparent text-sm font-semibold text-brand-navy outline-none placeholder:text-brand-navy/40 dark:text-white dark:placeholder:text-white/40"
      />
      {term ? (
        <button
          type="button"
          onClick={() => setTerm("")}
          aria-label="Clear search"
          className="grid size-8 shrink-0 place-items-center rounded-md text-brand-navy/50 transition hover:text-brand-navy dark:text-white/50 dark:hover:text-white"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
