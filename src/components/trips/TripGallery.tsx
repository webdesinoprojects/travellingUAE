"use client";

import Image from "next/image";
import { useState } from "react";
import type { TripGalleryImage } from "@/types/travel";

type TripGalleryProps = {
  images: TripGalleryImage[];
  title: string;
};

export function TripGallery({ images, title }: TripGalleryProps) {
  const gallery = images.slice(0, 5);
  const defaultIndex = gallery.length > 1 ? 1 : 0;
  const [activeIndex, setActiveIndex] = useState(defaultIndex);

  if (gallery.length === 0) {
    return null;
  }

  const activeImage = gallery[activeIndex] ?? gallery[0];

  return (
    <>
      <div aria-label={`${title} gallery`} className="lg:hidden">
        <figure className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-muted">
          <Image
            src={activeImage.src}
            alt={activeImage.alt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </figure>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {gallery.map((image, index) => (
            <button
              key={`${image.src}-${index}`}
              type="button"
              aria-label={`Show image ${index + 1}`}
              aria-pressed={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              className={[
                "relative h-16 w-20 flex-none overflow-hidden rounded-lg border bg-surface-muted",
                index === activeIndex
                  ? "border-brand-blue dark:border-brand-sand"
                  : "border-border-soft",
              ].join(" ")}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="80px"
                className="object-cover"
              />
              {index === gallery.length - 1 && images.length > gallery.length ? (
                <span className="absolute inset-0 grid place-items-center bg-black/48 text-xs font-black text-white">
                  +{images.length - gallery.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div
        aria-label={`${title} gallery`}
        className="hidden gap-2 lg:grid lg:grid-cols-[0.78fr_1.85fr_0.78fr] lg:grid-rows-[180px_180px]"
      >
        <GalleryImage image={gallery[0]} className="lg:row-start-1" priority />
        <GalleryImage
          image={activeImage}
          className="lg:col-span-1 lg:row-span-2"
          priority
        />
        <GalleryImage image={gallery[2] ?? gallery[0]} />
        <GalleryImage image={gallery[3] ?? gallery[0]} />
        <GalleryImage image={gallery[4] ?? gallery[0]} />
      </div>
    </>
  );
}

function GalleryImage({
  image,
  className = "",
  priority = false,
}: {
  image: TripGalleryImage;
  className?: string;
  priority?: boolean;
}) {
  return (
    <figure
      className={[
        "relative min-h-[180px] overflow-hidden rounded-lg bg-surface-muted",
        className,
      ].join(" ")}
    >
      <Image
        src={image.src}
        alt={image.alt}
        fill
        priority={priority}
        sizes="(min-width: 1024px) 620px, 100vw"
        className="object-cover"
      />
    </figure>
  );
}
