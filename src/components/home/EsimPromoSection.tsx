import { ArrowRight, Wifi } from "lucide-react";
import Link from "next/link";

import { SectionHeading } from "@/components/ui/SectionHeading";
import type { EsimPromoContent } from "@/server/public/esim-promo-helpers";

import { EsimPromoFlag } from "./EsimPromoFlag";

/**
 * Homepage eSIM promo. Pure presentation: renders the cache-derived promo cards
 * (see server/public/esim-promo.ts). Never fetches — all data arrives as props,
 * so the homepage never calls Airhub live.
 */
export function EsimPromoSection({ content }: { content: EsimPromoContent }) {
  if (content.cards.length === 0) {
    return null;
  }

  return (
    <section id="esim-promo" className="bg-background px-4 py-16 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1240px]">
        <SectionHeading
          eyebrow={content.eyebrow}
          title={content.title}
          description={content.subtitle}
        />

        {/*
          Mobile: horizontal scroll-snap row (compact cards, hidden scrollbar).
          The overflow lives on this padded container, so the page never scrolls
          horizontally. sm+ keeps the original responsive grid unchanged.
        */}
        <div className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3">
          {content.cards.map((card) => (
            <Link
              key={card.countryCode}
              href={card.href}
              aria-label={`View eSIM plans for ${card.countryName}`}
              className="modern-card group flex w-[280px] shrink-0 snap-start flex-col justify-between gap-4 bg-surface p-5 transition hover:border-brand-blue sm:w-auto sm:shrink dark:hover:border-brand-sand"
            >
              <div className="flex items-start gap-3">
                <EsimPromoFlag
                  isoCode={card.countryCode}
                  countryName={card.countryName}
                  flagUrl={card.flagUrl}
                />
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-extrabold text-brand-navy dark:text-white">
                    {card.countryName}
                  </h3>
                  <p className="mt-0.5 text-xs font-black uppercase tracking-[0.1em] text-brand-brown">
                    {card.countryCode}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-brand-blue/76 dark:text-brand-sky">
                {card.dataLabel ? (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-border-soft bg-surface-muted px-2 py-1">
                    <Wifi aria-hidden="true" className="size-3.5" />
                    {card.dataLabel}
                  </span>
                ) : null}
                {card.validityLabel ? (
                  <span className="inline-flex items-center rounded-lg border border-border-soft bg-surface-muted px-2 py-1">
                    {card.validityLabel}
                  </span>
                ) : null}
              </div>

              <div className="flex items-end justify-between gap-3">
                <div>
                  {card.startingPriceLabel ? (
                    <p className="text-base font-extrabold text-brand-navy dark:text-white">
                      {card.startingPriceLabel}
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-brand-blue/76 dark:text-brand-sky">
                      View available plans
                    </p>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-black text-brand-blue transition group-hover:gap-2 dark:text-brand-sand">
                  View eSIM plans
                  <ArrowRight aria-hidden="true" className="size-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href={content.ctaHref}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-blue px-5 text-sm font-black text-white transition hover:bg-brand-navy dark:bg-brand-sand dark:text-brand-navy"
          >
            {content.ctaLabel}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
