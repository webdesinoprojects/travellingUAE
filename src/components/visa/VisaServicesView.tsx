"use client";

import { ChevronRight, Globe2, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { VisaDestination, VisaPageContent } from "@/data/visa";
import { VisaLeadDrawer } from "@/components/visa/VisaLeadTools";

type VisaServicesViewProps = {
  page: VisaPageContent;
};

export function VisaServicesView({ page }: VisaServicesViewProps) {
  const [query, setQuery] = useState("");
  const [selectedDestination, setSelectedDestination] =
    useState<VisaDestination | null>(null);
  const destinationsRef = useRef<HTMLElement>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const destinations = useMemo(() => {
    if (!normalizedQuery) {
      return page.destinations;
    }

    return page.destinations.filter((destination) =>
      [
        destination.name,
        destination.countryCode,
        destination.processingLabel,
        destination.stayLabel,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [normalizedQuery, page.destinations]);

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    destinationsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <main className="min-h-screen bg-background pb-20 text-foreground">
      <section className="relative isolate flex min-h-[430px] items-end overflow-hidden pt-28 sm:min-h-[500px]">
        <Image
          src={page.heroImage}
          alt={page.heroAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(7_23_57/0.08),rgb(7_23_57/0.1)_36%,rgb(7_23_57/0.5)_72%,rgb(7_23_57/0.76))]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-brand-navy/42 backdrop-blur-[1px]" />

        <div className="section-shell relative z-10 grid gap-8 pb-10 sm:pb-12">
          <form
            className="mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-lg border border-white/35 bg-white/88 p-3 shadow-[0_22px_60px_rgb(0_0_0/0.22)] backdrop-blur-md sm:flex-row dark:bg-black/78"
            onSubmit={handleSearch}
            aria-label={`${page.heroTitle} search`}
          >
            <label className="relative min-h-12 flex-1">
              <span className="sr-only">Pick your destination</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Pick Your Destination"
                className="h-full w-full rounded-lg border border-border-soft bg-white px-5 pr-12 text-sm font-semibold text-brand-navy outline-none transition placeholder:text-brand-navy/55 focus:border-brand-blue focus:ring-2 focus:ring-brand-sky dark:bg-white/[0.08] dark:text-white dark:placeholder:text-white/55"
              />
              <Globe2
                aria-hidden="true"
                className="absolute right-4 top-1/2 size-5 -translate-y-1/2 text-brand-blue dark:text-brand-sand"
              />
            </label>
            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-blue px-7 text-sm font-bold text-white shadow-[0_14px_30px_rgb(18_63_118/0.24)] transition hover:bg-brand-navy dark:bg-brand-sand dark:text-brand-navy dark:hover:bg-brand-sand/90"
            >
              <Search aria-hidden="true" className="size-4" />
              Search
            </button>
          </form>

          <div className="mx-auto max-w-5xl text-center text-white">
            <h1 className="font-serif text-4xl font-black tracking-normal sm:text-5xl">
              {page.heroTitle}
            </h1>
            <p className="mx-auto mt-3 max-w-4xl text-base font-semibold text-white/88 sm:text-lg">
              {page.heroSubtitle}
            </p>
          </div>
        </div>
      </section>

      <section className="section-shell pt-10">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-foreground-muted"
        >
          <Link href="/" className="transition hover:text-brand-blue">
            Home
          </Link>
          <ChevronRight aria-hidden="true" className="size-4" />
          <span className="text-brand-blue dark:text-brand-sand">
            {page.breadcrumbLabel}
          </span>
        </nav>

        <section
          ref={destinationsRef}
          className="rounded-lg border border-border-soft bg-white/86 p-5 shadow-[0_18px_60px_rgb(7_23_57/0.08)] dark:bg-white/[0.04] sm:p-8"
        >
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-brown">
                Visa Desk
              </p>
              <h2 className="mt-2 font-serif text-3xl font-black text-brand-navy dark:text-white">
                {page.destinationsTitle}
              </h2>
            </div>
            <p className="text-sm font-semibold text-foreground-muted">
              {destinations.length} destinations available
            </p>
          </div>

          {destinations.length > 0 ? (
            <div className="grid gap-7 md:grid-cols-2 xl:grid-cols-3">
              {destinations.map((destination) => (
                <VisaDestinationCard
                  key={`${page.slug}:${destination.slug}`}
                  destination={destination}
                  onOpen={() => setSelectedDestination(destination)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border-soft bg-surface p-8 text-center">
              <h3 className="font-serif text-2xl font-black text-brand-navy dark:text-white">
                No destination matched
              </h3>
              <p className="mt-2 text-sm font-semibold text-foreground-muted">
                Try another country name or clear the search field.
              </p>
            </div>
          )}
        </section>
      </section>

      <VisaLeadDrawer
        open={selectedDestination != null}
        page={page}
        destination={selectedDestination}
        onClose={() => setSelectedDestination(null)}
      />
    </main>
  );
}

function VisaDestinationCard({
  destination,
  onOpen,
}: {
  destination: VisaDestination;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-lg border border-border-soft bg-surface text-left shadow-[0_18px_45px_rgb(7_23_57/0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgb(7_23_57/0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue dark:bg-white/[0.04]"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={destination.image}
          alt={destination.alt}
          fill
          sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 92vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <span className="absolute bottom-3 left-3 rounded border border-white/50 bg-brand-navy/86 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-white shadow-lg backdrop-blur-sm">
          {destination.countryCode}
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:p-5">
        <div>
          <h3 className="text-lg font-black text-brand-navy dark:text-white">
            {destination.name}
          </h3>
          <p className="mt-1 text-sm font-semibold text-foreground-muted">
            {destination.stayLabel}
            <span className="mx-3 text-border-soft">|</span>
            {destination.processingLabel}
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-lg font-black text-brand-blue dark:text-brand-sand">
            {destination.priceLabel.replace(" onwards", "")}
            <span className="ml-1 text-xs font-semibold text-foreground-muted">
              onwards
            </span>
          </p>
          <span
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-brand-blue px-5 text-sm font-black text-white transition hover:bg-brand-navy dark:bg-brand-sand dark:text-brand-navy dark:hover:bg-brand-sand/90"
          >
            More Details
          </span>
        </div>
      </div>
    </button>
  );
}
