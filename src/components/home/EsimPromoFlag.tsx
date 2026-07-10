"use client";

import { useState } from "react";

import {
  getCountryFlagDisplay,
  type CountryFlagDisplay,
} from "@/components/esim/country-flag";

/**
 * Flag chip for the homepage eSIM promo cards. Client component so a broken
 * remote flag URL falls back to the ISO badge (same pattern as CountryPicker).
 * Uses a plain <img> because Airhub returns remote SVG flag URLs.
 */
export function EsimPromoFlag({
  isoCode,
  countryName,
  flagUrl,
}: {
  isoCode: string;
  countryName: string;
  flagUrl: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const display: CountryFlagDisplay = getCountryFlagDisplay({
    isoCode,
    countryName,
    flagUrl,
    imageFailed: failed,
  });

  if (display.kind === "image") {
    return (
      <span className="flag-chip grid size-11 shrink-0 place-items-center border border-border-soft bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote SVG flag URLs; img avoids next/image remote SVG config. */}
        <img
          src={display.src}
          alt={display.alt}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  return (
    <span className="flag-chip grid size-11 shrink-0 place-items-center bg-brand-sky text-sm font-black text-brand-navy">
      {display.label}
    </span>
  );
}
