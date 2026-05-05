import Image from "next/image";
import { services } from "@/data/travel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TravelIcon } from "@/components/ui/TravelIcon";

export function ServicesStrip() {
  return (
    <section id="services" className="bg-background pt-16">
      <SectionHeading title="Services" />
      <div className="mt-8 grid grid-cols-1 gap-[3px] bg-background sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {services.map((service) => (
          <article
            key={service.title}
            className="relative min-h-[340px] overflow-hidden bg-slate-900 text-white"
          >
            <Image
              src={service.image}
              alt={service.alt}
              fill
              sizes="(min-width: 1280px) 17vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-linear-to-b from-slate-950/25 via-transparent to-slate-950/60" />
            <div className="absolute left-1/2 top-6 grid size-11 -translate-x-1/2 place-items-center rounded-lg bg-slate-900/35 backdrop-blur">
              <TravelIcon icon={service.icon} className="size-5" />
            </div>
            <div className="absolute inset-x-0 bottom-7 flex justify-center px-5">
              <a
                href="#contact"
                className="rounded-lg border border-white/40 bg-slate-950/45 px-5 py-3 text-sm font-bold backdrop-blur transition hover:bg-brand-blue"
              >
                {service.title}
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
