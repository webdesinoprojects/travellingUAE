import { CalendarDays, Hotel, Info, Receipt, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";

import { StandaloneHotelCheckoutForm } from "@/components/hotels/StandaloneHotelCheckoutForm";
import {
  getStandaloneHotelCheckoutSummary,
  HOTEL_CHECKOUT_COOKIE,
  inspectStandaloneHotelCheckoutLookup,
  type StandaloneCheckoutLookupDebug,
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
    const debug = await inspectStandaloneHotelCheckoutLookup(
      checkout,
      cookieStore.get(HOTEL_CHECKOUT_COOKIE)?.value,
    );

    return (
      <main className="grid min-h-screen place-items-center bg-surface px-4 pt-24">
        <div className="w-full max-w-md rounded-lg border border-border-soft bg-surface p-8 text-center">
          <h1 className="text-3xl font-black">Checkout expired</h1>
          <Link href="/?service=hotel#travel-search" className="mt-5 inline-flex font-extrabold text-brand-blue">
            Start a new hotel search
          </Link>
          <CheckoutLookupDebug debug={debug} />
        </div>
      </main>
    );
  }

  const totalGuests = summary.rooms.reduce((count, room) => count + room.guests.length, 0);

  return (
    <main className="min-h-screen bg-surface pb-20 pt-28 text-brand-navy sm:pt-32 dark:text-white">
      <section className="mx-auto grid w-full max-w-[1120px] gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:items-start lg:gap-8">
        <div className="min-w-0 rounded-lg border border-border-soft bg-surface p-5 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-brand-blue dark:text-brand-sand">
            Hotel checkout
          </p>
          <h1 className="mt-2 text-2xl font-black break-words sm:text-3xl">{summary.hotel.name}</h1>
          <p className="mt-2 text-sm font-semibold text-brand-navy/60 dark:text-white/60">
            {summary.hotel.roomName ?? "Hotel room"}
            {summary.hotel.boardBasis ? ` - ${summary.hotel.boardBasis}` : ""}
          </p>

          <div className="mt-6">
            <StandaloneHotelCheckoutForm summary={summary} />
          </div>
        </div>

        <aside className="min-w-0 rounded-lg border border-border-soft bg-surface p-5 sm:p-6 lg:sticky lg:top-28">
          <h2 className="text-lg font-black">Booking summary</h2>
          <div className="mt-5 grid gap-4 text-sm font-bold text-brand-navy/65 dark:text-white/65">
            <span className="flex items-start gap-2">
              <Hotel className="mt-0.5 size-4 shrink-0 text-brand-blue dark:text-brand-sand" aria-hidden="true" />
              <span className="min-w-0 break-words">{summary.hotel.roomName ?? "Hotel room"}</span>
            </span>
            <span className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-brand-blue dark:text-brand-sand" aria-hidden="true" />
              <span className="min-w-0 break-words">
                {summary.checkIn} to {summary.checkOut}
              </span>
            </span>
            <span className="flex items-start gap-2">
              <Users className="mt-0.5 size-4 shrink-0 text-brand-blue dark:text-brand-sand" aria-hidden="true" />
              <span className="min-w-0 break-words">
                {totalGuests} guests, {summary.rooms.length} rooms
              </span>
            </span>
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
            {summary.payment.mode === "now" ? (
              <p className="mt-2 text-xs font-semibold text-brand-navy/55 dark:text-white/55">
                ETG charges this card amount directly and may require 3-D Secure verification.
              </p>
            ) : null}
          </div>

          {/* Taxes & fees: shown from returned rate data only; this rate did not
              include itemised taxes/fees, so we state that honestly. */}
          <div className="mt-6 border-t border-border-soft pt-5">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-navy/45 dark:text-white/45">
              Taxes &amp; fees
            </p>
            <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-brand-navy/65 dark:text-white/65">
              <Receipt className="mt-0.5 size-4 shrink-0 text-brand-blue dark:text-brand-sand" aria-hidden="true" />
              <span className="min-w-0">
                No additional tax or fee details were returned for this rate.
              </span>
            </p>
          </div>

          {/* Cancellation: real prebook data when present, honest fallback otherwise. */}
          <div className="mt-6 border-t border-border-soft pt-5">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-navy/45 dark:text-white/45">
              Cancellation
            </p>
            <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-brand-navy/65 dark:text-white/65">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-blue dark:text-brand-sand" aria-hidden="true" />
              <span className="min-w-0 break-words">
                {summary.cancellationSummary ??
                  "Cancellation terms are provided by the supplier and may be finalized during prebook."}
              </span>
            </p>
            {summary.cancellationFreeBefore ? (
              <p className="mt-1 pl-6 text-xs font-semibold text-brand-navy/55 dark:text-white/55">
                Free cancellation before {summary.cancellationFreeBefore}
              </p>
            ) : null}
          </div>

          {/* Hotel policies: collapsed; detailed static policies are not loaded for
              standalone rates yet, so we surface an honest note (never blocking). */}
          <details className="group mt-6 border-t border-border-soft pt-5">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-brand-navy/45 dark:text-white/45">
              <Info className="size-4 shrink-0 text-brand-blue dark:text-brand-sand" aria-hidden="true" />
              Hotel policies and important information
            </summary>
            <p className="mt-2 text-sm font-semibold text-brand-navy/65 dark:text-white/65">
              Detailed hotel policies (check-in/out times, deposits, extra beds, children,
              pets, and no-show terms) are set by the supplier and confirmed on your booking
              voucher. Contact us for a specific policy before booking.
            </p>
          </details>
        </aside>
      </section>
    </main>
  );
}

function CheckoutLookupDebug({
  debug,
}: {
  debug: StandaloneCheckoutLookupDebug;
}) {
  return (
    <dl className="mt-6 grid gap-2 rounded-lg border border-border-soft bg-surface-muted p-4 text-left text-xs font-semibold text-brand-navy/65 dark:text-white/65">
      <div className="flex justify-between gap-4">
        <dt>checkout token present</dt>
        <dd>{formatDebugValue(debug.checkoutTokenPresent)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>token hash generated</dt>
        <dd>{formatDebugValue(debug.tokenHashGenerated)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>session found</dt>
        <dd>{formatDebugValue(debug.sessionFound)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>expires_at expired</dt>
        <dd>{formatDebugValue(debug.expiresAtExpired)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>session status</dt>
        <dd>{debug.sessionStatus ?? "unknown"}</dd>
      </div>
    </dl>
  );
}

function formatDebugValue(value: boolean | null) {
  if (value === null) return "unknown";
  return value ? "true" : "false";
}
