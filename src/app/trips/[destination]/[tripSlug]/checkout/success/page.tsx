import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getBookingPaymentForSuccessPage } from "@/server/mutations/bookings";
import { logServerError } from "@/server/http/response";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking confirmed | Fly Time",
};

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ destination: string; tripSlug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { destination, tripSlug } = await params;
  const { session_id: sessionId } = await searchParams;
  const tripPageHref = `/trips/${destination}/${tripSlug}`;
  const checkoutHref = `/trips/${destination}/${tripSlug}/checkout`;

  type State = "paid" | "pending" | "not_found" | "error";
  let state: State = "not_found";

  if (sessionId) {
    try {
      // Verifies session ID belongs to a booking for THIS specific trip.
      // Rejects valid Stripe sessions from other trips or unknown sessions.
      const status = await getBookingPaymentForSuccessPage({
        stripeSessionId: sessionId,
        destinationSlug: destination,
        tripSlug,
      });

      if (status === "paid") {
        state = "paid";
      } else if (status === "pending") {
        // Webhook hasn't fired yet - payment may still be processing.
        state = "pending";
      } else {
        state = "not_found";
      }
    } catch (err) {
      logServerError("checkout.success.verify", err);
      state = "error";
    }
  }

  if (state === "paid") {
    return (
      <>
        <main className="min-h-screen bg-background pt-28 text-brand-navy dark:bg-black dark:text-white">
          <div className="section-shell py-16 text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-green/10 dark:bg-brand-green/20">
              <CheckCircle2 className="size-8 text-brand-green" aria-hidden="true" />
            </span>
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight">
              Payment confirmed
            </h1>
            <p className="mt-4 text-base text-brand-navy/68 dark:text-white/68">
              Thank you. Your hotel add-on payment has been received and your
              booking is confirmed. Our travel team will be in touch shortly to
              finalise your trip details.
            </p>
            <Link
              href={tripPageHref}
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-brand-blue px-6 text-sm font-extrabold text-white transition hover:bg-brand-blue-strong dark:bg-brand-sand dark:text-brand-navy"
            >
              Back to trip
            </Link>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  if (state === "pending") {
    return (
      <>
        <main className="min-h-screen bg-background pt-28 text-brand-navy dark:bg-black dark:text-white">
          <div className="section-shell py-16 text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-surface-muted dark:bg-white/[0.06]">
              <Clock className="size-8 text-brand-blue/60 dark:text-brand-sand/60" aria-hidden="true" />
            </span>
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight">
              Confirming your payment
            </h1>
            <p className="mt-4 text-base text-brand-navy/68 dark:text-white/68">
              Your payment is being confirmed. This usually takes a few seconds.
              Please refresh this page, or check your email for a confirmation
              from Stripe. If the problem persists, contact us.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href={`/trips/${destination}/${tripSlug}/checkout/success${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""}`}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-brand-blue px-6 text-sm font-extrabold text-white transition hover:bg-brand-blue-strong dark:bg-brand-sand dark:text-brand-navy"
              >
                Check again
              </a>
              <Link
                href={tripPageHref}
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-border-soft px-6 text-sm font-extrabold transition hover:bg-surface-muted"
              >
                Back to trip
              </Link>
            </div>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  // not_found or error
  return (
    <>
      <main className="min-h-screen bg-background pt-28 text-brand-navy dark:bg-black dark:text-white">
        <div className="section-shell py-16 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-surface-muted dark:bg-white/[0.06]">
            <AlertCircle className="size-8 text-brand-navy/40 dark:text-white/40" aria-hidden="true" />
          </span>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight">
            Payment not confirmed
          </h1>
          <p className="mt-4 text-base text-brand-navy/68 dark:text-white/68">
            We could not confirm your payment. If you completed checkout, please
            contact us and we will look into it.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href={checkoutHref}
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-brand-blue px-6 text-sm font-extrabold text-white transition hover:bg-brand-blue-strong dark:bg-brand-sand dark:text-brand-navy"
            >
              Back to checkout
            </Link>
            <Link
              href={tripPageHref}
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-border-soft px-6 text-sm font-extrabold transition hover:bg-surface-muted"
            >
              Back to trip
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
