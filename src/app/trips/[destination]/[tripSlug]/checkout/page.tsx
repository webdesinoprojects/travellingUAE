import {
  BedDouble,
  CalendarDays,
  Car,
  CheckCircle2,
  Clock,
  Plane,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CheckoutForm } from "@/components/trips/CheckoutForm";
import { getCheckoutSummary, SESSION_COOKIE } from "@/server/itinerary/dal";
import { hasStripeEnv } from "@/server/payments/stripe";
import { getPublicTripPackage } from "@/server/public/dal";
import type { CheckoutLineItem, CheckoutSummaryDTO } from "@/types/itinerary";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ destination: string; tripSlug: string }>;
}): Promise<Metadata> {
  const { tripSlug } = await params;
  return {
    title: `Checkout | ${tripSlug.replace(/-/g, " ")} | Fly Time`,
  };
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ destination: string; tripSlug: string }>;
}) {
  const { destination, tripSlug } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  const [summary, pkg] = await Promise.all([
    getCheckoutSummary({
      destinationSlug: destination,
      tripSlug,
      sessionToken,
    }),
    getPublicTripPackage(destination, tripSlug),
  ]);

  const stripeSessionPath =
    summary && hasStripeEnv() && summary.totalDelta.amount > 0
      ? `/api/public/trips/${destination}/${tripSlug}/checkout/stripe-session`
      : null;

  if (!pkg) {
    notFound();
  }

  const tripPageHref = `/trips/${destination}/${tripSlug}`;

  if (!summary) {
    return (
      <>
        <main className="min-h-screen bg-background pt-28 text-brand-navy dark:bg-black dark:text-white">
          <div className="section-shell py-16 text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-surface-muted dark:bg-white/[0.06]">
              <Clock className="size-8 text-brand-navy/40 dark:text-white/40" aria-hidden="true" />
            </span>
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight">
              Your selection has expired
            </h1>
            <p className="mt-4 text-base text-brand-navy/68 dark:text-white/68">
              Option selections expire after 45 minutes. Please go back and
              choose your options again.
            </p>
            <Link
              href={tripPageHref}
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-brand-blue px-6 text-sm font-extrabold text-white transition hover:bg-brand-blue-strong dark:bg-brand-sand dark:text-brand-navy"
            >
              Back to {pkg.title}
            </Link>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-background pt-28 text-brand-navy dark:bg-black dark:text-white">
        <div className="section-shell py-10">
          <div className="mb-8">
            <Link
              href={tripPageHref}
              className="text-sm font-semibold text-brand-blue hover:underline dark:text-brand-sand"
            >
              Back to {summary.trip.title}
            </Link>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight">
              Review your booking
            </h1>
            <p className="mt-2 text-sm text-brand-navy/68 dark:text-white/68">
              {summary.trip.destinationName} / {summary.trip.title}
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0">
              <SelectionSummary summary={summary} />

              <section className="mt-8">
                <h2 className="text-2xl font-extrabold tracking-tight">
                  Your details
                </h2>
                <p className="mt-2 text-sm text-brand-navy/68 dark:text-white/68">
                  We will contact you to confirm availability and payment
                  arrangements.
                </p>
                <CheckoutForm
                  destinationSlug={destination}
                  tripSlug={tripSlug}
                  travelDate={summary.travelDate}
                  travelersCount={summary.travelersCount}
                  tripPageHref={tripPageHref}
                  stripeSessionPath={stripeSessionPath}
                />
              </section>
            </div>

            <OrderSummaryCard
              summary={summary}
              pkg={pkg}
              stripeEnabled={Boolean(stripeSessionPath)}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function SelectionSummary({ summary }: { summary: CheckoutSummaryDTO }) {
  return (
    <section>
      <h2 className="text-2xl font-extrabold tracking-tight">
        Selected options
      </h2>
      <div className="mt-4 grid gap-3">
        {summary.selections.map((item) => (
          <SelectionLineCard key={item.segmentId} item={item} />
        ))}
      </div>
    </section>
  );
}

const typeIconMap: Record<string, LucideIcon> = {
  hotel: BedDouble,
  flight: Plane,
  transfer: Car,
  activity: Sparkles,
  stay: BedDouble,
  note: Sparkles,
};

function SelectionLineCard({ item }: { item: CheckoutLineItem }) {
  const Icon = typeIconMap[item.type] ?? CheckCircle2;
  const isPositive = item.priceDelta.amount > 0;

  return (
    <div className="modern-card flex flex-col gap-2 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-blue text-white dark:bg-brand-sand dark:text-brand-navy">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-blue/70 dark:text-brand-sand">
            {item.segmentTitle}
          </p>
          <p className="mt-1 text-sm font-extrabold text-brand-navy dark:text-white">
            {item.optionLabel}
          </p>
          {item.cancellationSummary ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-brand-green">
              <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0" />
              {item.cancellationSummary}
            </p>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={[
            "text-base font-black",
            isPositive
              ? "text-brand-blue dark:text-brand-sand"
              : "text-brand-green",
          ].join(" ")}
        >
          {item.priceDelta.label}
        </p>
      </div>
    </div>
  );
}

function OrderSummaryCard({
  summary,
  pkg,
  stripeEnabled,
}: {
  summary: CheckoutSummaryDTO;
  pkg: { price: string; durationLabel: string };
  stripeEnabled: boolean;
}) {
  const hasExtras = summary.totalDelta.amount !== 0;

  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <div className="modern-card overflow-hidden rounded-lg">
        <div className="border-b border-border-soft bg-surface-muted/45 p-5 dark:bg-white/[0.035]">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-blue dark:text-brand-sand">
            Order summary
          </p>
          <p className="mt-1 text-lg font-extrabold text-brand-navy dark:text-white">
            {summary.trip.title}
          </p>
          <p className="text-sm font-semibold text-brand-navy/60 dark:text-white/60">
            {summary.trip.destinationName} / {pkg.durationLabel}
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="text-brand-navy/70 dark:text-white/70">
              Base package
            </span>
            <span className="font-extrabold">{pkg.price}</span>
          </div>

          {hasExtras ? (
            <div className="mt-3 flex items-center justify-between text-sm font-semibold">
              <span className="text-brand-navy/70 dark:text-white/70">
                Selected options
              </span>
              <span className="font-extrabold text-brand-blue dark:text-brand-sand">
                {summary.totalDelta.label}
              </span>
            </div>
          ) : null}

          {summary.travelDate ? (
            <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-brand-navy/70 dark:text-white/70">
              <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
              Travel date:{" "}
              <strong className="text-brand-navy dark:text-white">
                {summary.travelDate}
              </strong>
            </div>
          ) : null}

          <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-brand-navy/70 dark:text-white/70">
            <Users aria-hidden="true" className="size-4 shrink-0" />
            Travelers:{" "}
            <strong className="text-brand-navy dark:text-white">
              {summary.travelersCount}
            </strong>
          </div>

          <div className="mt-5 rounded-lg border border-brand-blue/20 bg-brand-blue/5 p-3 dark:border-brand-sand/20 dark:bg-brand-sand/5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-blue/70 dark:text-brand-sand">
              Payment
            </p>
            <p className="mt-1 text-xs leading-5 text-brand-navy/68 dark:text-white/68">
              {stripeEnabled
                ? "Card payment is available for your selected hotel add-on. The base package remains handled by the travel desk."
                : "No payment is taken now. Our travel team will confirm availability and send you payment details."}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
