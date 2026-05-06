import { BookingStepper } from "@/components/trips/BookingStepper";

export function TripListSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading trip results"
      className="min-h-screen bg-[#f3f4f8] text-black"
    >
      <div className="hidden pt-10 md:block">
        <BookingStepper />
      </div>
      <section className="mx-auto grid w-full max-w-[1120px] gap-4 px-4 pb-8 pt-5 lg:grid-cols-[268px_minmax(0,1fr)] xl:px-0">
        <div className="hidden rounded-[10px] border border-[#d6d8dd] bg-white p-[18px] lg:block">
          <SkeletonBlock className="h-5 w-44" />
          <SkeletonBlock className="mt-4 h-11 w-full" />
          <SkeletonBlock className="mt-6 h-5 w-40" />
          <SkeletonBlock className="mt-4 h-11 w-full" />
          <SkeletonBlock className="mt-7 h-5 w-28" />
          <SkeletonBlock className="mt-4 h-4 w-full" />
          <div className="mt-7 grid grid-cols-2 gap-2">
            <SkeletonBlock className="h-16" />
            <SkeletonBlock className="h-16" />
          </div>
          <div className="mt-7 grid gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-5 w-full" />
            ))}
          </div>
        </div>

        <div>
          <div className="border-b border-[#d8dbe1] pb-4">
            <SkeletonBlock className="h-7 w-56" />
            <SkeletonBlock className="mt-3 h-4 w-44" />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-[10px] bg-white shadow-sm"
              >
                <SkeletonBlock className="h-[230px] rounded-none" />
                <div className="p-[18px]">
                  <SkeletonBlock className="h-6 w-3/4" />
                  <SkeletonBlock className="mt-3 h-4 w-28" />
                  <SkeletonBlock className="mt-5 h-px w-full rounded-none" />
                  <SkeletonBlock className="mt-5 h-4 w-full" />
                  <SkeletonBlock className="mt-3 h-4 w-11/12" />
                  <SkeletonBlock className="mt-3 h-4 w-10/12" />
                  <SkeletonBlock className="mt-8 h-11 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export function TripDetailSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading trip details"
      className="min-h-screen bg-[#f3f4f8] pb-10 text-black"
    >
      <div className="hidden pt-5 md:block">
        <BookingStepper />
      </div>
      <section className="mx-auto w-full max-w-[1256px] px-4 pt-5 md:pt-[18px] xl:px-0">
        <div className="grid grid-cols-3 gap-1 md:grid-cols-5 md:grid-rows-[145px_145px]">
          <SkeletonBlock className="col-span-3 h-[216px] sm:h-[260px] md:col-span-2 md:row-span-2 md:h-auto" />
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-[78px] sm:h-[92px] md:h-auto" />
          ))}
        </div>

        <div className="mt-5 rounded-[10px] border border-[#d7d9de] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <SkeletonBlock className="h-5 w-96 max-w-full" />
            <SkeletonBlock className="h-10 w-64" />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2.05fr)_407px]">
          <div className="grid gap-4">
            <div className="rounded-[10px] border border-[#d7d9de] bg-white p-4">
              <SkeletonBlock className="h-8 w-72 max-w-full" />
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <SkeletonBlock key={index} className="h-12" />
                ))}
              </div>
              <SkeletonBlock className="mt-6 h-px w-full rounded-none" />
              <SkeletonBlock className="mt-5 h-4 w-full" />
              <SkeletonBlock className="mt-3 h-4 w-10/12" />
            </div>
            <div className="rounded-[10px] border border-[#d7d9de] bg-white p-4">
              <SkeletonBlock className="h-5 w-28" />
              <SkeletonBlock className="mt-5 h-px w-full rounded-none" />
              <SkeletonBlock className="mt-5 h-4 w-full" />
              <SkeletonBlock className="mt-4 h-4 w-11/12" />
              <SkeletonBlock className="mt-4 h-4 w-10/12" />
            </div>
          </div>
          <div className="grid content-start gap-4">
            <SkeletonBlock className="h-48" />
            <SkeletonBlock className="h-56" />
          </div>
        </div>
      </section>
    </main>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={[
        "animate-pulse rounded-[6px] bg-linear-to-r from-[#e4e6eb] via-[#f2f3f6] to-[#e4e6eb]",
        className,
      ].join(" ")}
    />
  );
}
