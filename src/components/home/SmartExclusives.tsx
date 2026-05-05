"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { exclusives } from "@/data/travel";

const CARD_GAP = 12;

export function SmartExclusives() {
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
    <section className="bg-background px-4 py-8 sm:px-6 lg:px-12 lg:py-8">
      <div className="mx-auto max-w-[1590px]">
        <div className="soft-card-shadow relative rounded-lg border border-border-soft bg-surface px-6 pb-7 pt-6 dark:bg-surface">
          <h2 className="text-center font-serif text-4xl leading-tight text-slate-950 dark:text-white sm:text-[2.85rem] lg:text-[3rem]">
            Smart Exclusives
          </h2>

          <button
            type="button"
            aria-label="Previous exclusive"
            onClick={() => scrollByCard(-1)}
            className="absolute -left-2 top-[53%] z-10 hidden h-12 w-[76px] -translate-y-1/2 place-items-center rounded-full bg-slate-500/35 text-white backdrop-blur transition hover:bg-brand-blue/80 md:grid"
          >
            <ArrowLeft aria-hidden="true" className="size-7" strokeWidth={1.7} />
          </button>
          <button
            type="button"
            aria-label="Next exclusive"
            onClick={() => scrollByCard(1)}
            className="absolute -right-2 top-[53%] z-10 hidden h-12 w-[76px] -translate-y-1/2 place-items-center rounded-full bg-slate-500/35 text-white backdrop-blur transition hover:bg-brand-blue/80 md:grid"
          >
            <ArrowRight aria-hidden="true" className="size-7" strokeWidth={1.7} />
          </button>

          <div
            ref={scrollerRef}
            className="no-scrollbar mt-8 flex gap-3 overflow-x-auto scroll-smooth pb-1"
          >
            {exclusives.map((item) => (
              <article
                key={item.title}
                data-exclusive
                className="w-[250px] flex-none rounded-lg bg-white p-0 dark:bg-neutral-950 sm:w-[318px] xl:w-[376px]"
              >
                <div className="relative h-[245px] overflow-hidden rounded-lg sm:h-[292px] xl:h-[375px]">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    sizes="(min-width: 1280px) 376px, (min-width: 640px) 330px, 250px"
                    className="object-cover"
                  />
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-4 py-3.5">
                  <div>
                    <h3 className="text-[1.2rem] font-bold leading-tight text-slate-950 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Starts from
                    </p>
                    <p className="mt-1 text-[1.35rem] font-extrabold leading-none text-brand-blue">
                      {item.price}
                    </p>
                  </div>
                  <a
                    href="#contact"
                    className="self-end whitespace-nowrap rounded-lg border border-border-soft px-3.5 py-2 text-sm font-medium text-slate-900 transition hover:border-brand-blue hover:bg-brand-blue hover:text-white dark:text-white"
                  >
                    {item.action}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
