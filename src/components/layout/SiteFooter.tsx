import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { SocialBrandIcon } from "@/components/ui/SocialBrandIcon";
import { getPublicFooterColumns, getPublicFooterSettings } from "@/server/public/cms";
import type { FooterColumn as FooterColumnData } from "@/types/travel";

export async function SiteFooter() {
  const [footerColumns, footerSettings] = await Promise.all([
    getPublicFooterColumns(),
    getPublicFooterSettings(),
  ]);
  const companyColumn = footerColumns[0] ?? { title: "Company", links: [] };
  const travelColumn = footerColumns[1] ?? { title: "Travel Desk", links: [] };
  const legalColumn = footerColumns[2] ?? { title: "Legal", links: [] };
  const { contact, newsletter, socialLinks } = footerSettings;
  const visibleSocialLinks = socialLinks.filter((l) => l.href.startsWith("https://"));

  return (
    <footer
      id="contact"
      className="relative overflow-hidden bg-brand-navy text-white"
    >
      <div className="mx-auto w-full max-w-[1240px] px-4 py-14 sm:px-6 lg:px-0 lg:py-20">
        <div className="grid gap-5 rounded-lg border border-white/12 bg-white/[0.06] p-5 backdrop-blur sm:p-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-extrabold uppercase text-brand-sand">
              {newsletter.description}
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight text-white">
              {newsletter.title}
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
              placeholder={newsletter.placeholder}
              className="min-h-12 flex-1 rounded-lg border border-white/20 bg-white px-4 text-brand-navy outline-none transition placeholder:text-brand-blue/50 focus:border-brand-sand focus:ring-3 focus:ring-brand-sand/30"
            />
            <button
              suppressHydrationWarning
              type="submit"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-sand px-5 text-sm font-extrabold text-brand-navy transition hover:bg-white"
            >
              {newsletter.buttonLabel}
              <ArrowRight aria-hidden="true" className="size-4" />
            </button>
          </form>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[1.25fr_0.7fr_1fr_0.85fr]">
          <div>
            <BrandLogo tone="light" />
            {contact.tagline ? (
              <p className="mt-6 max-w-xs text-sm font-medium leading-7 text-brand-sky">
                {contact.tagline}
              </p>
            ) : null}
            {visibleSocialLinks.length > 0 ? (
              <div className="mt-7 flex gap-3">
                {visibleSocialLinks.map((item) => (
                  <a
                    key={item.platform}
                    href={item.href}
                    aria-label={item.label}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid size-9 place-items-center rounded-lg border border-white/15 text-brand-sky transition hover:bg-white/10 hover:text-white"
                  >
                    <SocialBrandIcon tone={item.platform} />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <FooterColumnBlock column={companyColumn} />

          <FooterColumnBlock column={travelColumn} />

          <div>
            <h3 className="text-sm font-extrabold uppercase text-brand-sand">
              Contact Us
            </h3>
            <div className="mt-5 grid gap-4 text-sm font-medium leading-6 text-brand-sky">
              {contact.address ? (
                <p className="flex gap-3">
                  <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0" />
                  {contact.address}
                </p>
              ) : null}
              {contact.phone ? (
                <p className="flex gap-3">
                  <Phone aria-hidden="true" className="mt-1 size-4 shrink-0" />
                  {contact.phone}
                </p>
              ) : null}
              {contact.email ? (
                <p className="flex gap-3">
                  <Mail aria-hidden="true" className="mt-1 size-4 shrink-0" />
                  {contact.email}
                </p>
              ) : null}
            </div>

            <div className="mt-9">
              <FooterColumnBlock column={legalColumn} />
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

function FooterColumnBlock({ column }: { column: FooterColumnData }) {
  return (
    <div>
      <h3 className="text-sm font-extrabold uppercase text-brand-sand">
        {column.title}
      </h3>
      <ul className="mt-5 grid gap-3 text-sm font-medium text-brand-sky">
        {column.links.map((link) => (
          <li key={`${column.title}-${link.href}-${link.label}`}>
            <Link href={link.href} className="transition hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
