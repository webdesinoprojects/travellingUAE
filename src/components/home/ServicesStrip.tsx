import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Marquee } from "@/components/ui/Marquee";
import { TravelIcon } from "@/components/ui/TravelIcon";
import type { ServiceTile } from "@/types/travel";

type ServicesStripProps = {
  services: ServiceTile[];
};

export function ServicesStrip({ services }: ServicesStripProps) {
  return (
    <section id="services" className="bg-background px-4 py-16 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1240px]">
        <SectionHeading
          eyebrow="Support Desk"
          title="What We Handle"
          description="Flights, stays, visas and documents presented as simple service cards that work for quick enquiries."
        />

        <Marquee className="mx-auto mt-8 max-w-5xl [--duration:30s]">
          {services.map((service) => (
            <span
              key={service.title}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-brand-brown/24 bg-brand-sand/60 px-4 text-sm font-extrabold text-brand-navy dark:border-white/12 dark:bg-white/[0.06] dark:text-white"
            >
              <TravelIcon icon={service.icon} className="size-4" />
              {service.title}
            </span>
          ))}
        </Marquee>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <article
              key={service.title}
              className="modern-card group overflow-hidden bg-surface"
            >
              <div className="relative h-44 overflow-hidden bg-surface-muted">
                <Image
                  src={service.image}
                  alt={service.alt}
                  fill
                  sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-linear-to-t from-brand-navy/44 to-transparent" />
                <div className="absolute left-4 top-4 grid size-11 place-items-center rounded-lg bg-white/90 text-brand-blue shadow-sm backdrop-blur dark:bg-brand-navy/80 dark:text-brand-sand">
                  <TravelIcon icon={service.icon} className="size-5" />
                </div>
              </div>
              <div className="flex min-h-[108px] items-end justify-between gap-4 p-4">
                <div>
                  <h3 className="text-lg font-extrabold text-brand-navy dark:text-white">
                    {service.title}
                  </h3>
                  {service.summary ? (
                    <p className="mt-2 text-sm leading-6 text-brand-blue/76 dark:text-brand-sky">
                      {service.summary}
                    </p>
                  ) : null}
                </div>
                <Link
                  href="/#contact"
                  aria-label={`Enquire about ${service.title}`}
                  className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-blue text-white transition hover:bg-brand-navy dark:bg-brand-sand dark:text-brand-navy"
                >
                  <ArrowRight aria-hidden="true" className="size-5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
