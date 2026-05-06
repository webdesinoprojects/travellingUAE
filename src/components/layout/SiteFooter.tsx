import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import { footerColumns } from "@/data/travel";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { SocialBrandIcon } from "@/components/ui/SocialBrandIcon";

const footerSocials = [
  { label: "Facebook", tone: "facebook" as const },
  { label: "YouTube", tone: "youtube" as const },
  { label: "Instagram", tone: "instagram" as const },
  { label: "LinkedIn", tone: "linkedin" as const },
];

export function SiteFooter() {
  return (
    <footer
      id="contact"
      className="relative overflow-hidden bg-brand-navy text-white"
    >
      <div className="mx-auto w-full max-w-[1240px] px-4 py-14 sm:px-6 lg:px-0 lg:py-20">
        <div className="grid gap-5 rounded-lg border border-white/12 bg-white/[0.06] p-5 backdrop-blur sm:p-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-extrabold uppercase text-brand-sand">
              Fly Time updates
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight text-white">
              Boarding notes before the crowd.
            </h2>
          </div>
          <form className="flex flex-col gap-3 sm:flex-row" action="#">
            <label className="sr-only" htmlFor="newsletter-email">
              Email address
            </label>
            <input
              suppressHydrationWarning
              id="newsletter-email"
              type="email"
              placeholder="Enter email"
              className="min-h-12 flex-1 rounded-lg border border-white/20 bg-white px-4 text-brand-navy outline-none transition placeholder:text-brand-blue/50 focus:border-brand-sand focus:ring-3 focus:ring-brand-sand/30"
            />
            <button
              suppressHydrationWarning
              type="submit"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-sand px-5 text-sm font-extrabold text-brand-navy transition hover:bg-white"
            >
              Subscribe
              <ArrowRight aria-hidden="true" className="size-4" />
            </button>
          </form>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[1.25fr_0.7fr_1fr_0.85fr]">
          <div>
            <BrandLogo tone="light" />
            <p className="mt-6 max-w-xs text-sm font-medium leading-7 text-brand-sky">
              Fly Time connects flights, stays, visas and destination support
              into a booking flow that feels calm from enquiry to departure.
            </p>
            <div className="mt-7 flex gap-3">
              {footerSocials.map((item) => (
                <a
                  key={item.label}
                  href="#"
                  aria-label={item.label}
                  className="grid size-9 place-items-center rounded-lg border border-white/15 text-brand-sky transition hover:bg-white/10 hover:text-white"
                >
                  <SocialBrandIcon tone={item.tone} />
                </a>
              ))}
            </div>
          </div>

          <FooterColumn title={footerColumns[0].title} links={footerColumns[0].links} />

          <FooterColumn title={footerColumns[1].title} links={footerColumns[1].links} />

          <div>
            <h3 className="text-sm font-extrabold uppercase text-brand-sand">
              Contact Us
            </h3>
            <div className="mt-5 grid gap-4 text-sm font-medium leading-6 text-brand-sky">
              <p className="flex gap-3">
                <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0" />
                Head Office, BKM Hospital Bldg. Bypass Road, Payyanur, Kannur
              </p>
              <p className="flex gap-3">
                <Phone aria-hidden="true" className="mt-1 size-4 shrink-0" />
                +91 904 831 77 11
              </p>
              <p className="flex gap-3">
                <Mail aria-hidden="true" className="mt-1 size-4 shrink-0" />
                hello@flytime.example
              </p>
            </div>

            <div className="mt-9">
              <FooterColumn
                title={footerColumns[2].title}
                links={footerColumns[2].links}
              />
            </div>
          </div>
        </div>

        <p className="mt-14 border-t border-white/12 pt-6 text-sm font-semibold text-brand-sky">
          &copy; 2026 Fly Time. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-extrabold uppercase text-brand-sand">
        {title}
      </h3>
      <ul className="mt-5 grid gap-3 text-sm font-medium text-brand-sky">
        {links.map((link) => (
          <li key={link}>
            <a href="#" className="transition hover:text-white">
              {link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
