import Link from "next/link";

import { StandaloneHotelStatusPoller } from "@/components/hotels/StandaloneHotelStatusPoller";

export const dynamic = "force-dynamic";

export default async function StandaloneHotelCheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    checkout_id?: string;
    session_id?: string;
    three_ds_return?: string;
  }>;
}) {
  const {
    checkout_id: checkoutId = "",
    session_id: sessionId = "",
    three_ds_return: threeDsReturn = "",
  } = await searchParams;

  if (!checkoutId) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 pt-24 text-brand-navy dark:text-white">
        <div className="rounded-lg border border-border-soft bg-surface p-8 text-center">
          <h1 className="text-3xl font-black">Booking reference missing</h1>
          <Link href="/?service=hotel#travel-search" className="mt-5 inline-flex font-extrabold text-brand-blue">
            Start a new hotel search
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 pt-24 text-brand-navy dark:text-white">
      <section className="w-full max-w-[760px]">
        <StandaloneHotelStatusPoller
          checkoutId={checkoutId}
          stripeSessionId={sessionId || null}
          threeDsReturned={threeDsReturn === "1"}
        />
      </section>
    </main>
  );
}
