"use client";

import Link from "next/link";

type TripErrorFallbackProps = {
  onRetry: () => void;
};

export function TripErrorFallback({ onRetry }: TripErrorFallbackProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f4f8] px-4 text-black">
      <section className="w-full max-w-md rounded-[10px] border border-[#d7d9de] bg-white p-6 text-center shadow-sm">
        <h1 className="text-[24px] font-semibold leading-tight">
          We could not load this trip
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-[#555b63]">
          Please try again. No technical error details are shown here.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onRetry}
            className="h-11 rounded-[4px] bg-[#bd2c32] px-5 text-[14px] font-bold text-white transition hover:bg-[#a92228]"
          >
            Try again
          </button>
          <Link
            href="/trips"
            className="flex h-11 items-center justify-center rounded-[4px] border border-[#d7d9de] px-5 text-[14px] font-bold text-[#bd2c32] transition hover:border-[#bd2c32]"
          >
            View trips
          </Link>
        </div>
      </section>
    </main>
  );
}
