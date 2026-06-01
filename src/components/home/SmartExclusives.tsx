"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { PublicHomeSectionCopy } from "@/types/home";
import type { ProductCard } from "@/types/travel";

const CARD_GAP = 16;

type SmartExclusivesProps = {
  items: ProductCard[];
  section: PublicHomeSectionCopy;
};

export function SmartExclusives({ items, section }: SmartExclusivesProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollByCard(direction: 1 | -1) {
    const scroller = scrollerRef.current;
    const firstCard = scroller?.querySelector<HTMLElement>("[data-exclusive]");

    if (!scroller || !firstCard) {
      return;
    }

    scroller.scrollBy({
      left: direction * (firstCard.offsetWidth + CARD_GAP),
      behavior: "smooth",
    });
  }

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const firstCard =
        scroller.querySelector<HTMLElement>("[data-exclusive]");
      const step = firstCard
        ? firstCard.offsetWidth + CARD_GAP
        : scroller.clientWidth;
      const maxScroll = scroller.scrollWidth - scroller.clientWidth;
      const nextLeft =
        scroller.scrollLeft + step >= maxScroll - 4
          ? 0
          : scroller.scrollLeft + step;

      scroller.scrollTo({ left: nextLeft, behavior: "smooth" });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <section className="bg-background px-4 py-14 sm:px-6 lg:px-12">
      <div className="mx-auto max-w-[1500px]">
        <div className="relative">
          <div className="flex flex-col justify-between gap-5 border-b border-border-soft pb-6 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-extrabold uppercase text-brand-red">
                {section.eyebrow}
              </p>
              <h2 className="mt-2 font-serif text-4xl leading-[1.05] text-slate-950 dark:text-white sm:text-5xl">
                {section.title}
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-brand-blue/80 dark:text-brand-sky sm:text-base">
              {section.description}
            </p>
          </div>

          <button
            type="button"
            aria-label="Previous exclusive"
            onClick={() => scrollByCard(-1)}
            className="absolute -left-3 top-[61%] z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-lg border border-white/50 bg-slate-950/38 text-white backdrop-blur transition hover:bg-brand-red md:grid"
          >
            <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.1} />
          </button>
          <button
            type="button"
            aria-label="Next exclusive"
            onClick={() => scrollByCard(1)}
            className="absolute -right-3 top-[61%] z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-lg border border-white/50 bg-slate-950/38 text-white backdrop-blur transition hover:bg-brand-red md:grid"
          >
            <ArrowRight aria-hidden="true" className="size-5" strokeWidth={2.1} />
          </button>

          <div
            ref={scrollerRef}
            className="no-scrollbar mt-8 flex gap-4 overflow-x-auto scroll-smooth pb-2"
          >
            {items.map((item) => (
              <article
                key={item.title}
                data-exclusive
                className="modern-card group relative w-[255px] flex-none overflow-hidden rounded-lg bg-surface transition hover:-translate-y-0.5 sm:w-[314px] xl:w-[342px]"
              >
                <Link
                  href={item.href ?? "/trips"}
                  aria-label={`${item.action} for ${item.title}`}
                  className="absolute inset-0 z-20"
                />
                <div className="relative h-[255px] overflow-hidden bg-surface-muted sm:h-[304px]">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    sizes="(min-width: 1280px) 342px, (min-width: 640px) 314px, 255px"
                    className="object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/62 via-black/4 to-black/5" />
                  <span className="absolute bottom-4 left-4 rounded-lg border border-white/35 bg-white/18 px-3 py-1.5 text-xs font-extrabold uppercase text-white backdrop-blur">
                    {item.price}
                  </span>
                </div>
                <div className="grid min-h-[120px] grid-cols-[1fr_auto] gap-4 p-4">
                  <div>
                    <h3 className="text-[1.08rem] font-extrabold leading-tight text-slate-950 dark:text-white">
                      {item.title}
                    </h3>
                    {item.summary ? (
                      <p className="mt-3 text-sm leading-6 text-brand-blue/78 dark:text-brand-sky">
                        {item.summary}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className="self-end whitespace-nowrap rounded-lg bg-brand-blue px-3.5 py-2 text-xs font-extrabold text-white transition group-hover:bg-brand-navy dark:bg-brand-sand dark:text-brand-navy"
                  >
                    {item.action}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
