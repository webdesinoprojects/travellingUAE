import { ArrowLeft, CalendarDays, ChevronRight, ClipboardList, Info, MapPin, Sparkles, Star, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";

import { HotelAmenities } from "@/components/hotels/HotelAmenities";
import { HotelGallery } from "@/components/hotels/HotelGallery";
import { HotelLocationCard } from "@/components/hotels/HotelLocationCard";
import { RecentlyViewedHotels } from "@/components/hotels/RecentlyViewedHotels";
import { StandaloneHotelRates } from "@/components/hotels/StandaloneHotelRates";
import {
  getHotelDetail,
  HOTEL_SEARCH_COOKIE,
} from "@/server/hotels/search";
import type { HotelStaticContentDTO } from "@/types/hotels";

export const dynamic = "force-dynamic";

export default async function HotelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ hotelId: string }>;
  searchParams: Promise<{ search?: string }>;
}) {
  const [{ hotelId }, { search = "" }, cookieStore] = await Promise.all([
    params,
    searchParams,
    cookies(),
  ]);
  const detail = await getHotelDetail(
    search,
    hotelId,
    cookieStore.get(HOTEL_SEARCH_COOKIE)?.value,
  );

  if (!detail) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 pt-24">
        <div className="rounded-lg border border-border-soft bg-surface p-8 text-center">
          <h1 className="text-3xl font-black">Room availability expired</h1>
          <Link href="/?service=hotel#travel-search" className="mt-5 inline-flex font-extrabold text-brand-blue">
            Start a new hotel search
          </Link>
        </div>
      </main>
    );
  }

  const guests = detail.rooms.reduce(
    (total, room) => total + room.adults + room.children.length,
    0,
  );

  const content: HotelStaticContentDTO | null = detail.staticContent;

  const galleryImages =
    content && content.images.length > 0
      ? content.images
      : detail.hotel.imageUrl
        ? [detail.hotel.imageUrl]
        : [];

  const address = content?.address ?? detail.hotel.address;
  const starRating = content?.starRating ?? detail.hotel.starRating;
  const region = content?.regionName;
  const amenities = content?.amenities ?? [];
  const description = content?.description ?? null;
  const policies = content?.policies ?? null;
  const paidOnSpot = content?.paidOnSpot ?? [];
  const heroImage = galleryImages[0] ?? null;
  const changeHref = `/hotels?search=${detail.searchId}`;

  // Starting price from the live rates (real data only).
  const startingRate = detail.rates.reduce<{ amount: number; currency: string } | null>((min, rate) => {
    if (!Number.isFinite(rate.priceAmount)) return min;
    if (!min || rate.priceAmount < min.amount) return { amount: rate.priceAmount, currency: rate.currency };
    return min;
  }, null);

  return (
    <main className="min-h-screen bg-background pb-20 pt-28 text-brand-navy dark:text-white">
      <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-brand-navy/55 dark:text-white/55">
          <Link href={`/hotels?search=${detail.searchId}`} className="inline-flex items-center gap-1.5 text-brand-blue dark:text-brand-sand">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Results
          </Link>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <span className="truncate text-brand-navy dark:text-white">{detail.hotel.name}</span>
        </nav>

        {/* Summary card */}
        <div className="mt-4 rounded-xl border border-border-soft bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              {starRating ? <StarRating value={starRating} /> : null}
              <h1 className="mt-1.5 font-serif text-3xl font-semibold sm:text-4xl">{detail.hotel.name}</h1>
              {address ? (
                <p className="mt-2 flex items-start gap-2 text-sm text-brand-navy/60 dark:text-white/60">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    {address}
                    {region ? <span className="text-brand-navy/45 dark:text-white/45"> · {region}</span> : null}
                  </span>
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-start gap-x-5 gap-y-3 sm:justify-end">
              {startingRate ? (
                <div className="text-left sm:text-right">
                  <span className="block text-xs font-bold uppercase text-brand-navy/50 dark:text-white/50">From</span>
                  <span className="text-2xl font-black">
                    {startingRate.currency} {startingRate.amount.toLocaleString("en")}
                  </span>
                </div>
              ) : null}
              <a
                href="#rooms"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-blue px-5 text-sm font-extrabold text-white transition hover:bg-brand-navy"
              >
                Show rooms
              </a>
            </div>
          </div>
        </div>

        {/* Gallery */}
        <div className="mt-4">
          <HotelGallery images={galleryImages} hotelName={detail.hotel.name} amenities={amenities} />
        </div>

        {/* Stay facts */}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 rounded-xl border border-border-soft bg-surface px-5 py-4 text-sm font-bold text-brand-navy/70 dark:text-white/70">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="size-4" aria-hidden="true" />
            {detail.checkIn} to {detail.checkOut}
          </span>
          <span className="inline-flex items-center gap-2">
            <Users className="size-4" aria-hidden="true" />
            {guests} guests, {detail.rooms.length} rooms
          </span>
          {policies?.checkInTime ? <span>Check-in {policies.checkInTime}</span> : null}
          {policies?.checkOutTime ? <span>Check-out {policies.checkOutTime}</span> : null}
        </div>

        {/* Content cards */}
        <div className="mt-6 grid gap-5">
          {description ? (
            <Section icon={<Info className="size-5" aria-hidden="true" />} title="About this hotel">
              <p className="whitespace-pre-line text-sm leading-7 text-brand-navy/75 dark:text-white/75">
                {description}
              </p>
            </Section>
          ) : null}

          {amenities.length > 0 ? (
            <Section icon={<Sparkles className="size-5" aria-hidden="true" />} title="Amenities">
              <HotelAmenities amenities={amenities} />
            </Section>
          ) : null}

          {paidOnSpot.length > 0 ? (
            <Section icon={<Wallet className="size-5" aria-hidden="true" />} title="Paid on the spot">
              <p className="mb-4 text-sm text-brand-navy/60 dark:text-white/60">
                These charges are collected by the property directly, not in your online payment.
              </p>
              <dl className="grid gap-4 sm:grid-cols-2">
                {paidOnSpot.map((item) => (
                  <div key={item.label} className="rounded-lg border border-border-soft bg-surface-muted p-3">
                    <dt className="text-sm font-black">{item.label}</dt>
                    <dd className="mt-1 text-sm font-bold text-brand-navy/75 dark:text-white/75">{item.amount}</dd>
                    {item.note ? (
                      <dd className="mt-0.5 text-xs font-semibold text-brand-brown">{item.note}</dd>
                    ) : null}
                  </div>
                ))}
              </dl>
            </Section>
          ) : null}

          {policies ? (
            <Section icon={<ClipboardList className="size-5" aria-hidden="true" />} title="Good to know">
              <dl className="grid gap-4 sm:grid-cols-2">
                {policies.checkInTime ? <PolicyRow label="Check-in" value={policies.checkInTime} /> : null}
                {policies.checkOutTime ? <PolicyRow label="Check-out" value={policies.checkOutTime} /> : null}
                {policies.extraInfo ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-black uppercase tracking-[0.12em] text-brand-brown">Additional information</dt>
                    <dd className="mt-1 text-sm leading-6 font-semibold text-brand-navy/75 dark:text-white/75">
                      {policies.extraInfo}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </Section>
          ) : null}

          {content?.latitude != null && content?.longitude != null ? (
            <HotelLocationCard
              latitude={content.latitude}
              longitude={content.longitude}
              address={address}
              regionName={region ?? null}
              hotelName={detail.hotel.name}
            />
          ) : null}
        </div>

        {/* Available rooms — booking behavior unchanged */}
        <div id="rooms" className="mt-8 scroll-mt-28 rounded-xl border border-border-soft bg-surface p-5 sm:p-6">
          <h2 className="text-2xl font-black sm:text-3xl">Available rooms</h2>
          <p className="mt-2 text-sm text-brand-navy/60 dark:text-white/60">
            Rates are checked live. Final price and cancellation terms are reconfirmed before payment.
          </p>
          <StandaloneHotelRates
            searchId={detail.searchId}
            hotelId={hotelId}
            rates={detail.rates}
            checkIn={detail.checkIn}
            checkOut={detail.checkOut}
            guests={guests}
            roomsCount={detail.rooms.length}
            changeHref={changeHref}
          />
        </div>

        <div className="mt-8">
          <RecentlyViewedHotels
            current={{
              id: detail.hotel.hotelId,
              name: detail.hotel.name,
              image: heroImage,
              priceLabel: startingRate
                ? `From ${startingRate.currency} ${startingRate.amount.toLocaleString("en")}`
                : null,
              href: changeHref === "" ? "#" : `/hotels/${encodeURIComponent(detail.hotel.hotelId)}?search=${detail.searchId}`,
            }}
          />
        </div>
      </div>
    </main>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border-soft bg-surface p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-black text-brand-navy dark:text-white">
        <span className="text-brand-blue dark:text-brand-sand">{icon}</span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StarRating({ value }: { value: number }) {
  const count = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${count} star hotel`}>
      {Array.from({ length: count }, (_, i) => (
        <Star key={i} className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
      ))}
    </span>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-[0.12em] text-brand-brown">{label}</dt>
      <dd className="mt-1 text-sm font-bold">{value}</dd>
    </div>
  );
}
