import { ExternalLink, MapPin } from "lucide-react";

/**
 * Location card: a lightweight OpenStreetMap embed (iframe, no dependency) with
 * a single marker at the hotel's real coordinates, the address, and an
 * "Open in OpenStreetMap" link. No nearby places / airports / metro (that data
 * isn't in our DTO and would be fabricated).
 */
export function HotelLocationCard({
  latitude,
  longitude,
  address,
  regionName,
  hotelName,
}: {
  latitude: number;
  longitude: number;
  address: string | null;
  regionName: string | null;
  hotelName: string;
}) {
  // Small bbox around the point so the marker sits centered and zoomed-in.
  const d = 0.008;
  const bbox = `${longitude - d},${latitude - d},${longitude + d},${latitude + d}`;
  const embedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox,
  )}&layer=mapnik&marker=${latitude},${longitude}`;
  const openHref = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;

  return (
    <section className="rounded-xl border border-border-soft bg-surface p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-black text-brand-navy dark:text-white">
        <span className="text-brand-blue dark:text-brand-sand">
          <MapPin className="size-5" aria-hidden="true" />
        </span>
        Location
      </h2>
      {address || regionName ? (
        <p className="mt-2 text-sm font-semibold text-brand-navy/70 dark:text-white/70">
          {[address, regionName].filter(Boolean).join(" · ")}
        </p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-lg border border-border-soft">
        <iframe
          title={`Map showing ${hotelName}`}
          src={embedSrc}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-72 w-full border-0"
        />
      </div>

      <a
        href={openHref}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-black text-brand-blue dark:text-brand-sand"
      >
        Open in OpenStreetMap
        <ExternalLink className="size-3.5" aria-hidden="true" />
      </a>
    </section>
  );
}
