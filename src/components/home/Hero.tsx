import Image from "next/image";
import Link from "next/link";
import { primarySearchServices } from "@/data/travel";
import { getTripDestinations } from "@/data/trips";
import { HeroSearch } from "@/components/home/HeroSearch";
import { TravelIcon } from "@/components/ui/TravelIcon";
import type { PublicHeroMedia } from "@/types/home";
import type { SearchServiceKey } from "@/types/travel";

type HeroProps = {
  copy: {
    title: string;
    description: string;
    quickAccess: string;
    stats: Array<{
      value: string;
      label: string;
    }>;
    serviceLabels: Partial<Record<SearchServiceKey, string>>;
    moreLabel: string;
  };
  media: PublicHeroMedia;
  initialService: SearchServiceKey;
};

export async function Hero({ copy, media, initialService }: HeroProps) {
  const destinations = await getTripDestinations();
  const destinationOptions = destinations.map(({ slug, name }) => ({
    slug,
    name,
  }));

  return (
    <section className="relative min-h-[760px] bg-brand-navy text-white">
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src={media.backgroundImage}
          alt={media.backgroundAlt}
          fill
          preload
          sizes="100vw"
          className="object-cover"
        />
        <div className="hero-mask absolute inset-0" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-44 bg-linear-to-t from-background to-transparent"
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[760px] w-full max-w-[1240px] flex-col justify-end px-4 pb-10 pt-32 sm:px-6 lg:px-4">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-end">
          <div className="max-w-4xl">
            <h1 className="mt-6 max-w-5xl font-serif text-[3.25rem] font-semibold leading-[0.98] text-white drop-shadow-sm sm:text-[4.8rem] lg:text-[5.7rem]">
              {copy.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/82 sm:text-xl">
              {copy.description}
            </p>

            <HeroSearch
              key={initialService}
              destinations={destinationOptions}
              initialService={initialService}
              moreLabel={copy.moreLabel}
              serviceLabels={copy.serviceLabels}
            />
          </div>

          <div className="glass-panel rounded-lg p-4">
            <p className="text-sm font-bold uppercase text-white/72">
              {copy.quickAccess}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {primarySearchServices.map((tab) => (
                <Link
                  key={tab.service}
                  href={`/?service=${tab.service}#travel-search`}
                  className="flex min-h-16 items-center gap-3 rounded-lg bg-white/12 px-4 text-sm font-bold text-white transition hover:bg-brand-sand/20"
                >
                  <TravelIcon icon={tab.icon} className="size-5" />
                  {copy.serviceLabels[tab.service] ?? tab.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-3 border-t border-white/18 pt-5 text-white/86 sm:grid-cols-3">
          {copy.stats.map((stat) => (
            <Stat key={stat.label} value={stat.value} label={stat.label} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-serif text-4xl leading-none text-white">{value}</p>
      <p className="mt-1 text-sm font-semibold uppercase text-white/65">
        {label}
      </p>
    </div>
  );
}
