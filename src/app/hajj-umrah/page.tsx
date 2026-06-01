import { CheckCircle2, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { HajjUmrahEnquiryForm } from "@/components/hajj-umrah/HajjUmrahEnquiryForm";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata: Metadata = {
  title: "Hajj & Umrah Packages | Fly Time",
  description:
    "Plan Hajj and Umrah pilgrimages with Fly Time, including visa support, flights, hotels, departure city, traveler details and enquiry support.",
};

const benefits = [
  "Complete visa assistance and documentation support",
  "Affordable and flexible Hajj tour packages",
  "Trusted guidance from experienced travel experts",
  "Customized packages with flights and hotel stays",
  "24/7 customer support throughout your journey",
];

export default function HajjUmrahPage() {
  return (
    <>
      <main className="min-h-screen bg-background text-foreground">
        <section className="relative min-h-[420px] overflow-hidden sm:min-h-[500px] lg:min-h-[560px]">
          <Image
            src="https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&w=2400&q=86"
            alt="Pilgrims near the Kaaba in Makkah"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/25 via-brand-navy/10 to-brand-navy/68" />
          <div className="absolute inset-x-0 bottom-0 bg-black/28 py-8 backdrop-blur-[1px]">
            <div className="mx-auto w-full max-w-[1660px] px-4 text-center sm:px-6 lg:px-10">
              <h1 className="font-serif text-4xl font-semibold text-white sm:text-5xl lg:text-6xl">
                Hajj & Umrah
              </h1>
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-[1660px] gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_520px] lg:px-10 lg:py-12 xl:gap-16">
          <div className="min-w-0">
            <nav
              aria-label="Breadcrumb"
              className="mb-9 flex items-center gap-2 text-sm font-semibold text-foreground-muted"
            >
              <Link href="/" className="transition hover:text-brand-blue">
                Home
              </Link>
              <ChevronRight aria-hidden="true" className="size-4" />
              <span className="text-brand-blue">Hajj & Umrah</span>
            </nav>

            <article className="max-w-5xl">
              <h2 className="font-serif text-3xl font-semibold leading-tight text-brand-blue sm:text-4xl">
                Hajj & Umrah Packages from Kerala - Travel with India&apos;s
                Trusted Experts
              </h2>

              <div className="mt-6 grid gap-5 text-base font-medium leading-8 text-brand-navy/86 dark:text-white/78">
                <p>
                  Planning your sacred journey becomes effortless with Fly Time,
                  the trusted travel desk for seamless Hajj & Umrah experiences.
                </p>
                <p>
                  Whether you seek affordable Umrah packages or premium Umrah
                  packages with flights, we provide fully customized solutions
                  tailored to your needs. With reliable support and transparent
                  pricing, Fly Time helps keep the journey smooth and spiritually
                  fulfilling from start to finish.
                </p>
              </div>

              <div className="mt-7">
                <h3 className="text-lg font-extrabold text-brand-navy dark:text-white">
                  Key Benefits:
                </h3>
                <ul className="mt-4 grid gap-3 text-base font-semibold text-brand-navy/86 dark:text-white/78">
                  {benefits.map((benefit) => (
                    <li key={benefit} className="flex gap-3">
                      <CheckCircle2
                        aria-hidden="true"
                        className="mt-0.5 size-5 shrink-0 text-brand-blue dark:text-brand-sky"
                      />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-base font-semibold leading-8 text-brand-navy/86 dark:text-white/78">
                  Start your holy journey today. Share the travel details and the
                  Fly Time team will follow up with package guidance.
                </p>
              </div>
            </article>
          </div>

          <aside className="min-w-0 lg:pt-14">
            <div className="lg:sticky lg:top-28">
              <HajjUmrahEnquiryForm />
            </div>
          </aside>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
