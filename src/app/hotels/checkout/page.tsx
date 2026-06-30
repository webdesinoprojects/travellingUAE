import { CalendarDays, Hotel, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";

import { StandaloneHotelCheckoutForm } from "@/components/hotels/StandaloneHotelCheckoutForm";
import {
  getStandaloneHotelCheckoutSummary,
  HOTEL_CHECKOUT_COOKIE,
} from "@/server/hotels/booking";

export const dynamic = "force-dynamic";

export default async function StandaloneHotelCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const [{ checkout = "" }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const summary = await getStandaloneHotelCheckoutSummary(
    checkout,
    cookieStore.get(HOTEL_CHECKOUT_COOKIE)?.value,
  );

  if (!summary) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 pt-24">
        <div className="rounded-lg border border-border-soft bg-surface p-8 text-center">
          <h1 className="text-3xl font-black">Checkout expired</h1>
          <Link href="/?service=hotel#travel-search" className="mt-5 inline-flex font-extrabold text-brand-blue">
            Start a new hotel search
          </Link>
        </div>
      </main>
    );
  }

  const totalGuests = summary.rooms.reduce((count, room) => count + room.guests.length, 0);

  return (
    <main className="min-h-screen bg-background pb-20 pt-32 text-brand-navy dark:text-white">
      <section className="mx-auto grid w-full max-w-[1120px] gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-border-soft bg-surface p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-brand-blue dark:text-brand-sand">
            Hotel checkout
          </p>
          <h1 className="mt-2 text-3xl font-black">{summary.hotel.name}</h1>
          <p className="mt-2 text-sm font-semibold text-brand-navy/60 dark:text-white/60">
            {summary.hotel.roomName ?? "Hotel room"}
            {summary.hotel.boardBasis ? ` - ${summary.hotel.boardBasis}` : ""}
          </p>

          <div className="mt-6">
            <StandaloneHotelCheckoutForm summary={summary} />
          </div>
        </div>

        <aside className="h-fit rounded-lg border border-border-soft bg-surface p-6">
          <h2 className="text-lg font-black">Booking summary</h2>
          <div className="mt-5 grid gap-4 text-sm font-bold text-brand-navy/65 dark:text-white/65">
            <span className="inline-flex items-center gap-2">
              <Hotel className="size-4 text-brand-blue dark:text-brand-sand" aria-hidden="true" />
              {summary.hotel.roomName ?? "Hotel room"}
            </span>
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="size-4 text-brand-blue dark:text-brand-sand" aria-hidden="true" />
              {summary.checkIn} to {summary.checkOut}
            </span>
            <span className="inline-flex items-center gap-2">
              <Users className="size-4 text-brand-blue dark:text-brand-sand" aria-hidden="true" />
              {totalGuests} guests, {summary.rooms.length} rooms
            </span>
            {summary.cancellationSummary ? (
              <span className="inline-flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 text-brand-blue dark:text-brand-sand" aria-hidden="true" />
                {summary.cancellationSummary}
              </span>
            ) : null}
          </div>
          <div className="mt-6 border-t border-border-soft pt-5">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-navy/45 dark:text-white/45">
              Provider price
            </p>
            <p className="mt-1 text-3xl font-black">
              {summary.price.currency} {summary.price.amount.toLocaleString("en")}
            </p>
            {summary.payment.mode === "deposit" ? (
              <p className="mt-2 text-xs font-semibold text-brand-navy/55 dark:text-white/55">
                Stripe charges the ETG deposit amount returned by booking/form.
              </p>
            ) : null}
          </div>
        </aside>
      </section>
    </main>
  );
}
