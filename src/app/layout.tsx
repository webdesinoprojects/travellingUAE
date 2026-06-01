import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import { cookies } from "next/headers";
import { AppChrome } from "@/components/layout/AppChrome";
import { getPublicHeaderNavigation } from "@/server/public/cms";
import {
  getPublicLocales,
  getPublicTranslations,
  LOCALE_COOKIE_NAME,
  readPublicMessage,
  resolvePublicLocale,
} from "@/server/public/translations";
import type { PublicTranslationBundle } from "@/types/locale";
import type { NavItem } from "@/types/travel";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fly Time | Flights, Holidays and Visa Support",
  description:
    "Fly Time helps travelers book flights, holiday packages, visas, hotels and support services through a clean modern travel experience.",
};

const navTranslationKeys: Record<string, string> = {
  Flights: "nav.flight",
  Flight: "nav.flight",
  "Visa Desk": "nav.visaDesk",
  "Gulf Visa": "nav.gulfVisa",
  "Global Visa": "nav.globalVisa",
  "Passport Services": "nav.passportServices",
  "Document Attestation": "nav.documentAttestation",
  Holidays: "nav.holidays",
  "Holiday Packages": "nav.holidayPackages",
  Hotel: "nav.hotel",
  Packages: "nav.packages",
  Wellness: "nav.wellness",
  "Travel Desk": "nav.travelDesk",
  "Hajj & Umrah": "nav.hajjUmrah",
  Visa: "nav.visa",
  More: "nav.more",
  Transfers: "nav.transfers",
  "Car Rental": "nav.carRental",
  Insurance: "nav.insurance",
  "Assist Service": "nav.assistService",
  Cruise: "nav.cruise",
  "Customised Packages": "nav.customizedPackages",
  "E-SIM": "nav.eSim",
  Journal: "nav.journal",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [navItems, locales] = await Promise.all([
    getPublicHeaderNavigation(),
    getPublicLocales(),
  ]);
  const cookieStore = await cookies();
  const currentLocale = resolvePublicLocale(
    locales,
    cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  );
  const commonTranslations = await getPublicTranslations(
    currentLocale.code,
    "common",
  );
  const localizedNavItems = localizeNavigation(navItems, commonTranslations);
  const headerCopy = {
    enquire: readPublicMessage(
      commonTranslations,
      "common",
      "enquire",
      "Enquire",
    ),
  };

  return (
    <html
      lang={currentLocale.code}
      dir={currentLocale.direction}
      suppressHydrationWarning
      className={`${manrope.variable} ${sora.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <AppChrome
          currentLocale={currentLocale}
          navItems={localizedNavItems}
          locales={locales}
          headerCopy={headerCopy}
        >
          {children}
        </AppChrome>
      </body>
    </html>
  );
}

function localizeNavigation(
  items: NavItem[],
  translations: PublicTranslationBundle,
): NavItem[] {
  return items.map((item) => ({
    ...item,
    label: localizeNavLabel(item.label, translations),
    children: item.children
      ? localizeNavigation(item.children, translations)
      : undefined,
  }));
}

function localizeNavLabel(
  label: string,
  translations: PublicTranslationBundle,
) {
  const key = navTranslationKeys[label];

  if (!key) {
    return label;
  }

  return readPublicMessage(translations, "common", key, label);
}
