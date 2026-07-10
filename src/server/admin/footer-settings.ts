import "server-only";

import { writeAdminAuditLog } from "@/server/admin/audit";
import {
  isRecord,
  readJsonObject,
  readString,
  type UnknownRecord,
} from "@/server/http/validation";
import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";
import type { AdminActor } from "@/server/supabase/auth";
import type {
  AdminFooterSettings,
  PublicFooterContact,
  PublicFooterNewsletter,
  PublicFooterSocialLink,
  SocialPlatform,
} from "@/types/footer";

const FOOTER_SECTION_KEY = "home.footer";

const SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
  "facebook",
  "youtube",
  "instagram",
  "linkedin",
];

export const FALLBACK_FOOTER_SETTINGS: AdminFooterSettings = {
  source: "fallback",
  status: "draft",
  contact: {
    tagline:
      "Fly Time connects flights, stays, visas and destination support into a booking flow that feels calm from enquiry to departure.",
    address: "Head Office, BKM Hospital Bldg. Bypass Road, Payyanur, Kannur",
    phone: "+91 904 831 77 11",
    email: "hello@flytime.example",
  },
  socialLinks: [
    { platform: "facebook", label: "Facebook", href: "#" },
    { platform: "youtube", label: "YouTube", href: "#" },
    { platform: "instagram", label: "Instagram", href: "#" },
    { platform: "linkedin", label: "LinkedIn", href: "#" },
  ],
  newsletter: {
    title: "Boarding notes before the crowd.",
    description: "Fly Time updates",
    placeholder: "Enter email",
    buttonLabel: "Subscribe",
  },
};

type DbFooterRow = {
  id: string;
  payload: Record<string, unknown> | null;
  status: "draft" | "published" | "archived";
  updated_at: string | null;
};

export async function getAdminFooterSettings(): Promise<AdminFooterSettings> {
  if (!hasSupabaseAdminEnv()) {
    return FALLBACK_FOOTER_SETTINGS;
  }

  const result = await getSupabaseAdminClient()
    .from("site_sections")
    .select("id,payload,status,updated_at")
    .eq("key", FOOTER_SECTION_KEY)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  const row = (result.data ?? null) as DbFooterRow | null;

  if (!row) {
    return { ...FALLBACK_FOOTER_SETTINGS, source: "database" };
  }

  return mapAdminFooter(row);
}

export async function saveAdminFooterSettings(
  request: Request,
  actor: AdminActor,
): Promise<AdminFooterSettings> {
  if (!hasSupabaseAdminEnv()) {
    throw new Error("Admin database is not configured");
  }

  const body = await readJsonObject(request);
  const contact = buildContactPayload(body);
  const socialLinks = buildSocialLinksPayload(body);
  const newsletter = buildNewsletterPayload(body);
  const statusRaw = readString(body, "status", { max: 20 });
  const status: "draft" | "published" | "archived" =
    statusRaw === "published" || statusRaw === "archived" ? statusRaw : "draft";

  if (status === "published" && !contact.email) {
    throw new Error("A contact email is required to publish footer settings.");
  }

  const payload = { contact, socialLinks, newsletter };
  const supabase = getSupabaseAdminClient();

  const existing = await supabase
    .from("site_sections")
    .select("id,payload,status,updated_at")
    .eq("key", FOOTER_SECTION_KEY)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  let row: DbFooterRow;

  if (existing.data) {
    const updated = await supabase
      .from("site_sections")
      .update({ payload, status })
      .eq("key", FOOTER_SECTION_KEY)
      .select("id,payload,status,updated_at")
      .single();

    if (updated.error) {
      throw updated.error;
    }

    row = updated.data as DbFooterRow;
  } else {
    const inserted = await supabase
      .from("site_sections")
      .insert({
        key: FOOTER_SECTION_KEY,
        title: "Footer Settings",
        payload,
        status,
      })
      .select("id,payload,status,updated_at")
      .single();

    if (inserted.error) {
      throw inserted.error;
    }

    row = inserted.data as DbFooterRow;
  }

  await writeAdminAuditLog({
    actor,
    action: "home.footer.update",
    table: "site_sections",
    entityId: row.id,
    before: null,
    after: { key: FOOTER_SECTION_KEY, status },
  });

  return mapAdminFooter(row);
}

function buildContactPayload(body: UnknownRecord): PublicFooterContact {
  return {
    tagline: readString(body, "tagline", { max: 400 }) ?? "",
    address: readString(body, "address", { max: 300 }) ?? "",
    phone: readString(body, "phone", { max: 40 }) ?? "",
    email: readString(body, "email", { max: 120 }) ?? "",
  };
}

function buildSocialLinksPayload(body: UnknownRecord): PublicFooterSocialLink[] {
  const raw = body.socialLinks;

  if (!Array.isArray(raw)) {
    return FALLBACK_FOOTER_SETTINGS.socialLinks;
  }

  const links: PublicFooterSocialLink[] = [];

  for (const item of raw) {
    if (!isRecord(item)) {
      continue;
    }

    const platform = readString(item as UnknownRecord, "platform", { max: 20 });
    const label = readString(item as UnknownRecord, "label", { max: 60 });
    const href = readString(item as UnknownRecord, "href", { max: 300 });

    if (!platform || !SOCIAL_PLATFORMS.includes(platform as SocialPlatform)) {
      continue;
    }

    if (href && href !== "#" && !href.startsWith("https://")) {
      throw new Error(`Social link href for ${platform} must be # or start with https://`);
    }

    links.push({
      platform: platform as SocialPlatform,
      label: label || platform,
      href: href || "#",
    });
  }

  return links;
}

function buildNewsletterPayload(body: UnknownRecord): PublicFooterNewsletter {
  return {
    title:
      readString(body, "newsletterTitle", { min: 2, max: 140 }) ??
      FALLBACK_FOOTER_SETTINGS.newsletter.title,
    description:
      readString(body, "newsletterDescription", { min: 2, max: 140 }) ??
      FALLBACK_FOOTER_SETTINGS.newsletter.description,
    placeholder:
      readString(body, "newsletterPlaceholder", { min: 2, max: 80 }) ??
      FALLBACK_FOOTER_SETTINGS.newsletter.placeholder,
    buttonLabel:
      readString(body, "newsletterButtonLabel", { min: 2, max: 40 }) ??
      FALLBACK_FOOTER_SETTINGS.newsletter.buttonLabel,
  };
}

function mapAdminFooter(row: DbFooterRow): AdminFooterSettings {
  const payload = isRecord(row.payload) ? row.payload : null;
  const contactRaw = payload && isRecord(payload.contact) ? payload.contact : null;
  const linksRaw = payload && Array.isArray(payload.socialLinks) ? payload.socialLinks : null;
  const newsletterRaw =
    payload && isRecord(payload.newsletter) ? payload.newsletter : null;

  return {
    id: row.id,
    status: row.status,
    updatedAt: row.updated_at ?? undefined,
    source: "database",
    contact: {
      tagline:
        typeof contactRaw?.tagline === "string"
          ? contactRaw.tagline
          : FALLBACK_FOOTER_SETTINGS.contact.tagline,
      address:
        typeof contactRaw?.address === "string"
          ? contactRaw.address
          : FALLBACK_FOOTER_SETTINGS.contact.address,
      phone:
        typeof contactRaw?.phone === "string"
          ? contactRaw.phone
          : FALLBACK_FOOTER_SETTINGS.contact.phone,
      email:
        typeof contactRaw?.email === "string"
          ? contactRaw.email
          : FALLBACK_FOOTER_SETTINGS.contact.email,
    },
    socialLinks: linksRaw
      ? linksRaw
          .filter(
            (item): item is Record<string, unknown> =>
              isRecord(item) &&
              SOCIAL_PLATFORMS.includes(item.platform as SocialPlatform),
          )
          .map((item) => ({
            platform: item.platform as SocialPlatform,
            label:
              typeof item.label === "string"
                ? item.label
                : (item.platform as string),
            href: typeof item.href === "string" ? item.href : "#",
          }))
      : FALLBACK_FOOTER_SETTINGS.socialLinks,
    newsletter: {
      title:
        typeof newsletterRaw?.title === "string"
          ? newsletterRaw.title
          : FALLBACK_FOOTER_SETTINGS.newsletter.title,
      description:
        typeof newsletterRaw?.description === "string"
          ? newsletterRaw.description
          : FALLBACK_FOOTER_SETTINGS.newsletter.description,
      placeholder:
        typeof newsletterRaw?.placeholder === "string"
          ? newsletterRaw.placeholder
          : FALLBACK_FOOTER_SETTINGS.newsletter.placeholder,
      buttonLabel:
        typeof newsletterRaw?.buttonLabel === "string"
          ? newsletterRaw.buttonLabel
          : FALLBACK_FOOTER_SETTINGS.newsletter.buttonLabel,
    },
  };
}
