import { CalendarDays, Hotel, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";

import { HotelResults } from "@/components/hotels/HotelResults";
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
    <main className="min-h-screen bg-background pb-20 pt-28 text-brand-navy dark:text-white">
      <header className="border-b border-border-soft bg-surface">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-blue dark:text-brand-sand">
            Live hotel availability
          </p>
          <h1 className="mt-1.5 font-serif text-3xl font-semibold sm:text-4xl">
            {result.destination.name}
          </h1>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-brand-navy/65 dark:text-white/65">
            <span className="inline-flex items-center gap-2">
              <MapPin className="size-4" aria-hidden="true" />
              {result.hotels.length} {result.hotels.length === 1 ? "property" : "properties"}
            </span>
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

      <section className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6">
        {result.hotels.length ? (
          <HotelResults hotels={result.hotels} searchId={result.searchId} />
        ) : (
          <div className="rounded-lg border border-border-soft bg-surface p-8">
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
