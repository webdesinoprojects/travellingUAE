import { ArrowRight, CalendarDays, Hotel, MapPin, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";

import {
  getHotelSearchResults,
  HOTEL_SEARCH_COOKIE,
} from "@/server/hotels/search";

export const dynamic = "force-dynamic";

export default async function HotelResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search = "" } = await searchParams;
  const cookieStore = await cookies();
  const result = await getHotelSearchResults(
    search,
    cookieStore.get(HOTEL_SEARCH_COOKIE)?.value,
  );

  if (!result) {
    return <ExpiredHotelSearch />;
  }

  const guestCount = result.rooms.reduce(
    (total, room) => total + room.adults + room.children.length,
    0,
  );

  return (
    <main className="min-h-screen bg-background pb-20 pt-32 text-brand-navy dark:text-white">
      <header className="border-y border-border-soft bg-surface">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-blue dark:text-brand-sand">
            Live hotel availability
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold sm:text-5xl">
            Hotels in {result.destination.name}
          </h1>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-brand-navy/65 dark:text-white/65">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="size-4" aria-hidden="true" />
              {result.checkIn} to {result.checkOut}
            </span>
            <span className="inline-flex items-center gap-2">
              <Users className="size-4" aria-hidden="true" />
              {guestCount} guests, {result.rooms.length} rooms
            </span>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[1240px] gap-5 px-4 py-8 sm:px-6 lg:grid-cols-2">
        {result.hotels.length ? (
          result.hotels.map((hotel) => (
            <article
              key={hotel.quoteId}
              className="grid min-w-0 overflow-hidden rounded-lg border border-border-soft bg-surface shadow-sm sm:grid-cols-[210px_minmax(0,1fr)]"
            >
              <div className="relative aspect-[4/3] min-h-48 bg-surface-muted sm:aspect-auto">
                {hotel.imageUrl ? (
                  <Image
                    src={hotel.imageUrl}
                    alt={hotel.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 210px"
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-brand-blue/35">
                    <Hotel className="size-10" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-col p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-black">{hotel.name}</h2>
                    {hotel.address ? (
                      <p className="mt-2 flex gap-2 text-sm text-brand-navy/58 dark:text-white/58">
                        <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        {hotel.address}
                      </p>
                    ) : null}
                  </div>
                  {hotel.starRating ? (
                    <span className="rounded-md bg-brand-sky px-2.5 py-1 text-xs font-black text-brand-navy">
                      {hotel.starRating} star
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 text-sm font-semibold text-brand-navy/65 dark:text-white/65">
                  {hotel.roomName ?? "Available room"} · {hotel.boardBasis ?? "Room only"}
                </p>
                <div className="mt-auto flex items-end justify-between gap-4 pt-6">
                  <p>
                    <span className="block text-xs font-bold uppercase text-brand-navy/50 dark:text-white/50">
                      From
                    </span>
                    <span className="text-2xl font-black">
                      {hotel.currency} {hotel.priceAmount.toLocaleString("en")}
                    </span>
                  </p>
                  <Link
                    href={`/hotels/${encodeURIComponent(hotel.hotelId)}?search=${result.searchId}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-blue px-4 text-sm font-extrabold text-white transition hover:bg-brand-navy"
                  >
                    View rooms
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-lg border border-border-soft bg-surface p-8 lg:col-span-2">
            <h2 className="text-2xl font-black">No available hotels</h2>
            <p className="mt-2 text-brand-navy/60 dark:text-white/60">
              Try different dates or room occupancy.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function ExpiredHotelSearch() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 pt-24">
      <div className="max-w-xl rounded-lg border border-border-soft bg-surface p-8 text-center">
        <Hotel className="mx-auto size-10 text-brand-blue" aria-hidden="true" />
        <h1 className="mt-4 text-3xl font-black">Search hotels again</h1>
        <p className="mt-3 text-brand-navy/60 dark:text-white/60">
          Hotel prices are time-sensitive, so this search is no longer active.
        </p>
        <Link
          href="/?service=hotel#travel-search"
          className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-brand-blue px-5 font-extrabold text-white"
        >
          New hotel search
        </Link>
      </div>
    </main>
  );
}
