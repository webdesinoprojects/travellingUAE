import Image from "next/image";
import { heroTabs } from "@/data/travel";
import { getTripDestinations } from "@/data/trips";
import { HeroSearch } from "@/components/home/HeroSearch";
import { TravelIcon } from "@/components/ui/TravelIcon";

export async function Hero() {
  const destinations = await getTripDestinations();
  const destinationOptions = destinations.map(({ slug, name }) => ({
    slug,
    name,
  }));

  return (
    <section className="relative min-h-[760px] overflow-hidden bg-brand-navy text-white">
      <Image
        src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=2200&q=86"
        alt="Road trip through a warm desert mountain route"
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

      <div className="relative z-10 mx-auto flex min-h-[760px] w-full max-w-[1240px] flex-col justify-end px-4 pb-10 pt-32 sm:px-6 lg:px-4">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-end">
          <div className="max-w-4xl">
            
            <h1 className="mt-6 max-w-5xl font-serif text-[3.25rem] font-semibold leading-[0.98] text-white drop-shadow-sm sm:text-[4.8rem] lg:text-[5.7rem]">
              Journeys built around your time.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/82 sm:text-xl">
              Flights, stays, visas and holiday routes in one calm booking
              experience for families, groups and frequent travelers.
            </p>

            <HeroSearch destinations={destinationOptions} />
          </div>

          <div className="glass-panel rounded-lg p-4">
            <p className="text-sm font-bold uppercase text-white/72">
              Quick access
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {heroTabs.map((tab) => (
                <a
                  key={tab.label}
                  href="#packages"
                  className="flex min-h-16 items-center gap-3 rounded-lg bg-white/12 px-4 text-sm font-bold text-white transition hover:bg-brand-sand/20"
                >
                  <TravelIcon icon={tab.icon} className="size-5" />
                  {tab.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-3 border-t border-white/18 pt-5 text-white/86 sm:grid-cols-3">
          <Stat value="18+" label="Destination lanes" />
          <Stat value="24/7" label="Trip assistance" />
          <Stat value="4-step" label="Booking journey" />
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
