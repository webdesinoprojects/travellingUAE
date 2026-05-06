import {
  BedDouble,
  CalendarDays,
  Check,
  ChevronDown,
  Hotel,
  Plane,
  Route,
  Star,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { TripGallery } from "@/components/trips/TripGallery";
import type { TripDestination, TripGalleryImage, TripPackage } from "@/types/travel";

type TripDetailProps = {
  destination: TripDestination;
  pkg: TripPackage;
};

export function TripDetail({ destination, pkg }: TripDetailProps) {
  const itinerary = buildItinerary(pkg);
  const recommended = destination.packages
    .filter((item) => item.slug !== pkg.slug)
    .concat(destination.packages)
    .slice(0, 3);

  return (
    <>
      <main className="min-h-screen bg-background pt-28 text-brand-navy dark:bg-black dark:text-white">
        <section className="section-shell">
          <TripGallery images={pkg.gallery} title={pkg.title} />
        </section>

        <section className="section-shell grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_390px]">
          <article className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-extrabold text-brand-blue dark:bg-white/[0.08] dark:text-brand-sand">
                {pkg.badge}
              </span>
              <span className="rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-extrabold text-brand-blue dark:bg-white/[0.08] dark:text-brand-sand">
                Trip Code: {tripCode(pkg)}
              </span>
            </div>

            <h1 className="mt-5 max-w-4xl font-serif text-4xl font-semibold leading-tight text-brand-navy dark:text-white sm:text-5xl">
              {pkg.title}
            </h1>
            <p className="mt-5 max-w-4xl text-base leading-7 text-brand-navy/72 dark:text-white/72">
              {pkg.overview}
            </p>

            <OverviewStats pkg={pkg} />

            <section className="mt-9">
              <h2 className="text-3xl font-extrabold tracking-tight">
                Trip Overview
              </h2>
              <div className="mt-5 grid gap-4 text-base leading-7 text-brand-navy/72 dark:text-white/72">
                <p>
                  This itinerary is designed for travelers who want a clean,
                  well-paced route through {pkg.city}, with hotels, transfers
                  and optional experiences kept visible before booking.
                </p>
                <p>
                  You will have time for guided highlights, flexible local
                  discovery and support from the travel desk throughout the
                  package journey.
                </p>
              </div>
            </section>

            <IncludedSection pkg={pkg} />
            <ItinerarySection days={itinerary} images={pkg.gallery} />
          </article>

          <BookingCard pkg={pkg} />
        </section>

        <RecommendedTrips
          destinationSlug={destination.slug}
          trips={recommended}
        />
      </main>
      <SiteFooter />
    </>
  );
}

function OverviewStats({ pkg }: { pkg: TripPackage }) {
  return (
    <div className="modern-card mt-8 grid gap-3 rounded-lg p-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat icon={CalendarDays} label="Duration" value={pkg.durationLabel} />
      <Stat icon={Users} label="Group size" value="Max 16, Avg 12" />
      <Stat icon={Route} label="Physical rating" value="Light" />
      <Stat icon={BedDouble} label="Accommodation" value={`${pkg.hotelStar} star hotels`} />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-soft bg-surface px-3 py-3 dark:bg-white/[0.04]">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-muted text-brand-blue dark:bg-white/[0.06] dark:text-brand-sand">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold uppercase tracking-[0.14em] text-brand-blue/68 dark:text-brand-sand">
          {label}
        </span>
        <span className="mt-1 block truncate text-sm font-extrabold text-brand-navy dark:text-white">
          {value}
        </span>
      </span>
    </div>
  );
}

function IncludedSection({ pkg }: { pkg: TripPackage }) {
  const items = pkg.inclusions.slice(0, 6);

  return (
    <section className="mt-10">
      <h2 className="text-3xl font-extrabold tracking-tight">
        What&apos;s Included
      </h2>
      <div className="modern-card mt-5 grid gap-4 rounded-lg p-5 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item}
            className="flex items-center gap-3 text-sm font-extrabold text-brand-navy dark:text-white"
          >
            <span className="grid size-5 shrink-0 place-items-center rounded bg-brand-navy text-white dark:bg-brand-sand dark:text-brand-navy">
              <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
            </span>
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function ItinerarySection({
  days,
  images,
}: {
  days: ItineraryDay[];
  images: TripGalleryImage[];
}) {
  return (
    <section className="mt-12 max-w-[820px]">
      <h2 className="text-3xl font-extrabold tracking-tight text-brand-navy dark:text-white">
        Itinerary
      </h2>
      <div className="mt-7">
        {days.map((day, index) => (
          <details
            key={day.day}
            open={index === 0}
            className="group relative border-l border-border-soft pb-7 pl-6 last:pb-0"
          >
            <span
              aria-hidden="true"
              className="absolute -left-[6.5px] top-1 grid size-3 place-items-center rounded-full border border-brand-navy bg-background dark:border-brand-sand dark:bg-black"
            >
              <span className="size-1.5 rounded-full bg-brand-navy opacity-0 transition group-open:opacity-100 dark:bg-brand-sand" />
            </span>
            <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_24px] items-start gap-4">
              <span className="min-w-0">
                <span className="rounded-lg bg-surface-muted px-2 py-1 text-xs font-bold text-brand-blue dark:bg-neutral-900 dark:text-brand-sand">
                  {day.day}
                </span>
                <span className="mt-3 block text-lg font-extrabold leading-tight text-brand-navy dark:text-white sm:text-xl">
                  {day.title}
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="mt-1 size-5 shrink-0 text-brand-navy transition group-open:rotate-180 dark:text-white"
              />
            </summary>
            <div className="mt-3 text-sm leading-6 text-brand-navy/68 dark:text-white/68">
              <p>{day.description}</p>
              {index === 0 ? (
                <div className="no-scrollbar mt-5 flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
                  {images.slice(0, 3).map((image) => (
                    <figure
                      key={image.src}
                      className="relative h-28 w-36 flex-none overflow-hidden rounded-lg bg-surface-muted sm:h-36 sm:w-auto"
                    >
                      <Image
                        src={image.src}
                        alt={image.alt}
                        fill
                        sizes="(min-width: 768px) 220px, 100vw"
                        className="object-cover"
                      />
                    </figure>
                  ))}
                </div>
              ) : null}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function BookingCard({ pkg }: { pkg: TripPackage }) {
  const oldPrice = `SAR${Math.round(pkg.priceAmount * 1.18).toLocaleString("en-US")}`;

  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <div className="modern-card overflow-hidden rounded-lg bg-surface">
        <div className="flex items-start justify-between gap-4 border-b border-border-soft p-5">
          <div>
            <p className="text-2xl font-extrabold">{pkg.durationLabel}</p>
            <p className="mt-1 text-sm font-semibold text-brand-navy/70 dark:text-white/70">
              {pkg.city}
            </p>
          </div>
          <span className="rounded bg-brand-navy px-3 py-2 text-center text-[10px] font-black uppercase leading-none text-white dark:bg-brand-sand dark:text-brand-navy">
            Top
            <br />
            Seller
          </span>
        </div>
        <div className="p-5">
          <div className="flex items-end gap-3">
            <p className="text-5xl font-black tracking-tight text-brand-navy dark:text-white">
              {pkg.price}
            </p>
            <p className="pb-2 text-xs font-bold uppercase text-brand-navy/50 dark:text-white/50">
              <span className="mr-1">USD</span>
              <span className="line-through">{oldPrice}</span>
            </p>
          </div>

          <div className="mt-5 grid gap-2 text-sm font-semibold text-brand-navy/75 dark:text-white/75">
            <p className="flex items-center gap-2">
              <CalendarDays aria-hidden="true" className="size-4" />
              Valid on <strong className="text-brand-navy dark:text-white">{pkg.startDate}</strong>
            </p>
            <p className="flex items-center gap-2">
              <WalletCards aria-hidden="true" className="size-4" />
              Trip Code: <strong className="text-brand-navy dark:text-white">{tripCode(pkg)}</strong>
            </p>
            <p className="flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star
                  key={index}
                  aria-hidden="true"
                  className="size-4 fill-brand-navy text-brand-navy dark:fill-brand-sand dark:text-brand-sand"
                />
              ))}
              <span className="text-xs">(316 reviews)</span>
            </p>
          </div>

          <div className="mt-5 grid grid-cols-3 rounded-lg border border-border-soft">
            <BookingFeature icon={Plane} label="Flight" value={pkg.hasFlights ? "Included" : "Optional"} />
            <BookingFeature icon={Hotel} label="Hotels" value="Comfort stay" />
            <BookingFeature icon={Route} label="Tours" value="Expert guide" />
          </div>

          <a
            href="#contact"
            className="mt-5 flex h-12 items-center justify-center rounded-lg bg-brand-navy text-sm font-extrabold text-white transition hover:bg-brand-blue dark:bg-brand-sand dark:text-brand-navy"
          >
            Book Now
          </a>
        </div>
      </div>
    </aside>
  );
}

function BookingFeature({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="border-r border-border-soft p-3 text-center last:border-r-0">
      <Icon aria-hidden="true" className="mx-auto size-5 text-brand-navy dark:text-brand-sand" />
      <p className="mt-2 text-xs font-extrabold">{label}</p>
      <p className="mt-1 text-[10px] font-semibold text-brand-navy/55 dark:text-white/55">
        {value}
      </p>
    </div>
  );
}

function RecommendedTrips({
  destinationSlug,
  trips,
}: {
  destinationSlug: string;
  trips: TripPackage[];
}) {
  return (
    <section className="bg-surface-muted/55 py-12 dark:bg-white/[0.035]">
      <div className="section-shell">
        <h2 className="text-3xl font-extrabold tracking-tight">
          Recommended for you
        </h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {trips.map((trip) => (
            <Link
              key={`${trip.slug}-${trip.title}`}
              href={`/trips/${destinationSlug}/${trip.slug}`}
              className="modern-card group overflow-hidden rounded-lg bg-surface"
            >
              <figure className="relative h-48 overflow-hidden rounded-t-lg bg-surface-muted">
                <Image
                  src={trip.image}
                  alt={trip.alt}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              </figure>
              <div className="p-4">
                <p className="text-sm font-extrabold">{trip.title}</p>
                <p className="mt-2 text-xs font-semibold text-brand-navy/60 dark:text-white/60">
                  {trip.city} | {trip.durationLabel}
                </p>
                <p className="mt-4 text-xl font-black text-brand-blue dark:text-brand-sand">
                  {trip.price}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

type ItineraryDay = {
  day: string;
  title: string;
  description: string;
};

function buildItinerary(pkg: TripPackage): ItineraryDay[] {
  const baseDescriptions = [
    `Arrive in ${pkg.city}. Meet the local support team, transfer to your hotel and settle in before an easy first evening.`,
    pkg.highlights[0] ?? `Explore the key landmarks and cultural sights around ${pkg.city}.`,
    pkg.highlights[1] ?? "Use the day for guided discovery, local food stops and optional activities.",
    pkg.highlights[2] ?? "Keep time open for personal exploration and relaxed shopping.",
    "Complete checkout formalities and transfer for your onward journey.",
  ];
  const titles = [
    `Arrive in ${pkg.city}`,
    `${pkg.city} highlights`,
    "Local culture and experiences",
    "Free time and optional tours",
    "Departure",
  ];
  const count = Math.max(3, Math.min(pkg.durationDays, 7));

  return Array.from({ length: count }).map((_, index) => ({
    day: index === count - 2 && count > 5 ? `Day ${index + 1} - ${index + 2}` : `Day ${index + 1}`,
    title: titles[index] ?? `Day ${index + 1} experience`,
    description: baseDescriptions[index] ?? baseDescriptions.at(-1)!,
  }));
}

function tripCode(pkg: TripPackage) {
  return pkg.slug
    .split("-")
    .map((part) => part[0])
    .join("")
    .slice(0, 5)
    .toUpperCase();
}
