import { XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata: Metadata = {
  title: "Payment cancelled | Fly Time",
};

export default async function CheckoutCancelPage({
  params,
}: {
  params: Promise<{ destination: string; tripSlug: string }>;
}) {
  const { destination, tripSlug } = await params;
  const checkoutHref = `/trips/${destination}/${tripSlug}/checkout`;

  return (
    <>
      <main className="min-h-screen bg-background pt-28 text-brand-navy dark:bg-black dark:text-white">
        <div className="section-shell py-16 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-surface-muted dark:bg-white/[0.06]">
            <XCircle className="size-8 text-brand-navy/40 dark:text-white/40" aria-hidden="true" />
          </span>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight">
            Payment cancelled
          </h1>
          <p className="mt-4 text-base text-brand-navy/68 dark:text-white/68">
            No payment was taken. You can return to checkout and try again, or
            submit an enquiry instead.
          </p>
          <Link
            href={checkoutHref}
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-brand-blue px-6 text-sm font-extrabold text-white transition hover:bg-brand-blue-strong dark:bg-brand-sand dark:text-brand-navy"
          >
            Back to checkout
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
