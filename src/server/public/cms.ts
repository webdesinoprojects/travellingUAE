import "server-only";

import { cache } from "react";

import {
  footerColumns as fallbackFooterColumns,
  navItems as fallbackNavItems,
} from "@/data/travel";
import { logServerError } from "@/server/http/response";
import {
  getSupabasePublicServerClient,
  hasSupabasePublicEnv,
} from "@/server/supabase/client";
import type { PublicCmsPage } from "@/types/cms";
import type {
  PublicFooterNewsletter,
  PublicFooterSettings,
  PublicFooterSocialLink,
  SocialPlatform,
} from "@/types/footer";
import type { NavItem } from "@/types/travel";

type DbPage = {
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  seo_title: string | null;
  seo_description: string | null;
  updated_at: string | null;
};

type DbFooterColumn = {
  id: string;
  title: string;
  sort_order: number;
};

type DbFooterLink = {
  column_id: string;
  label: string;
  href: string;
  sort_order: number;
};

type DbNavigationItem = {
  id: string;
  parent_id: string | null;
  label: string;
  href: string;
  has_dropdown: boolean;
  sort_order: number;
};

const fallbackPages: PublicCmsPage[] = [
  {
    slug: "about",
    title: "About Fly Time",
    excerpt:
      "A travel desk built for clear routes, practical support, and simple booking handoffs.",
    body:
      "Fly Time helps travelers plan flights, holidays, visas, stays, and local transport through one coordinated travel desk.\n\nThe current website is being prepared for backend-managed inventory, provider-backed search, and admin-managed content. Until live supplier keys are connected, service requests are handled as enquiries and routed through the Fly Time operations workflow.\n\nOur focus is to keep package information readable, pricing clear, and support steps visible before a traveler commits.",
    seoTitle: "About Fly Time",
    seoDescription:
      "Learn how Fly Time handles flights, holidays, visas, stays, and travel support.",
    updatedAt: null,
  },
  {
    slug: "contact",
    title: "Contact Fly Time",
    excerpt:
      "Send trip, visa, hotel, flight, transfer, or support questions to the travel desk.",
    body:
      "For package enquiries, flight support, hotel stays, visas, transport, insurance, and custom routes, share the travel details through the enquiry form or contact the Fly Time team directly.\n\nDo not send passport scans, payment screenshots, or sensitive traveler documents until a verified Fly Time team member asks for them through an approved channel.",
    seoTitle: "Contact Fly Time",
    seoDescription:
      "Contact Fly Time for travel enquiries, visa support, holiday routes, and hotel or flight help.",
    updatedAt: null,
  },
  {
    slug: "terms",
    title: "Terms And Conditions",
    excerpt:
      "General booking, enquiry, pricing, availability, and service terms for Fly Time customers.",
    body:
      "All package, hotel, flight, transfer, visa, and activity information shown on the website is subject to availability and final confirmation by Fly Time or the relevant supplier.\n\nPrices may change until a booking is confirmed. Provider rates, taxes, cancellation conditions, and availability can change during search, recheck, or booking confirmation.\n\nCustomers are responsible for sharing accurate traveler names, passport details, travel dates, nationality, residency, and contact information when requested. Fly Time may reject incomplete or inconsistent booking details.\n\nVisa approval, airline acceptance, hotel check-in, and border entry decisions are controlled by the relevant authorities or suppliers, not by Fly Time.",
    seoTitle: "Fly Time Terms And Conditions",
    seoDescription:
      "Read Fly Time terms for enquiries, prices, availability, bookings, and supplier-controlled services.",
    updatedAt: null,
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    excerpt:
      "How Fly Time handles enquiry, booking, contact, and travel support information.",
    body:
      "Fly Time collects only the information needed to respond to enquiries, prepare quotes, process bookings, and support travel services.\n\nCustomer details are handled through server-side APIs and admin-only workflows. Sensitive API keys, supplier credentials, and internal booking notes are not exposed through public website code.\n\nTraveler documents and payment details should only be shared through verified channels. The website should not be used to publish or expose confidential booking data.",
    seoTitle: "Fly Time Privacy Policy",
    seoDescription:
      "Learn how Fly Time handles enquiry, booking, and travel support information.",
    updatedAt: null,
  },
  {
    slug: "refund-policy",
    title: "Refund And Cancellation Policy",
    excerpt:
      "Cancellation and refund handling depends on each confirmed supplier rule.",
    body:
      "Refund and cancellation eligibility depends on the confirmed flight, hotel, transfer, visa, activity, or package supplier rules.\n\nSome services may be non-refundable after confirmation. Others may allow cancellation with fees or before a defined deadline.\n\nFinal cancellation conditions should be checked during the quote, recheck, and booking confirmation steps before payment is collected.",
    seoTitle: "Fly Time Refund And Cancellation Policy",
    seoDescription:
      "Understand how Fly Time handles refund and cancellation conditions.",
    updatedAt: null,
  },
  {
    slug: "passport-services",
    title: "Passport Services",
    excerpt:
      "Support for passport-related travel desk enquiries and documentation guidance.",
    body:
      "Fly Time can help route passport service enquiries to the correct travel desk workflow.\n\nCustomers should confirm the required service, traveler nationality, current passport status, expected travel date, and urgency before submitting documents.",
    seoTitle: "Fly Time Passport Services",
    seoDescription:
      "Passport-related travel support and documentation enquiry guidance.",
    updatedAt: null,
  },
  {
    slug: "document-attestation",
    title: "Document Attestation",
    excerpt:
      "Document attestation enquiry support for travel and administrative needs.",
    body:
      "Fly Time can receive document attestation enquiries and route them to the relevant support workflow.\n\nRequirements vary by document type, issuing country, destination country, and intended use. Final document handling should be confirmed before originals or sensitive scans are shared.",
    seoTitle: "Fly Time Document Attestation",
    seoDescription:
      "Document attestation enquiry support for travel and administrative requirements.",
    updatedAt: null,
  },
  {
    slug: "journal",
    title: "Fly Time Journal",
    excerpt:
      "Travel desk notes, route updates, visa reminders, and destination planning guidance.",
    body:
      "The Fly Time journal is prepared for route notes, visa reminders, service updates, and practical travel planning guidance.\n\nEditors can replace this baseline page through the CMS once the publishing calendar is ready.",
    seoTitle: "Fly Time Journal",
    seoDescription:
      "Travel desk notes, route updates, visa reminders, and destination planning guidance from Fly Time.",
    updatedAt: null,
  },
];

const fallbackPageBySlug = new Map(
  fallbackPages.map((page) => [page.slug, page]),
);

export const getPublicCmsPage = cache(async (slug: string) => {
  const normalizedSlug = normalizeSlug(slug);
  const fromSupabase = await fetchPageFromSupabase(normalizedSlug);

  if (fromSupabase) {
    return fromSupabase;
  }

  if (hasSupabasePublicEnv()) {
    return null;
  }

  return fallbackPageBySlug.get(normalizedSlug) ?? null;
});

export const getPublicFooterColumns = cache(async () => {
  const fromSupabase = await fetchFooterFromSupabase();

  if (hasSupabasePublicEnv()) {
    return fromSupabase ?? [];
  }

  return fallbackFooterColumns;
});

export const getPublicHeaderNavigation = cache(async () => {
  const fromSupabase = await fetchNavigationFromSupabase("header");

  if (fromSupabase?.length) {
    return fromSupabase;
  }

  return fallbackNavItems;
});

async function fetchPageFromSupabase(slug: string) {
  if (!hasSupabasePublicEnv()) {
    return null;
  }

  try {
    const supabase = getSupabasePublicServerClient();
    const result = await supabase
      .from("pages")
      .select("slug,title,excerpt,body,seo_title,seo_description,updated_at")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      return null;
    }

    return mapPage(result.data as DbPage);
  } catch (error) {
    logServerError("public.cms.page", error);
    return null;
  }
}

async function fetchFooterFromSupabase() {
  if (!hasSupabasePublicEnv()) {
    return null;
  }

  try {
    const supabase = getSupabasePublicServerClient();
    const [columnsResult, linksResult] = await Promise.all([
      supabase
        .from("footer_columns")
        .select("id,title,sort_order")
        .eq("status", "published")
        .order("sort_order", { ascending: true }),
      supabase
        .from("footer_links")
        .select("column_id,label,href,sort_order")
        .eq("status", "published")
        .order("sort_order", { ascending: true }),
    ]);

    if (columnsResult.error) {
      throw columnsResult.error;
    }

    if (linksResult.error) {
      throw linksResult.error;
    }

    const columns = (columnsResult.data ?? []) as DbFooterColumn[];
    const links = (linksResult.data ?? []) as DbFooterLink[];
    const linksByColumn = new Map<string, DbFooterLink[]>();

    links.forEach((link) => {
      const current = linksByColumn.get(link.column_id) ?? [];
      current.push(link);
      linksByColumn.set(link.column_id, current);
    });

    return columns.map((column) => ({
      title: column.title,
      links: (linksByColumn.get(column.id) ?? []).map((link) => ({
        label: link.label,
        href: link.href,
      })),
    }));
  } catch (error) {
    logServerError("public.cms.footer", error);
    return null;
  }
}

async function fetchNavigationFromSupabase(location: "header" | "footer") {
  if (!hasSupabasePublicEnv()) {
    return null;
  }

  try {
    const supabase = getSupabasePublicServerClient();
    const result = await supabase
      .from("navigation_items")
      .select("id,parent_id,label,href,has_dropdown,sort_order")
      .eq("location", location)
      .eq("status", "published")
      .order("sort_order", { ascending: true });

    if (result.error) {
      throw result.error;
    }

    return mapNavigationRows((result.data ?? []) as DbNavigationItem[]);
  } catch (error) {
    logServerError("public.cms.navigation", error);
    return null;
  }
}

function mapPage(row: DbPage): PublicCmsPage {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    updatedAt: row.updated_at,
  };
}

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase();
}

const FOOTER_SECTION_KEY = "home.footer";

const FALLBACK_FOOTER_NEWSLETTER: PublicFooterNewsletter = {
  title: "Boarding notes before the crowd.",
  description: "Fly Time updates",
  placeholder: "Enter email",
  buttonLabel: "Subscribe",
};

const DEV_FALLBACK_FOOTER_SETTINGS: PublicFooterSettings = {
  contact: {
    tagline:
      "Fly Time connects flights, stays, visas and destination support into a booking flow that feels calm from enquiry to departure.",
    address: "Head Office, BKM Hospital Bldg. Bypass Road, Payyanur, Kannur",
    phone: "+91 904 831 77 11",
    email: "hello@flytime.example",
  },
  socialLinks: [],
  newsletter: FALLBACK_FOOTER_NEWSLETTER,
};

const EMPTY_FOOTER_SETTINGS: PublicFooterSettings = {
  contact: { tagline: "", address: "", phone: "", email: "" },
  socialLinks: [],
  newsletter: FALLBACK_FOOTER_NEWSLETTER,
};

type DbSiteSectionPayload = {
  payload: Record<string, unknown> | null;
};

export const getPublicFooterSettings = cache(async (): Promise<PublicFooterSettings> => {
  if (!hasSupabasePublicEnv()) {
    return DEV_FALLBACK_FOOTER_SETTINGS;
  }

  try {
    const supabase = getSupabasePublicServerClient();
    const result = await supabase
      .from("site_sections")
      .select("payload")
      .eq("key", FOOTER_SECTION_KEY)
      .eq("status", "published")
      .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    const row = (result.data ?? null) as DbSiteSectionPayload | null;

    if (!row?.payload) {
      return EMPTY_FOOTER_SETTINGS;
    }

    return mapFooterPayload(row.payload);
  } catch (error) {
    logServerError("public.cms.footer-settings", error);
    return EMPTY_FOOTER_SETTINGS;
  }
});

function mapFooterPayload(payload: Record<string, unknown>): PublicFooterSettings {
  const contactRaw =
    payload.contact && typeof payload.contact === "object" && !Array.isArray(payload.contact)
      ? (payload.contact as Record<string, unknown>)
      : null;

  const contact: PublicFooterSettings["contact"] = {
    tagline: typeof contactRaw?.tagline === "string" ? contactRaw.tagline : "",
    address: typeof contactRaw?.address === "string" ? contactRaw.address : "",
    phone: typeof contactRaw?.phone === "string" ? contactRaw.phone : "",
    email: typeof contactRaw?.email === "string" ? contactRaw.email : "",
  };

  const validPlatforms: SocialPlatform[] = ["facebook", "youtube", "instagram", "linkedin"];
  const linksRaw = Array.isArray(payload.socialLinks) ? payload.socialLinks : null;
  const socialLinks: PublicFooterSocialLink[] = linksRaw
    ? linksRaw
        .filter(
          (item): item is Record<string, unknown> =>
            typeof item === "object" &&
            item !== null &&
            !Array.isArray(item) &&
            validPlatforms.includes(item.platform as SocialPlatform) &&
            typeof item.href === "string" &&
            item.href.startsWith("https://"),
        )
        .map((item) => ({
          platform: item.platform as SocialPlatform,
          label: typeof item.label === "string" ? item.label : (item.platform as string),
          href: item.href as string,
        }))
    : [];

  const newsletterRaw =
    payload.newsletter &&
    typeof payload.newsletter === "object" &&
    !Array.isArray(payload.newsletter)
      ? (payload.newsletter as Record<string, unknown>)
      : null;
  const newsletter: PublicFooterNewsletter = {
    title: readFooterText(newsletterRaw?.title, FALLBACK_FOOTER_NEWSLETTER.title),
    description: readFooterText(
      newsletterRaw?.description,
      FALLBACK_FOOTER_NEWSLETTER.description,
    ),
    placeholder: readFooterText(
      newsletterRaw?.placeholder,
      FALLBACK_FOOTER_NEWSLETTER.placeholder,
    ),
    buttonLabel: readFooterText(
      newsletterRaw?.buttonLabel,
      FALLBACK_FOOTER_NEWSLETTER.buttonLabel,
    ),
  };

  return { contact, socialLinks, newsletter };
}

function readFooterText(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function mapNavigationRows(rows: DbNavigationItem[]): NavItem[] {
  const childrenByParent = new Map<string, DbNavigationItem[]>();

  rows.forEach((row) => {
    if (!row.parent_id) {
      return;
    }

    const current = childrenByParent.get(row.parent_id) ?? [];
    current.push(row);
    childrenByParent.set(row.parent_id, current);
  });

  return rows
    .filter((row) => !row.parent_id)
    .map((row) => {
      const children = (childrenByParent.get(row.id) ?? []).map((child) => ({
        label: child.label,
        href: child.href,
        hasDropdown: child.has_dropdown,
      }));

      return {
        label: row.label,
        href: row.href,
        hasDropdown: row.has_dropdown || children.length > 0,
        children: children.length > 0 ? children : undefined,
      };
    });
}
