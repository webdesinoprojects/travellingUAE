import "server-only";

import { writeAdminAuditLog } from "@/server/admin/audit";
import { requireTrustedPublicMediaUrl } from "@/server/cms/hero";
import {
  FALLBACK_HAJJ_UMRAH_CONTENT,
  HAJJ_UMRAH_PAGE_SECTION_KEY,
  mapHajjUmrahPayload,
} from "@/server/public/hajj-umrah";
import { isRecord, readJsonObject, readString } from "@/server/http/validation";
import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";
import type { AdminActor } from "@/server/supabase/auth";
import type {
  AdminHajjUmrahPageContent,
  HajjUmrahPageContent,
} from "@/types/hajj-umrah";

type DbSiteSection = {
  id: string;
  payload: Record<string, unknown> | null;
  updated_at: string | null;
};

export async function getAdminHajjUmrahPageContent(): Promise<AdminHajjUmrahPageContent> {
  if (!hasSupabaseAdminEnv()) {
    return {
      ...FALLBACK_HAJJ_UMRAH_CONTENT,
      source: "unconfigured",
      updatedAt: null,
    };
  }

  const result = await getSupabaseAdminClient()
    .from("site_sections")
    .select("id,payload,updated_at")
    .eq("key", HAJJ_UMRAH_PAGE_SECTION_KEY)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  const row = (result.data ?? null) as DbSiteSection | null;

  if (!row) {
    return {
      ...FALLBACK_HAJJ_UMRAH_CONTENT,
      source: "fallback",
      updatedAt: null,
    };
  }

  return {
    ...mapHajjUmrahPayload(row.payload),
    source: "database",
    updatedAt: row.updated_at,
  };
}

export async function saveAdminHajjUmrahPageContent(
  request: Request,
  actor: AdminActor,
): Promise<AdminHajjUmrahPageContent> {
  if (!hasSupabaseAdminEnv()) {
    throw new Error("Admin database is not configured");
  }

  const body = await readJsonObject(request);
  const payload = buildPayload(body);
  const supabase = getSupabaseAdminClient();
  const beforeResult = await supabase
    .from("site_sections")
    .select("id,payload,updated_at")
    .eq("key", HAJJ_UMRAH_PAGE_SECTION_KEY)
    .maybeSingle();

  if (beforeResult.error) {
    throw beforeResult.error;
  }

  const before = (beforeResult.data ?? null) as DbSiteSection | null;
  const result = await supabase
    .from("site_sections")
    .upsert(
      {
        key: HAJJ_UMRAH_PAGE_SECTION_KEY,
        title: "Hajj & Umrah Page",
        eyebrow: "Pilgrimage desk",
        description: "Structured public Hajj & Umrah page content.",
        payload,
        status: "published",
      },
      { onConflict: "key" },
    )
    .select("id,payload,updated_at")
    .single();

  if (result.error) {
    throw result.error;
  }

  const saved = result.data as DbSiteSection;

  await writeAdminAuditLog({
    actor,
    action: "hajj_umrah.page.update",
    table: "site_sections",
    entityId: saved.id,
    before: before ? safeAuditValue(before.payload) : null,
    after: safeAuditValue(saved.payload),
  });

  return {
    ...mapHajjUmrahPayload(saved.payload),
    source: "database",
    updatedAt: saved.updated_at,
  };
}

function buildPayload(body: Record<string, unknown>): HajjUmrahPageContent {
  const heroImages = readHeroImages(body.heroImages);
  const primaryImage = heroImages[0];
  const contentMarkdown = readString(body, "contentMarkdown", {
    min: 4,
    max: 12000,
    required: true,
  })!;

  validateMarkdownImages(contentMarkdown);

  return {
    heroImageUrl: primaryImage.url,
    heroImageAlt: primaryImage.alt,
    heroImages,
    heroTitle: readString(body, "heroTitle", {
      min: 2,
      max: 120,
      required: true,
    })!,
    breadcrumbLabel:
      readString(body, "breadcrumbLabel", { min: 2, max: 80 }) ??
      FALLBACK_HAJJ_UMRAH_CONTENT.breadcrumbLabel,
    pageHeading: readString(body, "pageHeading", {
      min: 4,
      max: 220,
      required: true,
    })!,
    contentMarkdown,
    introParagraphs: readParagraphs(body.introParagraphs, {
      minItems: 1,
      maxItems: 8,
      maxLength: 800,
      label: "Intro paragraphs",
    }),
    benefits: readParagraphs(body.benefits, {
      minItems: 1,
      maxItems: 20,
      maxLength: 180,
      label: "Benefits",
    }),
    closingCtaText: readString(body, "closingCtaText", {
      min: 4,
      max: 500,
      required: true,
    })!,
    formTitle: readString(body, "formTitle", {
      min: 2,
      max: 80,
      required: true,
    })!,
    formIntro: readString(body, "formIntro", {
      min: 2,
      max: 220,
      required: true,
    })!,
    seoTitle: readString(body, "seoTitle", {
      min: 4,
      max: 180,
      required: true,
    })!,
    seoDescription: readString(body, "seoDescription", {
      min: 10,
      max: 320,
      required: true,
    })!,
  };
}

function validateMarkdownImages(markdown: string) {
  const imagePattern = /!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/g;

  for (const match of markdown.matchAll(imagePattern)) {
    const url = match[1];

    if (!url) {
      continue;
    }

    requireTrustedPublicMediaUrl(url);
  }
}

function readHeroImages(value: unknown) {
  const sourceImages = Array.isArray(value) ? value : [];
  const images = sourceImages
    .filter(isHeroImageInput)
    .map((item) => ({
      url: item.url.trim(),
      alt: item.alt.trim(),
    }))
    .filter((item) => item.url && item.alt)
    .slice(0, 3);

  if (images.length === 0) {
    throw new Error("At least one hero image is required");
  }

  for (const image of images) {
    requireTrustedPublicMediaUrl(image.url);

    if (image.alt.length < 4 || image.alt.length > 240) {
      throw new Error("Hero image alt text is invalid");
    }
  }

  return images;
}

function isHeroImageInput(
  value: unknown,
): value is { url: string; alt: string } {
  return (
    isRecord(value) &&
    typeof value.url === "string" &&
    typeof value.alt === "string"
  );
}

function readParagraphs(
  value: unknown,
  {
    label,
    maxItems,
    maxLength,
    minItems,
  }: {
    label: string;
    maxItems: number;
    maxLength: number;
    minItems: number;
  },
) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be a list`);
  }

  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);

  if (items.length < minItems) {
    throw new Error(`${label} is required`);
  }

  for (const item of items) {
    if (item.length > maxLength) {
      throw new Error(`${label} has an entry that is too long`);
    }
  }

  return items;
}

function safeAuditValue(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  return mapHajjUmrahPayload(payload);
}
