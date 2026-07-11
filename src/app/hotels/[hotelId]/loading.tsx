/**
 * Streaming loading skeleton for the hotel detail page (Next.js App Router
 * `loading.tsx`). This route awaits a live RateHawk Hotelpage fetch, so the
 * skeleton streams instantly while the server segment renders. Scoped to
 * `[hotelId]` so the checkout routes under /hotels are unaffected.
 */
export default function HotelDetailLoading() {
  return (
    <main className="min-h-screen animate-pulse bg-background pb-20 pt-28">
      <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6">
        <div className="h-4 w-40 rounded bg-surface-muted" />

        {/* Summary card */}
        <div className="mt-4 rounded-xl border border-border-soft bg-surface p-6">
          <div className="h-4 w-24 rounded bg-surface-muted" />
          <div className="mt-3 h-8 w-2/3 rounded bg-surface-muted" />
          <div className="mt-3 h-4 w-1/2 rounded bg-surface-muted" />
        </div>

        {/* Gallery */}
        <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="h-64 rounded-xl bg-surface-muted sm:h-[440px]" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[124px] rounded-xl bg-surface-muted sm:h-[216px]" />
            ))}
          </div>
        </div>

        {/* Rooms placeholder */}
        <div className="mt-6 rounded-xl border border-border-soft bg-surface p-6">
          <div className="h-6 w-48 rounded bg-surface-muted" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-surface-muted" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
