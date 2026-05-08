"use client";

import { CalendarDays, MapPinned, Search, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type DestinationOption = {
  slug: string;
  name: string;
};

type HeroSearchProps = {
  destinations: DestinationOption[];
};

export function HeroSearch({ destinations }: HeroSearchProps) {
  const router = useRouter();
  const [destination, setDestination] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!destination) {
      router.push("/trips");
      return;
    }

    router.push(`/trips/${destination}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 grid max-w-4xl gap-3 rounded-lg border border-white/22 bg-white/14 p-3 backdrop-blur-xl md:grid-cols-[1fr_1fr_1fr_auto]"
      aria-label="Search holiday packages"
    >
      <label className="flex min-h-14 items-center gap-3 rounded-lg bg-white/94 px-4 text-brand-navy">
        <MapPinned aria-hidden="true" className="size-5 text-brand-blue" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase text-brand-blue/70">
            Where to?
          </span>
          <select
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            className="block w-full appearance-none truncate bg-transparent text-sm font-extrabold outline-none"
          >
            <option value="">Select destination</option>
            {destinations.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </span>
      </label>

      <label className="flex min-h-14 items-center gap-3 rounded-lg bg-white/94 px-4 text-brand-navy">
        <CalendarDays aria-hidden="true" className="size-5 text-brand-blue" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase text-brand-blue/70">
            When
          </span>
          <input
            type="date"
            className="block w-full bg-transparent text-sm font-extrabold outline-none"
            aria-label="Travel date"
          />
        </span>
      </label>

      <label className="flex min-h-14 items-center gap-3 rounded-lg bg-white/94 px-4 text-brand-navy">
        <Users aria-hidden="true" className="size-5 text-brand-blue" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase text-brand-blue/70">
            Travelers
          </span>
          <input
            type="number"
            min={1}
            max={20}
            placeholder="Guests"
            className="block w-full bg-transparent text-sm font-extrabold outline-none placeholder:text-brand-blue/50"
            aria-label="Number of travelers"
          />
        </span>
      </label>

      <button
        type="submit"
        className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-brand-blue px-6 text-sm font-extrabold text-white shadow-[0_16px_34px_rgb(18_63_118/0.32)] transition hover:-translate-y-0.5 hover:bg-brand-navy dark:bg-brand-sand dark:text-white dark:hover:bg-brand-sand/90"
      >
        <Search aria-hidden="true" className="size-4" />
        Search
      </button>
    </form>
  );
}
