"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History } from "lucide-react";

import { HotelImage } from "@/components/hotels/HotelImage";

/**
 * "Recently viewed" hotels, stored in localStorage only (no server, no tracking
 * of personal data). Records the current hotel on mount and shows up to 3
 * previously viewed hotels (excluding the current one). Hidden when empty.
 * Every field stored is real data passed from the detail page.
 */
export type RecentHotel = {
  id: string;
  name: string;
  image: string | null;
  priceLabel: string | null;
  href: string;
};

const STORAGE_KEY = "flytime_recent_hotels";
const MAX = 3;

export function RecentlyViewedHotels({ current }: { current: RecentHotel }) {
  const [others, setOthers] = useState<RecentHotel[]>([]);

  useEffect(() => {
    let stored: RecentHotel[] = [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) stored = parsed.filter(isRecentHotel);
      }
    } catch {
      stored = [];
    }

    // Others = previously viewed, excluding the current hotel. This is a
    // one-time load from an external store (localStorage) on mount, which is
    // only available on the client — a legitimate effect-driven setState.
    const previous = stored.filter((h) => h.id !== current.id).slice(0, MAX);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage read on mount
    setOthers(previous);

    // Persist: current first, then the rest (deduped), capped.
    const next = [current, ...stored.filter((h) => h.id !== current.id)].slice(0, MAX + 1);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage failures (private mode / quota)
    }
  }, [current]);

  if (others.length === 0) return null;

  return (
    <section className="rounded-xl border border-border-soft bg-surface p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-black text-brand-navy dark:text-white">
        <span className="text-brand-blue dark:text-brand-sand">
          <History className="size-5" aria-hidden="true" />
        </span>
        Recently viewed
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {others.map((hotel) => (
          <li key={hotel.id}>
            <Link
              href={hotel.href}
              className="flex gap-3 rounded-lg border border-border-soft bg-white p-3 transition hover:border-brand-blue dark:bg-surface-muted"
            >
              <span className="size-16 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                <HotelImage src={hotel.image} alt={hotel.name} className="h-full w-full" />
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-sm font-black">{hotel.name}</span>
                {hotel.priceLabel ? (
                  <span className="mt-1 block text-xs font-bold text-brand-navy/60 dark:text-white/60">
                    {hotel.priceLabel}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function isRecentHotel(value: unknown): value is RecentHotel {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.name === "string" && typeof v.href === "string";
}
