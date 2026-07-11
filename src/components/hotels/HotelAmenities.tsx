"use client";

import { useState } from "react";
import { Check } from "lucide-react";

const INITIAL_VISIBLE = 10;

/**
 * Amenities list. Shows the first ~10 and reveals the rest via "Show more".
 * Renders nothing when there are no amenities (caller can also guard). Only real
 * provider amenities are shown — never invented.
 */
export function HotelAmenities({ amenities }: { amenities: string[] }) {
  const [expanded, setExpanded] = useState(false);

  if (amenities.length === 0) return null;

  const visible = expanded ? amenities : amenities.slice(0, INITIAL_VISIBLE);
  const hiddenCount = amenities.length - visible.length;

  return (
    <div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((amenity) => (
          <li key={amenity} className="flex items-center gap-2 text-sm font-semibold text-brand-navy/80 dark:text-white/80">
            <Check aria-hidden="true" className="size-4 shrink-0 text-brand-blue dark:text-brand-sand" />
            <span className="min-w-0 truncate">{amenity}</span>
          </li>
        ))}
      </ul>

      {amenities.length > INITIAL_VISIBLE ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-border-soft bg-white px-4 text-sm font-black text-brand-navy hover:bg-[#fffaf2] dark:bg-white/10 dark:text-white"
        >
          {expanded ? "Show fewer amenities" : `Show ${hiddenCount} more`}
        </button>
      ) : null}
    </div>
  );
}
