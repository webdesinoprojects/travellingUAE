import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f4f8] px-4 text-black">
      <section className="w-full max-w-md rounded-[10px] border border-[#d7d9de] bg-white p-6 text-center shadow-sm">
        <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#bd2c32]">
          Trip unavailable
        </p>
        <h1 className="mt-3 text-[26px] font-semibold leading-tight">
          This trip is not available right now
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-[#555b63]">
          The selected package may have moved or the demo route does not exist.
        </p>
        <Link
          href="/trips"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-[4px] bg-[#bd2c32] px-5 text-[14px] font-bold text-white transition hover:bg-[#a92228]"
        >
          View available trips
        </Link>
      </section>
    </main>
  );
}
