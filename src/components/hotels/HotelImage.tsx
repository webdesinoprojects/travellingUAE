"use client";

import { useState } from "react";
import { Hotel } from "lucide-react";

/**
 * Hotel image with a graceful branded fallback. Uses a plain <img> (provider
 * gallery URLs come from variable CDN hosts, so this sidesteps next/image host
 * validation) and swaps to a placeholder when the src is missing OR fails to
 * load — so a broken provider URL never shows a broken-image icon.
 */
export function HotelImage({
  src,
  alt,
  className = "",
  sizes,
  loading = "lazy",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  loading?: "lazy" | "eager";
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  if (!showImage) {
    return (
      <div
        aria-hidden="true"
        className={`grid place-items-center bg-linear-to-br from-brand-sky/60 to-surface-muted text-brand-blue/40 ${className}`}
      >
        <Hotel className="size-10" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- provider gallery URLs use variable CDN hosts; plain img avoids next/image remote config.
    <img
      src={src as string}
      alt={alt}
      sizes={sizes}
      loading={loading}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
