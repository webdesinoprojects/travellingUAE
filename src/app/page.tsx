import { Hero } from "@/components/home/Hero";
import { PackageBento } from "@/components/home/PackageBento";
import { ServicesStrip } from "@/components/home/ServicesStrip";
import { SmartExclusives } from "@/components/home/SmartExclusives";
import { Testimonials } from "@/components/home/Testimonials";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getPublicHomeContent } from "@/server/public/home";
import {
  getCurrentPublicLocale,
  getPublicTranslations,
  readPublicMessage,
} from "@/server/public/translations";
import type { SearchServiceKey } from "@/types/travel";

type HomeProps = {
  searchParams: Promise<{
    service?: string | string[];
  }>;
};

const serviceKeys = new Set<SearchServiceKey>([
  "flight",
  "hotel",
  "packages",
  "wellness",
  "hajj-umrah",
  "visa",
  "transfers",
  "car-rental",
  "insurance",
  "cruise",
  "customized-packages",
  "assist-service",
  "e-sim",
]);

const serviceLabelMessages: Record<
  SearchServiceKey,
  { key: string; fallback: string }
> = {
  flight: { key: "nav.flight", fallback: "Flights" },
  hotel: { key: "nav.hotel", fallback: "Hotel" },
  packages: { key: "nav.packages", fallback: "Packages" },
  wellness: { key: "nav.wellness", fallback: "Wellness" },
  "hajj-umrah": { key: "nav.hajjUmrah", fallback: "Hajj & Umrah" },
  visa: { key: "nav.visa", fallback: "Visa" },
  transfers: { key: "nav.transfers", fallback: "Transfers" },
  "car-rental": { key: "nav.carRental", fallback: "Car Rental" },
  insurance: { key: "nav.insurance", fallback: "Insurance" },
  cruise: { key: "nav.cruise", fallback: "Cruise" },
  "customized-packages": {
    key: "nav.customizedPackages",
    fallback: "Customised Packages",
  },
  "assist-service": {
    key: "nav.assistService",
    fallback: "Assist Service",
  },
  "e-sim": { key: "nav.eSim", fallback: "E-SIM" },
};

function getInitialService(service?: string | string[]): SearchServiceKey {
  const value = Array.isArray(service) ? service[0] : service;

  return serviceKeys.has(value as SearchServiceKey)
    ? (value as SearchServiceKey)
    : "packages";
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const [homeContent, currentLocale] = await Promise.all([
    getPublicHomeContent(),
    getCurrentPublicLocale(),
  ]);
  const [homeTranslations, commonTranslations] = await Promise.all([
    getPublicTranslations(currentLocale.code, "home"),
    getPublicTranslations(currentLocale.code, "common"),
  ]);
  const heroCopy = {
    title: readPublicMessage(
      homeTranslations,
      "home",
      "hero.title",
      "Journeys built around your time.",
    ),
    description: readPublicMessage(
      homeTranslations,
      "home",
      "hero.description",
      "Flights, stays, visas and holiday routes in one calm booking experience for families, groups and frequent travelers.",
    ),
    quickAccess: readPublicMessage(
      homeTranslations,
      "home",
      "hero.quickAccess",
      "Quick access",
    ),
    moreLabel: readPublicMessage(
      commonTranslations,
      "common",
      "nav.more",
      "More",
    ),
    serviceLabels: Object.fromEntries(
      Object.entries(serviceLabelMessages).map(([service, message]) => [
        service,
        readPublicMessage(
          commonTranslations,
          "common",
          message.key,
          message.fallback,
        ),
      ]),
    ) as Partial<Record<SearchServiceKey, string>>,
    stats: [
      {
        value: "18+",
        label: readPublicMessage(
          homeTranslations,
          "home",
          "hero.stat.destinations",
          "Destination lanes",
        ),
      },
      {
        value: "24/7",
        label: readPublicMessage(
          homeTranslations,
          "home",
          "hero.stat.assistance",
          "Trip assistance",
        ),
      },
      {
        value: "4-step",
        label: readPublicMessage(
          homeTranslations,
          "home",
          "hero.stat.booking",
          "Booking journey",
        ),
      },
    ],
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <main>
        <Hero
          copy={heroCopy}
          media={homeContent.hero}
          initialService={getInitialService(params.service)}
        />
        {homeContent.exclusives.length > 0 ? (
          <SmartExclusives
            items={homeContent.exclusives}
            section={homeContent.picksSection}
          />
        ) : null}
        {homeContent.bentoPackages.length > 0 ? (
          <PackageBento
            packages={homeContent.bentoPackages}
            section={homeContent.routesSection}
          />
        ) : null}
        {homeContent.services.length > 0 ? (
          <ServicesStrip services={homeContent.services} />
        ) : null}
        {homeContent.testimonials.length > 0 ? (
          <Testimonials testimonials={homeContent.testimonials} />
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
