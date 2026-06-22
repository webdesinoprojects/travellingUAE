import { ArrowLeft, BedDouble, CalendarDays, Hotel, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";

import {
  getHotelDetail,
  HOTEL_SEARCH_COOKIE,
} from "@/server/hotels/search";

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

  return (
    <main className="min-h-screen bg-background pb-20 pt-32 text-brand-navy dark:text-white">
      <section className="mx-auto w-full max-w-[1240px] px-4 sm:px-6">
        <Link
          href={`/hotels?search=${detail.searchId}`}
          className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-blue dark:text-brand-sand"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to results
        </Link>

        <div className="mt-6 grid overflow-hidden rounded-lg border border-border-soft bg-surface lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <div className="relative min-h-[330px] bg-surface-muted">
            {detail.hotel.imageUrl ? (
              <Image
                src={detail.hotel.imageUrl}
                alt={detail.hotel.name}
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
                priority
              />
            ) : (
              <div className="grid h-full place-items-center text-brand-blue/35">
                <Hotel className="size-14" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-brand-blue dark:text-brand-sand">
              Live availability
            </p>
            <h1 className="mt-2 font-serif text-4xl font-semibold">
              {detail.hotel.name}
            </h1>
            {detail.hotel.address ? (
              <p className="mt-3 text-brand-navy/60 dark:text-white/60">
                {detail.hotel.address}
              </p>
            ) : null}
            <div className="mt-6 grid gap-3 text-sm font-bold text-brand-navy/65 sm:grid-cols-2 dark:text-white/65">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="size-4" aria-hidden="true" />
                {detail.checkIn} to {detail.checkOut}
              </span>
              <span className="inline-flex items-center gap-2">
                <Users className="size-4" aria-hidden="true" />
                {guests} guests, {detail.rooms.length} rooms
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-3xl font-black">Available rooms</h2>
          <p className="mt-2 text-sm text-brand-navy/60 dark:text-white/60">
            Rates are checked live. Final price and cancellation terms are reconfirmed before payment.
          </p>
          <div className="mt-5 grid gap-4">
            {detail.rates.map((rate) => (
              <article
                key={rate.rateId}
                className="flex flex-col gap-4 rounded-lg border border-border-soft bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-black">
                    <BedDouble className="size-5 text-brand-blue" aria-hidden="true" />
                    {rate.roomName ?? "Hotel room"}
                  </h3>
                  <p className="mt-2 text-sm font-semibold text-brand-navy/60 dark:text-white/60">
                    {rate.boardBasis ?? "Room only"}
                  </p>
                </div>
                <p className="text-2xl font-black">
                  {rate.currency} {rate.priceAmount.toLocaleString("en")}
                </p>
              </article>
            ))}
            {detail.rates.length === 0 ? (
              <div className="rounded-lg border border-border-soft bg-surface p-6">
                This hotel no longer has a room matching your search.
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
