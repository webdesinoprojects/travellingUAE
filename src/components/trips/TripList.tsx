"use client";

import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Filter,
  Heart,
  Hotel,
  MapPin,
  Plane,
  Route,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import type { TripDestination, TripPackage } from "@/types/travel";

type SortKey = "recommended" | "cheapest" | "duration";
type FlightFilter = "with" | "without" | null;

type TripListProps = {
  destination: TripDestination;
  destinations: TripDestination[];
  displayDate: string;
  initialLocation?: string;
};

export function TripList({
  destination,
  destinations,
  displayDate,
  initialLocation,
}: TripListProps) {
  const cityOptions = useMemo(
    () => Array.from(new Set(destination.packages.map((pkg) => pkg.city))),
    [destination.packages],
  );
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState<SortKey>("recommended");
  const [selectedCity, setSelectedCity] = useState(initialLocation ?? "all");
  const [flightFilter, setFlightFilter] = useState<FlightFilter>(null);
  const [selectedStar, setSelectedStar] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<TripPackage | null>(null);

  const activeCity = cityOptions.includes(selectedCity) ? selectedCity : "all";
  const cityPackages = useMemo(
    () =>
      activeCity === "all"
        ? destination.packages
        : destination.packages.filter((pkg) => pkg.city === activeCity),
    [activeCity, destination.packages],
  );
  const durationBounds = useMemo(
    () => getDurationBounds(cityPackages),
    [cityPackages],
  );
  const allDurationBounds = useMemo(
    () => getDurationBounds(destination.packages),
    [destination.packages],
  );
  const [durationMin, setDurationMin] = useState(durationBounds.min);
  const [durationMax, setDurationMax] = useState(durationBounds.max);
  const effectiveDurationMin = Math.max(durationMin, durationBounds.min);
  const effectiveDurationMax = Math.min(durationMax, durationBounds.max);
  const [draftDurationMin, setDraftDurationMin] = useState(durationBounds.min);
  const [draftDurationMax, setDraftDurationMax] = useState(durationBounds.max);
  const [draftFlightFilter, setDraftFlightFilter] = useState<FlightFilter>(null);
  const [draftSelectedStar, setDraftSelectedStar] = useState<string | null>(null);
  const [draftSelectedCategories, setDraftSelectedCategories] = useState<string[]>(
    [],
  );

  const categoryCounts = useMemo(
    () => getCategoryCounts(destination, cityPackages),
    [destination, cityPackages],
  );
  const starCounts = useMemo(
    () => getStarCounts(destination, cityPackages),
    [destination, cityPackages],
  );

  const filteredPackages = useMemo(() => {
    const query = keyword.trim().toLowerCase();

    return cityPackages
      .filter((pkg) => {
        const matchesKeyword =
          !query ||
          [pkg.title, pkg.city, pkg.overview, ...pkg.tags, ...pkg.categories]
            .join(" ")
            .toLowerCase()
            .includes(query);
        const matchesDuration =
          pkg.durationDays >= effectiveDurationMin &&
          pkg.durationDays <= effectiveDurationMax;
        const matchesFlight =
          !flightFilter ||
          (flightFilter === "with" ? pkg.hasFlights : !pkg.hasFlights);
        const matchesStar =
          !selectedStar ||
          (selectedStar === "<3"
            ? pkg.hotelStar < 3
            : pkg.hotelStar === Number(selectedStar));
        const matchesCategories =
          selectedCategories.length === 0 ||
          selectedCategories.every((category) =>
            pkg.categories.includes(category),
          );

        return (
          matchesKeyword &&
          matchesDuration &&
          matchesFlight &&
          matchesStar &&
          matchesCategories
        );
      })
      .toSorted((left, right) => {
        if (sort === "cheapest") {
          return left.priceAmount - right.priceAmount;
        }

        if (sort === "duration") {
          return left.durationDays - right.durationDays;
        }

        return (
          Number(right.badge === "Recommended") -
          Number(left.badge === "Recommended")
        );
      });
  }, [
    cityPackages,
    effectiveDurationMax,
    effectiveDurationMin,
    flightFilter,
    keyword,
    selectedCategories,
    selectedStar,
    sort,
  ]);

  function toggleDraftCategory(category: string) {
    setDraftSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  }

  function openFilterDrawer() {
    setDraftDurationMin(effectiveDurationMin);
    setDraftDurationMax(effectiveDurationMax);
    setDraftFlightFilter(flightFilter);
    setDraftSelectedStar(selectedStar);
    setDraftSelectedCategories(selectedCategories);
    setIsFilterDrawerOpen(true);
  }

  function applyFilters() {
    const nextMin = Math.max(
      Math.min(draftDurationMin, draftDurationMax),
      durationBounds.min,
    );
    const nextMax = Math.min(
      Math.max(draftDurationMax, draftDurationMin),
      durationBounds.max,
    );

    setDurationMin(nextMin);
    setDurationMax(nextMax);
    setFlightFilter(draftFlightFilter);
    setSelectedStar(draftSelectedStar);
    setSelectedCategories(draftSelectedCategories);
    setIsFilterDrawerOpen(false);
  }

  function resetDraftFilters() {
    setDraftDurationMin(durationBounds.min);
    setDraftDurationMax(durationBounds.max);
    setDraftFlightFilter(null);
    setDraftSelectedStar(null);
    setDraftSelectedCategories([]);
  }

  function clearFilters() {
    setKeyword("");
    setSelectedCity("all");
    setFlightFilter(null);
    setSelectedStar(null);
    setSelectedCategories([]);
    setDurationMin(allDurationBounds.min);
    setDurationMax(allDurationBounds.max);
    resetDraftFilters();
  }

  return (
    <>
      <main className="min-h-screen bg-background pt-28 text-brand-navy dark:bg-black dark:text-white">
        <CountryHero
          destination={destination}
          destinations={destinations}
          keyword={keyword}
          onKeywordChange={setKeyword}
          selectedCity={activeCity}
          cityOptions={cityOptions}
          onCityChange={setSelectedCity}
          displayDate={displayDate}
        />

        <section className="section-shell py-7">
          <div className="modern-card rounded-lg p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-brand-blue dark:text-brand-sand">
                  <SlidersHorizontal aria-hidden="true" className="size-4" />
                  {filteredPackages.length} trips available
                </p>
                <h2 className="mt-1 text-2xl font-extrabold leading-tight text-brand-navy dark:text-white sm:text-3xl">
                  {activeCity === "all"
                    ? `${destination.name} packages`
                    : `${activeCity} packages`}
                </h2>
              </div>

              <div className="flex items-center gap-2 self-start lg:self-auto">
                <button
                  type="button"
                  onClick={openFilterDrawer}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-soft bg-surface px-4 text-sm font-extrabold text-brand-navy transition hover:border-brand-blue dark:bg-neutral-950 dark:text-white"
                >
                  <Filter aria-hidden="true" className="size-4" />
                  Filters
                </button>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-11 items-center rounded-lg border border-border-soft px-4 text-sm font-bold text-brand-blue transition hover:border-brand-blue dark:text-brand-sand"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_230px] sm:items-center">
              <p className="text-sm font-semibold text-brand-navy/70 dark:text-white/70">
                All departures and arrivals are local time. Taxes and fees are
                included.
              </p>
              <label className="relative block">
                <span className="sr-only">Sort trips</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortKey)}
                  className="h-11 w-full appearance-none rounded-lg border border-border-soft bg-surface px-4 text-sm font-bold text-brand-navy outline-none transition focus:border-brand-blue dark:bg-neutral-950 dark:text-white"
                >
                  <option value="recommended">Recommended</option>
                  <option value="cheapest">Cheapest price</option>
                  <option value="duration">Shortest duration</option>
                </select>
              </label>
            </div>
          </div>

          {filteredPackages.length > 0 ? (
            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredPackages.map((pkg, index) => (
                <TripResultCard
                  key={pkg.slug}
                  pkg={pkg}
                  priority={index < 3}
                  onOpen={() => setSelectedTrip(pkg)}
                />
              ))}
            </div>
          ) : (
            <EmptyResults onClear={clearFilters} />
          )}
        </section>
      </main>

      <FilterDrawer
        open={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        durationBounds={durationBounds}
        durationMin={draftDurationMin}
        durationMax={draftDurationMax}
        onDurationMinChange={(value) =>
          setDraftDurationMin(Math.min(value, draftDurationMax))
        }
        onDurationMaxChange={(value) =>
          setDraftDurationMax(Math.max(value, draftDurationMin))
        }
        flightFilter={draftFlightFilter}
        onFlightChange={(value) =>
          setDraftFlightFilter((current) => (current === value ? null : value))
        }
        starCounts={starCounts}
        selectedStar={draftSelectedStar}
        onStarChange={(value) =>
          setDraftSelectedStar((current) => (current === value ? null : value))
        }
        categoryCounts={categoryCounts}
        selectedCategories={draftSelectedCategories}
        onCategoryChange={toggleDraftCategory}
        onReset={resetDraftFilters}
        onApply={applyFilters}
      />
      <TripDrawer
        destinationSlug={destination.slug}
        trip={selectedTrip}
        onClose={() => setSelectedTrip(null)}
      />
      <SiteFooter />
    </>
  );
}

function CountryHero({
  destination,
  destinations,
  keyword,
  onKeywordChange,
  selectedCity,
  cityOptions,
  onCityChange,
  displayDate,
}: {
  destination: TripDestination;
  destinations: TripDestination[];
  keyword: string;
  onKeywordChange: (value: string) => void;
  selectedCity: string;
  cityOptions: string[];
  onCityChange: (value: string) => void;
  displayDate: string;
}) {
  return (
    <section className="section-shell">
      <div className="relative overflow-hidden rounded-lg border border-border-soft bg-brand-navy text-white shadow-[0_24px_70px_rgb(7_23_57/0.18)] dark:bg-neutral-950">
        <Image
          src={destination.poster.image}
          alt={destination.poster.alt}
          fill
          priority
          sizes="(min-width: 1280px) 1500px, 100vw"
          className="object-cover opacity-45 motion-safe:scale-105"
        />
        <div className="absolute inset-0 bg-linear-to-r from-black/82 via-black/34 to-black/60" />
        <div className="relative px-4 pb-24 pt-10 sm:px-7 lg:px-9 lg:pb-28 lg:pt-14">
          <p className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold text-brand-sand backdrop-blur">
            <MapPin aria-hidden="true" className="size-4" />
            Explore {destination.name}
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.03] tracking-tight sm:text-5xl lg:text-6xl">
            Compare curated trips without leaving the results page.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/76">
            Search packages, compare inclusions and open trip details in a
            side panel so users stay in the shopping flow.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {destinations.map((item) => (
              <Link
                key={item.slug}
                href={`/trips/${item.slug}`}
                className={[
                  "rounded-lg border px-4 py-2 text-sm font-bold transition",
                  item.slug === destination.slug
                    ? "border-brand-sand bg-brand-sand text-brand-navy"
                    : "border-white/18 bg-white/10 text-white hover:bg-white/18",
                ].join(" ")}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="absolute inset-x-4 bottom-4 z-10 rounded-lg border border-white/20 bg-white/92 p-3 text-brand-navy shadow-[0_20px_55px_rgb(0_0_0/0.2)] backdrop-blur-xl dark:bg-neutral-950/92 dark:text-white sm:inset-x-7 lg:inset-x-9">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px]">
            <label className="flex h-12 items-center rounded-lg border border-border-soft bg-surface px-4 dark:bg-black">
              <Search aria-hidden="true" className="mr-3 size-5 text-brand-blue dark:text-brand-sand" />
              <span className="sr-only">Search packages</span>
              <input
                value={keyword}
                onChange={(event) => onKeywordChange(event.target.value)}
                placeholder="Search package, city, style"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-brand-blue/48 dark:text-white dark:placeholder:text-white/45"
              />
            </label>
            <label className="block">
              <span className="sr-only">City</span>
              <select
                value={selectedCity}
                onChange={(event) => onCityChange(event.target.value)}
                className="h-12 w-full rounded-lg border border-border-soft bg-surface px-4 text-sm font-bold outline-none dark:bg-black"
              >
                <option value="all">All cities</option>
                {cityOptions.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid place-items-center rounded-lg border border-border-soft bg-surface px-4 text-center text-sm font-extrabold dark:bg-black">
              {displayDate}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FilterDrawer({
  open,
  onClose,
  durationBounds,
  durationMin,
  durationMax,
  onDurationMinChange,
  onDurationMaxChange,
  flightFilter,
  onFlightChange,
  starCounts,
  selectedStar,
  onStarChange,
  categoryCounts,
  selectedCategories,
  onCategoryChange,
  onReset,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  durationBounds: { min: number; max: number };
  durationMin: number;
  durationMax: number;
  onDurationMinChange: (value: number) => void;
  onDurationMaxChange: (value: number) => void;
  flightFilter: FlightFilter;
  onFlightChange: (value: Exclude<FlightFilter, null>) => void;
  starCounts: Array<{ label: string; count: number }>;
  selectedStar: string | null;
  onStarChange: (value: string) => void;
  categoryCounts: Array<{ label: string; count: number }>;
  selectedCategories: string[];
  onCategoryChange: (value: string) => void;
  onReset: () => void;
  onApply: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[82]">
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 bg-black/52 backdrop-blur-[2px]"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl border border-border-soft bg-surface p-4 shadow-[0_-20px_56px_rgb(0_0_0/0.28)] dark:bg-black sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.18em] text-brand-navy dark:text-white">
            <Filter aria-hidden="true" className="size-4" />
            Filters
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg border border-border-soft text-brand-navy transition hover:border-brand-blue dark:text-white"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <FilterSection title="Duration">
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Min"
              value={durationMin}
              min={durationBounds.min}
              max={durationMax}
              onChange={onDurationMinChange}
            />
            <NumberField
              label="Max"
              value={durationMax}
              min={durationMin}
              max={durationBounds.max}
              onChange={onDurationMaxChange}
            />
          </div>
        </FilterSection>

        <FilterSection title="Flights">
          <div className="grid grid-cols-2 gap-2">
            <FilterOption
              active={flightFilter === "with"}
              onClick={() => onFlightChange("with")}
            >
              With
            </FilterOption>
            <FilterOption
              active={flightFilter === "without"}
              onClick={() => onFlightChange("without")}
            >
              Without
            </FilterOption>
          </div>
        </FilterSection>

        <FilterSection title="Hotel class">
          <div className="flex flex-wrap gap-2">
            {starCounts.map((star) => (
              <FilterOption
                key={star.label}
                active={selectedStar === star.label}
                onClick={() => onStarChange(star.label)}
              >
                {star.label}
                <Star aria-hidden="true" className="size-3 fill-current" />
                <span className="opacity-60">({star.count})</span>
              </FilterOption>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Travel style">
          <div className="grid gap-2">
            {categoryCounts.map((category) => (
              <button
                key={category.label}
                type="button"
                onClick={() => onCategoryChange(category.label)}
                className={[
                  "flex min-h-10 items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm font-semibold transition",
                  selectedCategories.includes(category.label)
                    ? "border-brand-blue bg-brand-blue text-white dark:border-brand-sand dark:bg-brand-sand dark:text-brand-navy"
                    : "border-border-soft bg-surface text-brand-navy hover:border-brand-blue dark:bg-neutral-950 dark:text-white",
                ].join(" ")}
              >
                <span className="inline-flex items-center gap-2">
                  {selectedCategories.includes(category.label) ? (
                    <CheckCircle2 aria-hidden="true" className="size-4" />
                  ) : null}
                  {category.label}
                </span>
                <span className="opacity-70">{category.count}</span>
              </button>
            ))}
          </div>
        </FilterSection>

        <div className="sticky bottom-0 mt-6 grid grid-cols-2 gap-2 border-t border-border-soft bg-surface pt-4 dark:bg-black">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border-soft text-sm font-bold text-brand-blue transition hover:border-brand-blue dark:text-brand-sand"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onApply}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-blue text-sm font-extrabold text-white transition hover:bg-brand-blue-strong dark:bg-brand-sand dark:text-brand-navy"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function TripResultCard({
  pkg,
  priority,
  onOpen,
}: {
  pkg: TripPackage;
  priority: boolean;
  onOpen: () => void;
}) {
  return (
    <article className="modern-card group overflow-hidden rounded-lg bg-surface transition hover:-translate-y-0.5">
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg bg-surface-muted">
        <Image
          src={pkg.image}
          alt={pkg.alt}
          fill
          priority={priority}
          sizes="(min-width: 1280px) 380px, (min-width: 768px) 50vw, 100vw"
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/58 via-transparent to-black/16" />
        <button
          type="button"
          aria-label={`Save ${pkg.title}`}
          className="absolute right-3 top-3 grid size-10 place-items-center rounded-lg border border-white/30 bg-white/18 text-white backdrop-blur transition hover:bg-white hover:text-brand-blue"
        >
          <Heart aria-hidden="true" className="size-5" />
        </button>
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs font-black text-brand-navy">
          <Star aria-hidden="true" className="size-3.5 fill-brand-navy" />
          4.9/5
        </div>
        <div className="absolute bottom-3 left-3 rounded-lg border border-white/25 bg-white/16 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
          {pkg.badge}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold leading-tight text-brand-navy dark:text-white">
              {pkg.title}
            </h3>
            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-brand-navy/62 dark:text-white/62">
              <MapPin aria-hidden="true" className="size-4" />
              {pkg.city}
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-surface-muted px-2.5 py-1.5 text-xs font-black text-brand-blue dark:bg-white/[0.08] dark:text-brand-sand">
            {pkg.durationLabel}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <CardInclusion
            icon={Plane}
            label={pkg.hasFlights ? "Flights" : "No flight"}
          />
          <CardInclusion icon={Hotel} label={`${pkg.hotelStar}-star`} />
          <CardInclusion icon={Route} label="Tours" />
        </div>

        <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-brand-navy/68 dark:text-white/68">
          {pkg.overview}
        </p>

        <div className="mt-4 flex items-center gap-2 text-xs font-extrabold text-brand-green dark:text-brand-sand">
          <ShieldCheck aria-hidden="true" className="size-4" />
          Verified agent
        </div>

        <div className="mt-5 flex items-end justify-between gap-3 border-t border-border-soft pt-4">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex h-11 items-center rounded-lg bg-brand-blue px-4 text-sm font-extrabold text-white transition hover:bg-brand-blue-strong dark:bg-brand-sand dark:text-brand-navy"
          >
            Explore Trip
            <ArrowRight aria-hidden="true" className="ml-2 size-4" />
          </button>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-navy/50 dark:text-white/50">
              From
            </p>
            <p className="text-xl font-black text-brand-blue dark:text-brand-sand">
              {pkg.price}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function TripDrawer({
  destinationSlug,
  trip,
  onClose,
}: {
  destinationSlug: string;
  trip: TripPackage | null;
  onClose: () => void;
}) {
  if (!trip) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        aria-label="Close trip details"
        className="absolute inset-0 bg-black/52 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col overflow-y-auto bg-surface text-brand-navy shadow-[-24px_0_80px_rgb(0_0_0/0.28)] dark:bg-black dark:text-white">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-soft bg-surface/94 p-4 backdrop-blur dark:bg-black/94">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-blue dark:text-brand-sand">
              Trip preview
            </p>
            <h2 className="mt-1 text-lg font-extrabold">{trip.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-lg border border-border-soft hover:bg-surface-muted dark:hover:bg-neutral-900"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <figure className="relative h-64 bg-surface-muted">
          <Image
            src={trip.image}
            alt={trip.alt}
            fill
            sizes="520px"
            className="object-cover"
          />
        </figure>

        <div className="grid gap-6 p-5">
          <div className="grid grid-cols-3 gap-2">
            <PreviewMetric icon={Clock3} label="Duration" value={trip.durationLabel} />
            <PreviewMetric icon={Users} label="Travelers" value={trip.travelers} />
            <PreviewMetric icon={Hotel} label="Hotel" value={`${trip.hotelStar} star`} />
          </div>

          <section>
            <h3 className="text-base font-extrabold">Overview</h3>
            <p className="mt-2 text-sm leading-6 text-brand-navy/70 dark:text-white/70">
              {trip.overview}
            </p>
          </section>

          <section>
            <h3 className="text-base font-extrabold">What users get</h3>
            <ul className="mt-3 grid gap-2">
              {trip.inclusions.slice(0, 5).map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 text-sm font-semibold text-brand-navy/78 dark:text-white/78"
                >
                  <BadgeCheck
                    aria-hidden="true"
                    className="size-4 text-brand-blue dark:text-brand-sand"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <div className="rounded-lg border border-border-soft bg-surface-muted/55 p-4 dark:bg-neutral-950">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-blue/70 dark:text-brand-sand">
              Starts from
            </p>
            <p className="mt-1 text-3xl font-black text-brand-blue dark:text-brand-sand">
              {trip.price}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <a
                href="#contact"
                className="flex h-11 items-center justify-center rounded-lg bg-brand-blue text-sm font-extrabold text-white dark:bg-brand-sand dark:text-brand-navy"
              >
                Book enquiry
              </a>
              <Link
                href={`/trips/${destinationSlug}/${trip.slug}`}
                className="flex h-11 items-center justify-center rounded-lg border border-border-soft text-sm font-extrabold hover:border-brand-blue"
              >
                Full details
              </Link>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function CardInclusion({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="rounded-lg border border-border-soft bg-surface-muted/60 p-2.5 text-center dark:bg-neutral-950">
      <Icon
        aria-hidden="true"
        className="mx-auto size-4 text-brand-blue dark:text-brand-sand"
      />
      <p className="mt-1 truncate text-xs font-bold text-brand-navy dark:text-white">
        {label}
      </p>
    </div>
  );
}

function PreviewMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border-soft p-3 text-center">
      <Icon
        aria-hidden="true"
        className="mx-auto size-4 text-brand-blue dark:text-brand-sand"
      />
      <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-navy/48 dark:text-white/48">
        {label}
      </p>
      <p className="mt-1 text-xs font-extrabold">{value}</p>
    </div>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 border-t border-border-soft pt-5">
      <h3 className="mb-3 text-sm font-extrabold text-brand-navy dark:text-white">
        {title}
      </h3>
      {children}
    </section>
  );
}

function FilterOption({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-bold transition",
        active
          ? "border-brand-blue bg-brand-blue text-white dark:border-brand-sand dark:bg-brand-sand dark:text-brand-navy"
          : "border-border-soft bg-surface text-brand-navy hover:border-brand-blue dark:bg-neutral-950 dark:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-lg border border-border-soft bg-surface px-3 py-2 dark:bg-neutral-950">
      <span className="block text-xs font-bold uppercase tracking-[0.14em] text-brand-blue/70 dark:text-brand-sand">
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full bg-transparent text-sm font-extrabold text-brand-navy outline-none dark:text-white"
      />
    </label>
  );
}

function EmptyResults({ onClear }: { onClear: () => void }) {
  return (
    <section className="modern-card mt-5 rounded-lg p-10 text-center">
      <X
        aria-hidden="true"
        className="mx-auto size-8 text-brand-blue dark:text-brand-sand"
      />
      <h2 className="mt-4 text-2xl font-extrabold">No trips found</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-brand-navy/70 dark:text-white/70">
        Adjust your filters or reset them to see the available holiday
        packages for this destination.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-5 h-11 rounded-lg bg-brand-blue px-5 text-sm font-extrabold text-white dark:bg-brand-sand dark:text-brand-navy"
      >
        Clear filters
      </button>
    </section>
  );
}

function getDurationBounds(packages: TripPackage[]) {
  if (packages.length === 0) {
    return { min: 0, max: 0 };
  }

  const durations = packages.map((pkg) => pkg.durationDays);
  return {
    min: Math.min(...durations),
    max: Math.max(...durations),
  };
}

function getCategoryCounts(
  destination: TripDestination,
  packages: TripPackage[],
) {
  const labels = new Set(destination.categories.map((category) => category.label));

  packages.forEach((pkg) => {
    pkg.categories.forEach((category) => labels.add(category));
  });

  return Array.from(labels).map((label) => ({
    label,
    count: packages.filter((pkg) => pkg.categories.includes(label)).length,
  }));
}

function getStarCounts(destination: TripDestination, packages: TripPackage[]) {
  const labels =
    destination.hotelStars.length > 0
      ? destination.hotelStars.map((star) => star.label)
      : ["<3", "3", "4", "5"];

  return labels.map((label) => ({
    label,
    count: packages.filter((pkg) =>
      label === "<3" ? pkg.hotelStar < 3 : pkg.hotelStar === Number(label),
    ).length,
  }));
}
