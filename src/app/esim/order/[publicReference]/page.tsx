import { LockKeyhole } from "lucide-react";
import Link from "next/link";

import { OrderLookupPanel } from "@/components/esim/OrderLookupPanel";
import { getPublicEsimOrder } from "@/server/providers/airhub/orders";

export const dynamic = "force-dynamic";

export default async function EsimOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicReference: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { publicReference } = await params;
  const { token } = await searchParams;

  if (!token) {
    return <InvalidLookup />;
  }

  let order;
  try {
    order = await getPublicEsimOrder({ publicReference, lookupToken: token });
  } catch {
    return <InvalidLookup />;
  }

  return (
    <main className="min-h-screen bg-background pb-20 pt-32 text-brand-navy dark:text-white">
      <OrderLookupPanel order={order} />
    </main>
  );
}

function InvalidLookup() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 pt-24 text-brand-navy dark:text-white">
      <div className="max-w-xl rounded-lg border border-border-soft bg-surface p-8 text-center">
        <LockKeyhole className="mx-auto size-10 text-brand-blue" aria-hidden="true" />
        <h1 className="mt-4 text-3xl font-black">Order link is invalid</h1>
        <p className="mt-3 text-brand-navy/60 dark:text-white/60">
          Use the secure eSIM order link from your payment confirmation.
        </p>
        <Link
          href="/esim"
          className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-brand-blue px-5 font-extrabold text-white"
        >
          Browse eSIM plans
        </Link>
      </div>
    </main>
  );
}
