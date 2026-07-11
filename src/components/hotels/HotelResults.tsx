"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  Search,
  SlidersHorizontal,
  Star,
  UtensilsCrossed,
  X,
} from "lucide-react";

import { HotelImage } from "@/components/hotels/HotelImage";
import {
  DEFAULT_HOTEL_FILTER,
  computeHotelFacets,
  filterAndSortHotels,
  isDefaultHotelFilter,
  type HotelFilterState,
  type HotelSortKey,
} from "@/lib/hotel-search-filter";
import type { HotelSearchCardDTO } from "@/types/hotels";

const SORT_OPTIONS: Array<{ value: HotelSortKey; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "star_desc", label: "Star rating" },
  { value: "name_asc", label: "Name (A–Z)" },
];

/**
 * Client-side hotel results: left filter sidebar + vertical list of horizontal
 * cards. All filtering/sorting runs over the already-loaded live results — no
 * provider call, no invented data, real facet counts. Booking is untouched (each
 * card links to the existing detail page which owns Select/Book).
 */
export function HotelResults({
  hotels,
  searchId,
}: {
  hotels: HotelSearchCardDTO[];
  searchId: string;
}) {
  const [filter, setFilter] = useState<HotelFilterState>(DEFAULT_HOTEL_FILTER);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const facets = useMemo(() => computeHotelFacets(hotels), [hotels]);
  const visible = useMemo(() => filterAndSortHotels(hotels, filter), [hotels, filter]);

  const patch = (next: Partial<HotelFilterState>) => setFilter((f) => ({ ...f, ...next }));
  const reset = () => setFilter(DEFAULT_HOTEL_FILTER);

  const filters = (
    <FilterPanel facets={facets} filter={filter} patch={patch} reset={reset} />
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">{filters}</div>
      </aside>

      <div className="min-w-0">
        {/* Toolbar: count + sort + mobile filter button */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-black text-brand-navy dark:text-white">
            {visible.length} of {hotels.length}{" "}
            {hotels.length === 1 ? "property" : "properties"}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border-soft bg-surface px-3 text-sm font-bold lg:hidden"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filters
              {!isDefaultHotelFilter(filter) ? (
                <span className="size-2 rounded-full bg-brand-blue" aria-hidden="true" />
              ) : null}
            </button>
            <label className="inline-flex items-center gap-2 rounded-lg border border-border-soft bg-surface px-3 text-sm font-bold">
              <span className="hidden text-brand-brown sm:inline">Sort</span>
              <select
                value={filter.sort}
                onChange={(e) => patch({ sort: e.target.value as HotelSortKey })}
                aria-label="Sort hotels"
                className="min-h-10 bg-transparent font-bold outline-none"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* List */}
        {visible.length > 0 ? (
          <div className="grid gap-3">
            {visible.map((hotel) => (
              <HotelRow key={hotel.quoteId} hotel={hotel} searchId={searchId} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border-soft bg-surface p-8 text-center">
            <p className="text-lg font-black">No hotels match your filters</p>
            <button type="button" onClick={reset} className="mt-3 text-sm font-black text-brand-blue">
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Mobile filter drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
              <span className="text-base font-black">Filters</span>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close filters" className="p-1">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{filters}</div>
            <div className="border-t border-border-soft p-4">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="min-h-11 w-full rounded-lg bg-brand-blue text-sm font-black text-white"
              >
                Show {visible.length} results
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterPanel({
  facets,
  filter,
  patch,
  reset,
}: {
  facets: ReturnType<typeof computeHotelFacets>;
  filter: HotelFilterState;
  patch: (next: Partial<HotelFilterState>) => void;
  reset: () => void;
}) {
  const toggleStar = (value: number) =>
    patch({
      stars: filter.stars.includes(value)
        ? filter.stars.filter((s) => s !== value)
        : [...filter.stars, value],
    });
  const toggleBoard = (value: string) =>
    patch({
      boards: filter.boards.includes(value)
        ? filter.boards.filter((b) => b !== value)
        : [...filter.boards, value],
    });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-brand-brown">Filters</h2>
        {!isDefaultHotelFilter(filter) ? (
          <button type="button" onClick={reset} className="text-xs font-black text-brand-blue">
            Clear all
          </button>
        ) : null}
      </div>

      {/* Name search */}
      <FilterCard title="Hotel name">
        <div className="flex min-h-10 items-center gap-2 rounded-lg border border-border-soft bg-white px-3 dark:bg-surface-muted">
          <Search className="size-4 shrink-0 text-brand-blue" aria-hidden="true" />
          <input
            value={filter.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="e.g. Hilton"
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-brand-navy/40"
          />
        </div>
      </FilterCard>

      {/* Price range (only when prices exist) */}
      {facets.priceMin !== null && facets.priceMax !== null && facets.priceMax > facets.priceMin ? (
        <FilterCard title={`Price ${facets.currency ? `(${facets.currency})` : ""}`.trim()}>
          <div className="flex items-center gap-2">
            <NumberField
              value={filter.minPrice}
              placeholder={String(facets.priceMin)}
              ariaLabel="Minimum price"
              onChange={(v) => patch({ minPrice: v })}
            />
            <span className="text-brand-brown">–</span>
            <NumberField
              value={filter.maxPrice}
              placeholder={String(facets.priceMax)}
              ariaLabel="Maximum price"
              onChange={(v) => patch({ maxPrice: v })}
            />
          </div>
        </FilterCard>
      ) : null}

      {/* Star rating (real counts) */}
      {facets.stars.length > 0 ? (
        <FilterCard title="Star rating">
          <ul className="grid gap-1.5">
            {facets.stars.map(({ value, count }) => (
              <li key={value}>
                <label className="flex cursor-pointer items-center justify-between gap-2 text-sm font-bold">
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filter.stars.includes(value)}
                      onChange={() => toggleStar(value)}
                      className="size-4 accent-brand-blue"
                    />
                    <span className="inline-flex">
                      {Array.from({ length: value }, (_, i) => (
                        <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                      ))}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-brand-brown">{count}</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterCard>
      ) : null}

      {/* Board basis (real counts) */}
      {facets.boards.length > 0 ? (
        <FilterCard title="Meals">
          <ul className="grid gap-1.5">
            {facets.boards.map(({ value, label, count }) => (
              <li key={value}>
                <label className="flex cursor-pointer items-center justify-between gap-2 text-sm font-bold">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filter.boards.includes(value)}
                      onChange={() => toggleBoard(value)}
                      className="size-4 shrink-0 accent-brand-blue"
                    />
                    <span className="truncate">{label}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-brand-brown">{count}</span>
                </label>
              </li>
            ))}
          </ul>
        </FilterCard>
      ) : null}

      {/* Has image (real count) */}
      {facets.withImageCount > 0 && facets.withImageCount < facets.total ? (
        <FilterCard title="Photos">
          <label className="flex cursor-pointer items-center justify-between gap-2 text-sm font-bold">
            <span className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={filter.onlyWithImage}
                onChange={(e) => patch({ onlyWithImage: e.target.checked })}
                className="size-4 accent-brand-blue"
              />
              Has photo
            </span>
            <span className="text-xs font-semibold text-brand-brown">{facets.withImageCount}</span>
          </label>
        </FilterCard>
      ) : null}
    </div>
  );
}

function HotelRow({ hotel, searchId }: { hotel: HotelSearchCardDTO; searchId: string }) {
  const perNight = hotel.nights > 0 ? Math.round(hotel.priceAmount / hotel.nights) : null;
  const star = hotel.starRating ? Math.max(1, Math.min(5, Math.round(hotel.starRating))) : 0;

  return (
    <article className="group grid overflow-hidden rounded-lg border border-border-soft bg-surface shadow-sm transition hover:border-brand-blue/60 hover:shadow-md sm:grid-cols-[240px_minmax(0,1fr)]">
      <div className="relative overflow-hidden bg-surface-muted">
        <HotelImage
          src={hotel.imageUrl}
          alt={hotel.name}
          sizes="(max-width: 640px) 100vw, 240px"
          className="h-44 w-full transition duration-500 group-hover:scale-[1.04] sm:h-full sm:min-h-[188px]"
        />
      </div>

      <div className="grid min-w-0 gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-5">
        <div className="min-w-0">
          {star ? (
            <span className="mb-1 inline-flex" aria-label={`${star} star hotel`}>
              {Array.from({ length: star }, (_, i) => (
                <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
              ))}
            </span>
          ) : null}
          <h3 className="truncate text-lg font-black">{hotel.name}</h3>
          {hotel.address ? (
            <p className="mt-1 line-clamp-2 text-sm text-brand-navy/58 dark:text-white/58">{hotel.address}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {hotel.roomName ? (
              <Badge icon={<BedDouble className="size-3.5" aria-hidden="true" />} label={hotel.roomName} />
            ) : null}
            {hotel.boardBasis ? (
              <Badge icon={<UtensilsCrossed className="size-3.5" aria-hidden="true" />} label={hotel.boardBasis} />
            ) : null}
          </div>
        </div>

        <div className="flex items-end justify-between gap-3 border-t border-border-soft pt-4 sm:flex-col sm:items-end sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          <div className="sm:text-right">
            <span className="block text-[11px] font-bold uppercase text-brand-navy/50 dark:text-white/50">
              {hotel.nights > 0 ? `${hotel.nights} night${hotel.nights === 1 ? "" : "s"} from` : "From"}
            </span>
            <span className="text-xl font-black">
              {hotel.currency} {hotel.priceAmount.toLocaleString("en")}
            </span>
            {perNight ? (
              <span className="block text-xs font-semibold text-brand-navy/50 dark:text-white/50">
                {hotel.currency} {perNight.toLocaleString("en")} / night
              </span>
            ) : null}
          </div>
          <Link
            href={`/hotels/${encodeURIComponent(hotel.hotelId)}?search=${searchId}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-blue px-4 text-sm font-extrabold text-white transition hover:bg-brand-navy"
          >
            View rooms
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function FilterCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border-soft bg-surface p-4">
      <h3 className="mb-3 text-xs font-black uppercase tracking-[0.1em] text-brand-brown">{title}</h3>
      {children}
    </section>
  );
}

function NumberField({
  value,
  placeholder,
  ariaLabel,
  onChange,
}: {
  value: number | null;
  placeholder: string;
  ariaLabel: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      aria-label={ariaLabel}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value.trim();
        if (raw === "") return onChange(null);
        const n = Number(raw);
        onChange(Number.isFinite(n) ? n : null);
      }}
      className="min-h-10 w-full min-w-0 rounded-lg border border-border-soft bg-white px-2 text-sm font-bold outline-none dark:bg-surface-muted"
    />
  );
}

function Badge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border-soft bg-surface-muted px-2 py-1 text-xs font-bold text-brand-navy/75 dark:text-white/75">
      <span className="shrink-0 text-brand-blue dark:text-brand-sand">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}
