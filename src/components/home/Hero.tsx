import Image from "next/image";
import { heroTabs } from "@/data/travel";
import { TravelIcon } from "@/components/ui/TravelIcon";

export function Hero() {
  return (
    <section className="relative bg-sky-100 dark:bg-black">
      <div className="relative h-[520px] overflow-hidden sm:h-[30.46vw] sm:min-h-[430px]">
        <Image
          src="/assets/hero/summer-holiday.png"
          alt="Make this summer your best holiday travel hero"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="hero-mask absolute inset-0" aria-hidden="true" />

        <div className="absolute inset-x-0 bottom-7 z-10 mx-auto w-full max-w-6xl px-4 sm:bottom-8 sm:px-6 lg:px-8">
          <div className="soft-card-shadow overflow-x-auto rounded-lg border border-slate-950/10 bg-white/96 p-3 backdrop-blur dark:border-white/10 dark:bg-black/92">
            <div className="no-scrollbar flex min-w-max gap-3 overflow-x-auto px-1 py-2 sm:justify-center">
              {heroTabs.map((tab) => (
                <a
                  key={tab.label}
                  href="#packages"
                  className="inline-flex h-12 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-base font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:border-brand-sky hover:text-brand-blue dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                >
                  <TravelIcon icon={tab.icon} className="size-5" />
                  {tab.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
