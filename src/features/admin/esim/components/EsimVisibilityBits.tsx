import { Eye, EyeOff, Star } from "lucide-react";

import { getCountryFlagDisplay } from "@/components/esim/country-flag";

export function VisibilityBadge({ isVisible }: { isVisible: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black ${
        isVisible
          ? "bg-[#e8f7ff] text-brand-blue dark:bg-white/10 dark:text-brand-sand"
          : "bg-[#ffe8e2] text-[#a33b1f] dark:bg-red-500/15 dark:text-red-200"
      }`}
    >
      {isVisible ? (
        <Eye aria-hidden="true" className="size-3.5" />
      ) : (
        <EyeOff aria-hidden="true" className="size-3.5" />
      )}
      {isVisible ? "Visible" : "Hidden"}
    </span>
  );
}

export function FeaturedBadge({ isFeatured }: { isFeatured: boolean }) {
  if (!isFeatured) return null;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#fff3df] px-2.5 py-1 text-xs font-black text-[#8a5f31] dark:bg-brand-sand/15 dark:text-brand-sand">
      <Star aria-hidden="true" className="size-3.5" />
      Featured
    </span>
  );
}

/** Small flag chip that mirrors the public flag handling (remote SVG or ISO badge). */
export function CountryFlag({
  isoCode,
  countryName,
  flagUrl,
}: {
  isoCode: string;
  countryName: string;
  flagUrl: string | null;
}) {
  const flag = getCountryFlagDisplay({ isoCode, countryName, flagUrl });

  if (flag.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Airhub returns remote SVG flag URLs; use img to avoid next/image remote SVG config.
      <img src={flag.src} alt={flag.alt} className="h-5 w-7 shrink-0 rounded-sm object-cover" />
    );
  }

  return (
    <span className="grid h-5 w-7 shrink-0 place-items-center rounded-sm bg-[#ead7bd] text-[10px] font-black text-brand-navy dark:bg-white/10 dark:text-white">
      {flag.label}
    </span>
  );
}
