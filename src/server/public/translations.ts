import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { logServerError } from "@/server/http/response";
import {
  getSupabasePublicServerClient,
  hasSupabasePublicEnv,
} from "@/server/supabase/client";
import type {
  LocaleDirection,
  PublicLocale,
  PublicTranslationBundle,
} from "@/types/locale";

export const LOCALE_COOKIE_NAME = "flytime-locale";

type DbLocale = {
  code: string;
  name: string;
  direction: string;
  is_default: boolean;
};

type DbTranslation = {
  namespace: string;
  translation_key: string;
  value: string;
};

const FALLBACK_LOCALES: PublicLocale[] = [
  {
    code: "en",
    name: "English",
    direction: "ltr",
    isDefault: true,
  },
  {
    code: "ar",
    name: "Arabic",
    direction: "rtl",
    isDefault: false,
  },
];

const FALLBACK_MESSAGES: Record<string, Record<string, Record<string, string>>> =
  {
    en: {
      common: {
        "language.english": "English",
        "language.arabic": "Arabic",
        "nav.flight": "Flights",
        "nav.visaDesk": "Visa Desk",
        "nav.gulfVisa": "Gulf Visa",
        "nav.globalVisa": "Global Visa",
        "nav.passportServices": "Passport Services",
        "nav.documentAttestation": "Document Attestation",
        "nav.holidays": "Holidays",
        "nav.holidayPackages": "Holiday Packages",
        "nav.hotel": "Hotel",
        "nav.packages": "Packages",
        "nav.wellness": "Wellness",
        "nav.travelDesk": "Travel Desk",
        "nav.hajjUmrah": "Hajj & Umrah",
        "nav.visa": "Visa",
        "nav.more": "More",
        "nav.transfers": "Transfers",
        "nav.carRental": "Car Rental",
        "nav.insurance": "Insurance",
        "nav.assistService": "Assist Service",
        "nav.cruise": "Cruise",
        "nav.customizedPackages": "Customised Packages",
        "nav.eSim": "E-SIM",
        "nav.journal": "Journal",
        enquire: "Enquire",
      },
      search: {
        location: "Location",
        date: "Date",
        guests: "Guests",
        submit: "Search",
      },
      home: {
        "hero.title": "Journeys built around your time.",
        "hero.description":
          "Flights, stays, visas and holiday routes in one calm booking experience for families, groups and frequent travelers.",
        "hero.quickAccess": "Quick access",
        "hero.stat.destinations": "Destination lanes",
        "hero.stat.assistance": "Trip assistance",
        "hero.stat.booking": "Booking journey",
      },
    },
    ar: {
      common: {
        "language.english": "\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629",
        "language.arabic": "\u0627\u0644\u0639\u0631\u0628\u064a\u0629",
        "nav.flight": "\u0631\u062d\u0644\u0627\u062a \u0627\u0644\u0637\u064a\u0631\u0627\u0646",
        "nav.visaDesk": "\u0645\u0643\u062a\u0628 \u0627\u0644\u062a\u0623\u0634\u064a\u0631\u0627\u062a",
        "nav.gulfVisa": "\u062a\u0623\u0634\u064a\u0631\u0627\u062a \u0627\u0644\u062e\u0644\u064a\u062c",
        "nav.globalVisa": "\u062a\u0623\u0634\u064a\u0631\u0627\u062a \u0639\u0627\u0644\u0645\u064a\u0629",
        "nav.passportServices": "\u062e\u062f\u0645\u0627\u062a \u0627\u0644\u062c\u0648\u0627\u0632\u0627\u062a",
        "nav.documentAttestation": "\u062a\u0635\u062f\u064a\u0642 \u0627\u0644\u0648\u062b\u0627\u0626\u0642",
        "nav.holidays": "\u0627\u0644\u0639\u0637\u0644\u0627\u062a",
        "nav.holidayPackages": "\u0628\u0627\u0642\u0627\u062a \u0627\u0644\u0639\u0637\u0644\u0627\u062a",
        "nav.hotel": "\u0627\u0644\u0641\u0646\u0627\u062f\u0642",
        "nav.packages": "\u0627\u0644\u0628\u0627\u0642\u0627\u062a",
        "nav.wellness": "\u0627\u0644\u0639\u0627\u0641\u064a\u0629",
        "nav.travelDesk": "\u0645\u0643\u062a\u0628 \u0627\u0644\u0633\u0641\u0631",
        "nav.hajjUmrah": "\u0627\u0644\u062d\u062c \u0648\u0627\u0644\u0639\u0645\u0631\u0629",
        "nav.visa": "\u0627\u0644\u062a\u0623\u0634\u064a\u0631\u0627\u062a",
        "nav.more": "\u0627\u0644\u0645\u0632\u064a\u062f",
        "nav.transfers": "\u0627\u0644\u0646\u0642\u0644",
        "nav.carRental": "\u062a\u0623\u062c\u064a\u0631 \u0627\u0644\u0633\u064a\u0627\u0631\u0627\u062a",
        "nav.insurance": "\u0627\u0644\u062a\u0623\u0645\u064a\u0646",
        "nav.assistService": "\u062e\u062f\u0645\u0629 \u0627\u0644\u0645\u0633\u0627\u0639\u062f\u0629",
        "nav.cruise": "\u0627\u0644\u0631\u062d\u0644\u0627\u062a \u0627\u0644\u0628\u062d\u0631\u064a\u0629",
        "nav.customizedPackages": "\u0628\u0627\u0642\u0627\u062a \u0645\u062e\u0635\u0635\u0629",
        "nav.eSim": "\u0627\u0644\u0634\u0631\u064a\u062d\u0629 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a\u0629",
        "nav.journal": "\u0627\u0644\u0645\u062f\u0648\u0646\u0629",
        enquire: "\u0627\u0633\u062a\u0641\u0633\u0627\u0631",
      },
      search: {
        location: "\u0627\u0644\u0648\u062c\u0647\u0629",
        date: "\u0627\u0644\u062a\u0627\u0631\u064a\u062e",
        guests: "\u0627\u0644\u0645\u0633\u0627\u0641\u0631\u0648\u0646",
        submit: "\u0628\u062d\u062b",
      },
      home: {
        "hero.title": "\u0631\u062d\u0644\u0627\u062a \u0645\u0635\u0645\u0645\u0629 \u062d\u0648\u0644 \u0648\u0642\u062a\u0643.",
        "hero.description":
          "\u0631\u062d\u0644\u0627\u062a \u0627\u0644\u0637\u064a\u0631\u0627\u0646 \u0648\u0627\u0644\u0625\u0642\u0627\u0645\u0627\u062a \u0648\u0627\u0644\u062a\u0623\u0634\u064a\u0631\u0627\u062a \u0648\u0628\u0627\u0642\u0627\u062a \u0627\u0644\u0639\u0637\u0644\u0627\u062a \u0641\u064a \u062a\u062c\u0631\u0628\u0629 \u062d\u062c\u0632 \u0648\u0627\u0636\u062d\u0629.",
        "hero.quickAccess": "\u0648\u0635\u0648\u0644 \u0633\u0631\u064a\u0639",
        "hero.stat.destinations": "\u0645\u0633\u0627\u0631\u0627\u062a \u0627\u0644\u0648\u062c\u0647\u0627\u062a",
        "hero.stat.assistance": "\u0645\u0633\u0627\u0639\u062f\u0629 \u0627\u0644\u0631\u062d\u0644\u0629",
        "hero.stat.booking": "\u0631\u062d\u0644\u0629 \u062d\u062c\u0632 \u0645\u0646 4 \u062e\u0637\u0648\u0627\u062a",
      },
    },
  };

export const getPublicLocales = cache(async () => {
  const fromSupabase = await fetchLocalesFromSupabase();

  if (fromSupabase.length > 0) {
    return fromSupabase;
  }

  return FALLBACK_LOCALES;
});

export const getPublicTranslations = cache(
  async (
    localeCode: string,
    namespace?: string,
  ): Promise<PublicTranslationBundle> => {
    const locales = await getPublicLocales();
    const locale = resolveLocale(locales, localeCode);
    const safeNamespace = normalizeNamespace(namespace);
    const fromSupabase = await fetchTranslationsFromSupabase(
      locale.code,
      safeNamespace,
    );
    const fallbackMessages = filterFallbackMessages(
      locale.code,
      safeNamespace,
    );
    const messages = mergeTranslationMessages(fallbackMessages, fromSupabase);

    return {
      locale,
      namespaces: Object.keys(messages),
      messages,
    };
  },
);

export function resolvePublicLocale(
  locales: PublicLocale[],
  requestedCode?: string | null,
) {
  return resolveLocale(locales, requestedCode ?? "");
}

export async function getCurrentPublicLocale() {
  const [locales, cookieStore] = await Promise.all([
    getPublicLocales(),
    cookies(),
  ]);

  return resolvePublicLocale(
    locales,
    cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  );
}

export function readPublicMessage(
  bundle: PublicTranslationBundle,
  namespace: string,
  key: string,
  fallback: string,
) {
  return bundle.messages[namespace]?.[key] ?? fallback;
}

async function fetchLocalesFromSupabase(): Promise<PublicLocale[]> {
  if (!hasSupabasePublicEnv()) {
    return [];
  }

  try {
    const supabase = getSupabasePublicServerClient();
    const result = await supabase
      .from("locales")
      .select("code,name,direction,is_default")
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("code", { ascending: true });

    if (result.error) {
      throw result.error;
    }

    return ((result.data ?? []) as DbLocale[]).map(mapLocale);
  } catch (error) {
    logServerError("public.translations.locales", error);
    return [];
  }
}

async function fetchTranslationsFromSupabase(
  localeCode: string,
  namespace?: string,
) {
  if (!hasSupabasePublicEnv()) {
    return {};
  }

  try {
    const supabase = getSupabasePublicServerClient();
    let query = supabase
      .from("translations")
      .select("namespace,translation_key,value")
      .eq("locale_code", localeCode)
      .eq("status", "published")
      .order("namespace", { ascending: true })
      .order("translation_key", { ascending: true });

    if (namespace) {
      query = query.eq("namespace", namespace);
    }

    const result = await query;

    if (result.error) {
      throw result.error;
    }

    return mapTranslations((result.data ?? []) as DbTranslation[]);
  } catch (error) {
    logServerError("public.translations.messages", error);
    return {};
  }
}

function mapLocale(row: DbLocale): PublicLocale {
  return {
    code: normalizeLocaleCode(row.code),
    name: row.name,
    direction: normalizeDirection(row.direction),
    isDefault: Boolean(row.is_default),
  };
}

function mapTranslations(rows: DbTranslation[]) {
  const messages: Record<string, Record<string, string>> = {};

  rows.forEach((row) => {
    const namespace = normalizeNamespace(row.namespace);

    if (!namespace) {
      return;
    }

    messages[namespace] ??= {};
    messages[namespace][row.translation_key] = row.value;
  });

  return messages;
}

function resolveLocale(locales: PublicLocale[], requestedCode: string) {
  const safeCode = normalizeLocaleCode(requestedCode);
  const byRequest = locales.find((locale) => locale.code === safeCode);

  if (byRequest) {
    return byRequest;
  }

  return (
    locales.find((locale) => locale.isDefault) ??
    locales[0] ??
    FALLBACK_LOCALES[0]
  );
}

function filterFallbackMessages(localeCode: string, namespace?: string) {
  const source = FALLBACK_MESSAGES[localeCode] ?? FALLBACK_MESSAGES.en ?? {};

  if (!namespace) {
    return source;
  }

  return source[namespace] ? { [namespace]: source[namespace] } : {};
}

function mergeTranslationMessages(
  fallbackMessages: Record<string, Record<string, string>>,
  dbMessages: Record<string, Record<string, string>>,
) {
  const messages: Record<string, Record<string, string>> = {};
  const namespaces = new Set([
    ...Object.keys(fallbackMessages),
    ...Object.keys(dbMessages),
  ]);

  namespaces.forEach((namespace) => {
    messages[namespace] = {
      ...(fallbackMessages[namespace] ?? {}),
      ...(dbMessages[namespace] ?? {}),
    };
  });

  return messages;
}

function normalizeLocaleCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z-]/g, "")
    .slice(0, 12);
}

function normalizeNamespace(value?: string) {
  if (!value) {
    return undefined;
  }

  const namespace = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 80);

  return namespace || undefined;
}

function normalizeDirection(value: string): LocaleDirection {
  return value === "rtl" ? "rtl" : "ltr";
}
