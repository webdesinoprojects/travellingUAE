"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";

import { HotelImage } from "./HotelImage";

/**
 * RateHawk-style hotel gallery with a dependency-free lightbox.
 *
 * - 0 images  -> single branded placeholder
 * - 1 image   -> single hero
 * - 2+ images -> big hero + a 2x2 thumbnail grid; the last tile shows "+N photos"
 *
 * The lightbox shows the large image with prev/next + a thumbnail strip, the
 * hotel title, and (when provided) a "Services and amenities" side panel — all
 * real data. Uses plain <img> via HotelImage so broken/variable-host provider
 * URLs fall back cleanly.
 */
export function HotelGallery({
  images,
  hotelName,
  amenities = [],
}: {
  images: string[];
  hotelName: string;
  amenities?: string[];
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const open = (index: number) => setLightboxIndex(index);
  const close = useCallback(() => setLightboxIndex(null), []);
  const showPrev = useCallback(
    () => setLightboxIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length)),
    [images.length],
  );
  const showNext = useCallback(
    () => setLightboxIndex((i) => (i === null ? i : (i + 1) % images.length)),
    [images.length],
  );

  useEffect(() => {
    if (lightboxIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") showPrev();
      else if (e.key === "ArrowRight") showNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, close, showPrev, showNext]);

  const lightbox =
    lightboxIndex !== null ? (
      <Lightbox
        images={images}
        index={lightboxIndex}
        hotelName={hotelName}
        amenities={amenities}
        onClose={close}
        onPrev={showPrev}
        onNext={showNext}
        onSelect={setLightboxIndex}
      />
    ) : null;

  if (images.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-border-soft">
        <HotelImage src={null} alt={hotelName} className="h-[320px] w-full" loading="eager" />
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <>
        <button
          type="button"
          onClick={() => open(0)}
          className="block w-full overflow-hidden rounded-xl border border-border-soft"
          aria-label="View photo"
        >
          <HotelImage
            src={images[0]}
            alt={hotelName}
            className="h-[300px] w-full transition duration-500 hover:scale-[1.02] sm:h-[420px]"
            loading="eager"
          />
        </button>
        {lightbox}
      </>
    );
  }

  const thumbs = images.slice(1, 5);
  const extra = images.length - 5;

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <button
          type="button"
          onClick={() => open(0)}
          className="group relative block overflow-hidden rounded-xl border border-border-soft"
          aria-label="View all photos"
        >
          <HotelImage
            src={images[0]}
            alt={hotelName}
            className="h-64 w-full transition duration-500 group-hover:scale-[1.02] sm:h-[440px]"
            loading="eager"
          />
        </button>

        <div className="grid grid-cols-2 gap-2">
          {thumbs.map((image, i) => {
            const isLast = i === thumbs.length - 1 && extra > 0;
            return (
              <button
                key={image}
                type="button"
                onClick={() => open(i + 1)}
                className="group relative block overflow-hidden rounded-xl border border-border-soft"
                aria-label={isLast ? `View all ${images.length} photos` : "View photo"}
              >
                <HotelImage
                  src={image}
                  alt={`${hotelName} photo ${i + 2}`}
                  className="h-[124px] w-full transition duration-500 group-hover:scale-[1.03] sm:h-[216px]"
                />
                {isLast ? (
                  <span className="absolute inset-0 grid place-items-center gap-1 bg-black/55 text-sm font-black text-white">
                    <Images className="size-5" aria-hidden="true" />+{extra} photos
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      {lightbox}
    </>
  );
}

function Lightbox({
  images,
  index,
  hotelName,
  amenities,
  onClose,
  onPrev,
  onNext,
  onSelect,
}: {
  images: string[];
  index: number;
  hotelName: string;
  amenities: string[];
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (i: number) => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${hotelName} photos`}
      className="fixed inset-0 z-50 flex flex-col bg-black/92 p-3 sm:p-4"
    >
      <div className="flex items-center justify-between text-white">
        <span className="truncate text-sm font-black sm:text-base">{hotelName}</span>
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold">
            {index + 1} / {images.length}
          </span>
          <button type="button" onClick={onClose} aria-label="Close photos" className="rounded-lg p-1 hover:bg-white/10">
            <X className="size-6" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 py-3">
        {/* Main image + controls */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            {images.length > 1 ? (
              <button
                type="button"
                onClick={onPrev}
                aria-label="Previous photo"
                className="absolute left-0 z-10 grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronLeft className="size-6" aria-hidden="true" />
              </button>
            ) : null}
            <HotelImage src={images[index]} alt={`${hotelName} photo ${index + 1}`} className="max-h-full max-w-full rounded-lg" loading="eager" />
            {images.length > 1 ? (
              <button
                type="button"
                onClick={onNext}
                aria-label="Next photo"
                className="absolute right-0 z-10 grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronRight className="size-6" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((image, i) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => onSelect(i)}
                  aria-label={`Photo ${i + 1}`}
                  className={`shrink-0 overflow-hidden rounded-md border-2 ${
                    i === index ? "border-white" : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <HotelImage src={image} alt="" className="h-14 w-20" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Amenities side panel (real data only; hidden when empty) */}
        {amenities.length > 0 ? (
          <aside className="hidden w-72 shrink-0 overflow-y-auto rounded-lg bg-white p-4 lg:block dark:bg-[#1a1712]">
            <h3 className="text-base font-black text-brand-navy dark:text-white">Services and amenities</h3>
            <ul className="mt-3 grid gap-1.5">
              {amenities.slice(0, 30).map((amenity) => (
                <li key={amenity} className="text-sm font-semibold text-brand-navy/80 dark:text-white/80">
                  • {amenity}
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
