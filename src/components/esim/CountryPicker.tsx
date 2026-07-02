"use client";

import { Globe2, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  getCountryFlagDisplay,
  type CountryFlagDisplay,
} from "@/components/esim/country-flag";
import {
  buildPaginationSummary,
  PaginationControls,
} from "@/components/esim/PaginationControls";
import type { AirhubPublicCountry } from "@/server/providers/airhub/contracts";

const COUNTRIES_PER_PAGE = 24;

export function CountryPicker({
  countries,
}: {
  countries: AirhubPublicCountry[];
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const filteredCountries = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return countries;

    return countries.filter((country) =>
      [country.name, country.isoCode, country.regionName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  }, [countries, query]);
  const totalPages = Math.max(1, Math.ceil(filteredCountries.length / COUNTRIES_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const visibleCountries = useMemo(() => {
    const start = (currentPage - 1) * COUNTRIES_PER_PAGE;
    return filteredCountries.slice(start, start + COUNTRIES_PER_PAGE);
  }, [filteredCountries, currentPage]);
  const summary = buildPaginationSummary({
    page: currentPage,
    pageSize: COUNTRIES_PER_PAGE,
    total: filteredCountries.length,
    itemLabel: "countries",
  });

  return (
    <section className="mx-auto w-full max-w-[1080px] px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-border-soft bg-surface p-4 shadow-sm sm:p-6">
        <label className="text-xs font-black uppercase text-brand-blue">
          Destination
        </label>
        <div className="mt-3 flex min-h-12 items-center gap-3 rounded-lg border border-border-soft bg-white px-4 dark:bg-surface-muted">
          <Search className="size-5 shrink-0 text-brand-blue" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search country"
            className="min-w-0 flex-1 bg-transparent text-base font-bold text-brand-navy outline-none placeholder:text-brand-navy/45 dark:text-white dark:placeholder:text-white/45"
          />
        </div>

        {filteredCountries.length ? (
          <>
            <div className="mt-5">
              <PaginationControls
                page={currentPage}
                totalPages={totalPages}
                summary={summary}
                onPageChange={setPage}
              />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCountries.map((country) => (
                <CountryCard key={country.isoCode} country={country} />
              ))}
            </div>
            {totalPages > 1 ? (
              <div className="mt-5">
                <PaginationControls
                  page={currentPage}
                  totalPages={totalPages}
                  summary={summary}
                  onPageChange={setPage}
                />
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-border-soft p-8 text-center">
            <Globe2 className="mx-auto size-8 text-brand-blue" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-brand-navy/65 dark:text-white/65">
              No eSIM countries are synced yet.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function CountryCard({ country }: { country: AirhubPublicCountry }) {
  const [flagFailed, setFlagFailed] = useState(false);
  const flagDisplay = getCountryFlagDisplay({
    isoCode: country.isoCode,
    countryName: country.name,
    flagUrl: country.flagUrl,
    imageFailed: flagFailed,
  });

  return (
    <Link
      href={`/esim/${country.isoCode.toLowerCase()}`}
      className="flex min-h-20 items-center gap-3 rounded-lg border border-border-soft bg-white p-4 text-left transition hover:border-brand-blue hover:bg-surface-muted dark:bg-surface-muted dark:hover:border-brand-sand"
    >
      <CountryFlag display={flagDisplay} onImageError={() => setFlagFailed(true)} />
      <span className="min-w-0">
        <span className="block truncate text-base font-black">
          {country.name}
        </span>
        {country.regionName ? (
          <span className="mt-1 block truncate text-sm font-semibold text-brand-navy/55 dark:text-white/55">
            {country.regionName}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function CountryFlag({
  display,
  onImageError,
}: {
  display: CountryFlagDisplay;
  onImageError: () => void;
}) {
  if (display.kind === "image") {
    return (
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border-soft bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- Airhub returns remote SVG flag URLs; use img to avoid next/image remote SVG config. */}
        <img
          src={display.src}
          alt={display.alt}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={onImageError}
        />
      </span>
    );
  }

  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-sky text-sm font-black text-brand-navy">
      {display.label}
    </span>
  );
}
