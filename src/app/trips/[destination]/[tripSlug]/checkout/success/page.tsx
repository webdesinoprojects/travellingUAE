import { CheckCircle2, Clock, AlertCircle, CalendarDays, Users, CreditCard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getBookingPaymentForSuccessPage } from "@/server/mutations/bookings";
import { logServerError } from "@/server/http/response";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking confirmed | Fly Time",
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

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

  type PageState =
    | { status: "not_found" | "pending" | "error" }
    | {
        status: "paid";
        reference: string;
        customerName: string;
        customerEmail: string;
        paidAmount: number | null;
        paidCurrency: string | null;
        travelDate: string | null;
        tripTitle: string;
      };

  let state: PageState = { status: "not_found" };

  if (sessionId) {
    try {
      const result = await getBookingPaymentForSuccessPage({
        stripeSessionId: sessionId,
        destinationSlug: destination,
        tripSlug,
      });
      if (result.status === "paid") {
        state = result;
      } else if (result.status === "pending") {
        state = { status: "pending" };
      } else {
        state = { status: "not_found" };
      }
    } catch (err) {
      logServerError("checkout.success.verify", err);
      state = { status: "error" };
    }
  }

  // ── Paid ──────────────────────────────────────────────────────────────────
  if (state.status === "paid") {
    return (
      <>
        <main className="min-h-screen bg-background pt-28 text-brand-navy dark:bg-black dark:text-white">
          <div className="section-shell py-16">

            {/* Hero */}
            <div className="text-center">
              <span className="mx-auto grid size-20 place-items-center rounded-full bg-brand-green/10 dark:bg-brand-green/20">
                <CheckCircle2 className="size-10 text-brand-green" aria-hidden="true" />
              </span>
              <h1 className="mt-5 text-4xl font-extrabold tracking-tight">
                Booking Confirmed
              </h1>
              <p className="mt-2 font-mono text-sm text-brand-navy/45 dark:text-white/45">
                Ref&nbsp;#{state.reference}
              </p>
            </div>

            {/* Summary card */}
            <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-border-soft bg-surface shadow-sm dark:bg-white/[0.04]">
              <div className="border-b border-border-soft px-6 py-4">
                <p className="text-xs font-extrabold uppercase tracking-widest text-brand-navy/40 dark:text-white/40">
                  Booking Summary
                </p>
              </div>
              <dl className="divide-y divide-border-soft">
                <div className="flex items-start gap-3 px-6 py-4">
                  <CalendarDays className="mt-0.5 size-4 shrink-0 text-brand-blue dark:text-brand-sand" aria-hidden="true" />
                  <div>
                    <dt className="text-xs text-brand-navy/50 dark:text-white/50">Trip</dt>
                    <dd className="mt-0.5 text-sm font-semibold">{state.tripTitle}</dd>
                  </div>
                </div>

                <div className="flex items-start gap-3 px-6 py-4">
                  <Users className="mt-0.5 size-4 shrink-0 text-brand-blue dark:text-brand-sand" aria-hidden="true" />
                  <div>
                    <dt className="text-xs text-brand-navy/50 dark:text-white/50">Guest</dt>
                    <dd className="mt-0.5 text-sm font-semibold">{state.customerName}</dd>
                    <dd className="text-xs text-brand-navy/50 dark:text-white/50">{state.customerEmail}</dd>
                  </div>
                </div>

                {state.travelDate ? (
                  <div className="flex items-start gap-3 px-6 py-4">
                    <CalendarDays className="mt-0.5 size-4 shrink-0 text-brand-blue dark:text-brand-sand" aria-hidden="true" />
                    <div>
                      <dt className="text-xs text-brand-navy/50 dark:text-white/50">Travel date</dt>
                      <dd className="mt-0.5 text-sm font-semibold">{formatDate(state.travelDate)}</dd>
                    </div>
                  </div>
                ) : null}

                {state.paidAmount != null && state.paidCurrency ? (
                  <div className="flex items-start gap-3 px-6 py-4">
                    <CreditCard className="mt-0.5 size-4 shrink-0 text-brand-green" aria-hidden="true" />
                    <div>
                      <dt className="text-xs text-brand-navy/50 dark:text-white/50">Hotel add-on paid</dt>
                      <dd className="mt-0.5 text-sm font-extrabold text-brand-green">
                        {formatCurrency(state.paidAmount, state.paidCurrency)}
                      </dd>
                    </div>
                  </div>
                ) : null}
              </dl>
            </div>

            {/* What's next */}
            <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-border-soft bg-surface px-6 py-5 dark:bg-white/[0.04]">
              <p className="text-xs font-extrabold uppercase tracking-widest text-brand-navy/40 dark:text-white/40">
                What Happens Next
              </p>
              <ol className="mt-4 space-y-4">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-blue/10 text-xs font-extrabold text-brand-blue dark:bg-brand-sand/10 dark:text-brand-sand">
                    1
                  </span>
                  <p className="text-sm text-brand-navy/70 dark:text-white/70">
                    Stripe sent a payment receipt to{" "}
                    <strong className="text-brand-navy dark:text-white">{state.customerEmail}</strong>.
                    {" "}Check your inbox (and spam folder).
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-blue/10 text-xs font-extrabold text-brand-blue dark:bg-brand-sand/10 dark:text-brand-sand">
                    2
                  </span>
                  <p className="text-sm text-brand-navy/70 dark:text-white/70">
                    Our travel team will contact you within{" "}
                    <strong className="text-brand-navy dark:text-white">24 hours</strong> to
                    confirm your hotel reservation and finalise your trip.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-blue/10 text-xs font-extrabold text-brand-blue dark:bg-brand-sand/10 dark:text-brand-sand">
                    3
                  </span>
                  <p className="text-sm text-brand-navy/70 dark:text-white/70">
                    Save your booking reference:{" "}
                    <strong className="font-mono text-brand-navy dark:text-white">
                      #{state.reference}
                    </strong>
                  </p>
                </li>
              </ol>
            </div>

            {/* CTA */}
            <div className="mx-auto mt-8 flex max-w-lg justify-center">
              <Link
                href={tripPageHref}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-brand-blue px-8 text-sm font-extrabold text-white transition hover:bg-brand-blue-strong dark:bg-brand-sand dark:text-brand-navy"
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

  // ── Pending ───────────────────────────────────────────────────────────────
  if (state.status === "pending") {
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
              Please check again, or look for a receipt email from Stripe.
              If this persists, contact us.
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

  // ── Not found / error ─────────────────────────────────────────────────────
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
            contact us with your booking reference and we will look into it.
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
