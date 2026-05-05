import Image from "next/image";
import { bentoPackages } from "@/data/travel";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function PackageBento() {
  return (
    <section id="packages" className="bg-surface px-4 py-14 sm:px-6 lg:px-12">
      <div className="mx-auto max-w-[1500px]">
        <SectionHeading
          title="International Travel Packages"
          description="Check out our carefully curated packages that bring you closer to the most popular destinations on your wish list."
        />

        <div className="mt-8 grid gap-4 lg:grid-cols-4 lg:grid-rows-[280px_280px]">
          {bentoPackages.map((pkg) => (
            <PackageCard key={pkg.title} pkg={pkg} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PackageCard({ pkg }: { pkg: (typeof bentoPackages)[number] }) {
  const layoutClass =
    pkg.size === "featured"
      ? "lg:col-span-2 lg:row-span-2 min-h-[520px]"
      : pkg.size === "wide"
        ? "lg:col-span-2 min-h-[280px]"
        : "min-h-[280px]";

  return (
    <article
      className={[
        "group relative overflow-hidden rounded-lg bg-slate-900 text-white",
        layoutClass,
      ].join(" ")}
    >
      <Image
        src={pkg.image}
        alt={pkg.alt}
        fill
        sizes={
          pkg.size === "featured"
            ? "(min-width: 1024px) 740px, 100vw"
            : "(min-width: 1024px) 360px, 100vw"
        }
        className="object-cover transition duration-500 group-hover:scale-[1.03]"
      />
      <div className="absolute inset-0 bg-linear-to-b from-slate-950/70 via-slate-950/20 to-slate-950/55" />

      <div
        aria-hidden="true"
        className="absolute bottom-0 right-0 z-10 h-[58px] w-[160px] rounded-tl-[18px] bg-surface"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-[50px] right-0 z-10 size-4 rounded-br-[12px] shadow-[5px_5px_0_5px_var(--surface)]"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-0 right-[152px] z-10 size-4 rounded-br-[12px] shadow-[5px_5px_0_5px_var(--surface)]"
      />

      <div className="absolute inset-x-0 top-0 z-20 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold sm:text-3xl">{pkg.title}</h3>
            <p className="mt-2 text-lg font-semibold sm:text-xl">
              {pkg.price}
            </p>
          </div>
          <div className="shrink-0 rounded-lg bg-white/18 px-4 py-1.5 text-sm font-bold backdrop-blur">
            {pkg.duration}
          </div>
        </div>
      </div>

      <div className="absolute bottom-2 right-2 z-20">
        <a
          href="#contact"
          className="inline-flex h-10 items-center rounded-lg bg-brand-blue px-5 text-sm font-bold text-white shadow-lg shadow-slate-950/20 transition hover:bg-brand-blue-strong"
        >
          Explore now
        </a>
      </div>
    </article>
  );
}
