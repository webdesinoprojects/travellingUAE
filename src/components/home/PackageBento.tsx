import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { PublicHomeSectionCopy } from "@/types/home";
import type { BentoPackage } from "@/types/travel";

type PackageBentoProps = {
  packages: BentoPackage[];
  section: PublicHomeSectionCopy;
};

export function PackageBento({ packages, section }: PackageBentoProps) {
  return (
    <section id="packages" className="bg-surface px-4 py-16 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1240px]">
        <SectionHeading
          eyebrow={section.eyebrow}
          title={section.title}
          description={section.description}
        />

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-[260px_260px]">
          {packages.map((pkg) => (
            <PackageCard key={pkg.title} pkg={pkg} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PackageCard({ pkg }: { pkg: BentoPackage }) {
  const href = pkg.href ?? "/trips";
  const layoutClass =
    pkg.size === "featured"
      ? "md:col-span-2 lg:row-span-2 min-h-[460px]"
      : pkg.size === "wide"
        ? "md:col-span-2 min-h-[260px]"
        : "min-h-[260px]";

  return (
    <article
      className={[
        "group modern-card relative overflow-hidden bg-brand-navy text-white transition hover:-translate-y-0.5",
        layoutClass,
      ].join(" ")}
    >
      <Link
        href={href}
        aria-label={`Explore ${pkg.title}`}
        className="absolute inset-0 z-30"
      />
      <Image
        src={pkg.image}
        alt={pkg.alt}
        fill
        sizes={
          pkg.size === "featured"
            ? "(min-width: 1024px) 600px, 100vw"
            : "(min-width: 1024px) 300px, 100vw"
        }
        className="object-cover transition duration-500 group-hover:scale-[1.04]"
      />
      <div className="absolute inset-0 bg-linear-to-t from-brand-navy/88 via-brand-navy/26 to-brand-navy/10" />

      <div className="absolute inset-x-0 bottom-0 z-20 p-4 sm:p-5">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-2 inline-flex rounded-lg border border-white/25 bg-white/12 px-3 py-1 text-xs font-extrabold uppercase text-brand-sand backdrop-blur">
              {pkg.duration}
            </p>
            <h3 className="font-serif text-3xl leading-none text-white">
              {pkg.title}
            </h3>
            <p className="mt-2 text-sm font-bold text-brand-sky">
              {pkg.price}
            </p>
          </div>
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-sand text-brand-navy transition group-hover:bg-white">
            <ArrowUpRight aria-hidden="true" className="size-5" />
          </span>
        </div>
      </div>
    </article>
  );
}
