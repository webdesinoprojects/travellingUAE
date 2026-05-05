import { ArrowRight } from "lucide-react";
import { footerColumns } from "@/data/travel";
import { BrandLogo } from "@/components/ui/BrandLogo";

export function SiteFooter() {
  return (
    <footer
      id="contact"
      className="relative overflow-hidden bg-[#06274b] text-white dark:bg-black"
    >
      <div className="mx-auto w-full max-w-[1600px] px-4 py-14 sm:px-6 lg:px-12 lg:py-20">
        <div className="soft-card-shadow grid gap-6 rounded-lg bg-[#0b4382] p-5 sm:p-8 lg:grid-cols-[1fr_1.05fr] lg:items-center">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">
              Stay Updated, Travel Smart
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-sky-100 sm:text-base">
              Get exclusive travel deals, visa alerts, and holiday package
              updates straight to your inbox.
            </p>
          </div>
          <form className="flex flex-col gap-3 sm:flex-row" action="#">
            <label className="sr-only" htmlFor="newsletter-email">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              placeholder="Enter Email"
              className="min-h-12 flex-1 rounded-lg border border-white/20 bg-white px-4 text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-brand-yellow focus:ring-3 focus:ring-brand-yellow/30"
            />
            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-bold text-brand-blue transition hover:bg-brand-yellow hover:text-slate-950"
            >
              Subscribe Now
              <ArrowRight aria-hidden="true" className="size-4" />
            </button>
          </form>
        </div>

        <div className="mt-16 grid gap-10 lg:grid-cols-[1.3fr_0.7fr_0.95fr_0.6fr]">
          <div>
            <BrandLogo tone="light" />
            <div className="mt-7 h-px w-20 bg-white/40" />
            <p className="mt-5 max-w-xs text-base font-semibold leading-7 text-white">
              Discover the world with Smart Travel. Experts in holiday
              packages, flight bookings, visa assistance and more.
            </p>
            <div className="mt-7 flex gap-4 text-lg font-bold">
              {["f", "YT", "ig", "in"].map((item) => (
                <a
                  key={item}
                  href="#"
                  className="grid size-8 place-items-center rounded-md transition hover:bg-white/10"
                >
                  {item}
                </a>
              ))}
            </div>
          </div>

          <FooterColumn title={footerColumns[0].title} links={footerColumns[0].links} />

          <div>
            <FooterColumn
              title={footerColumns[1].title}
              links={footerColumns[1].links}
            />
          </div>

          <div>
            <div>
              <h3 className="text-sm font-bold uppercase">Contact Us</h3>
              <div className="mt-5 space-y-3 text-sm font-semibold leading-6">
                <p>Smart Travel LLC</p>
                <p>
                  Head Office (India)
                  <br />
                  BKM Hospital Bldg. Bypass Road,
                  <br />
                  Payyanur, Kannur
                </p>
                <p>+91 904 831 77 11</p>
                <div className="h-px bg-white/25" />
                <p>
                  Regional Office
                  <br />
                  Atlantis Junction, Opposite Naxose Express, MG Road, Kochi
                </p>
                <p>+91 963 318 88 76</p>
              </div>
            </div>

            <div className="mt-9">
              <FooterColumn
                title={footerColumns[2].title}
                links={footerColumns[2].links}
              />
            </div>
          </div>
        </div>

        <p className="mt-16 text-sm font-semibold text-white">
          &copy; 2026 Smarttravels.com All rights reserved
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-bold uppercase">{title}</h3>
      <ul className="mt-5 grid gap-3 text-sm font-semibold">
        {links.map((link) => (
          <li key={link}>
            <a href="#" className="transition hover:text-brand-yellow">
              {link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
