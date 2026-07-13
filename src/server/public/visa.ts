import "server-only";

import { logServerError } from "@/server/http/response";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/server/supabase/client";
import {
  getVisaPage as getStaticVisaPage,
  getVisaDestination as getStaticVisaDestination,
  type VisaDestination,
  type VisaPageContent,
} from "@/data/visa";
import {
  VISA_CATEGORY_TO_PAGE_SLUG,
  buildVisaPageFromDbRows,
  normalizeVisaDbRow,
  pageSlugToVisaCategory,
  visaRowSeo,
  type VisaCategory,
  type VisaDbRow,
} from "@/server/public/visa-normalize";

/**
 * Public visa content loader with DB-first, static-fallback behavior.
 *
 * When published rows exist in visa_destinations for the category, they are used
 * (normalized into the exact view shape). When there are none — or Supabase is
 * not configured, or a query fails — it falls back to the static src/data/visa.ts
 * content, so public routes never break before content is migrated.
 */

const ROW_COLUMNS =
  "id,category,slug,name,title,subtitle,hero_image_url,hero_image_alt,card_image_url,card_image_alt,starting_price,currency,processing_time,stay_period,validity,entry_type,is_featured,is_published,sort_order,visa_types,documents,process_steps,why_choose,faqs,process_image_url,process_image_alt,sample_visa_image_url,sample_visa_image_alt,seo_title,seo_description,metadata";

/**
 * Before the migration is applied the `visa_destinations` table does not exist;
 * that is an expected "no CMS yet" state, so the loader falls back to static
 * content silently instead of logging it as an error.
 */
function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown };
  if (e.code === "42P01" || e.code === "PGRST205") return true;
  return (
    typeof e.message === "string" &&
    (/does not exist/i.test(e.message) || /could not find the table/i.test(e.message))
  );
}

/** Resolve the listing page content for a page slug (global-visa | gulf-visa). */
export async function getVisaPageContent(pageSlug: string): Promise<VisaPageContent | null> {
  const staticPage = getStaticVisaPage(pageSlug);
  if (!staticPage) return null;

  const category = pageSlugToVisaCategory(pageSlug);
  if (!category || !hasSupabaseAdminEnv()) {
    return staticPage;
  }

  try {
    const rows = await readPublishedRows(category);
    if (rows.length === 0) {
      return staticPage; // no DB content yet -> static fallback
    }
    return buildVisaPageFromDbRows(rows, staticPage);
  } catch (error) {
    if (!isMissingTableError(error)) logServerError("public.visa.page", error);
    return staticPage;
  }
}

export type VisaDetailResult = {
  page: VisaPageContent;
  destination: VisaDestination;
  seo: { title: string; description: string };
};

/** Resolve a single destination detail for a page slug + destination slug. */
export async function getVisaDestinationDetail(
  pageSlug: string,
  visaSlug: string,
): Promise<VisaDetailResult | null> {
  const staticPage = getStaticVisaPage(pageSlug);
  if (!staticPage) return null;

  const category = pageSlugToVisaCategory(pageSlug);

  if (category && hasSupabaseAdminEnv()) {
    try {
      const row = await readPublishedRow(category, visaSlug);
      if (row) {
        return {
          page: staticPage,
          destination: normalizeVisaDbRow(row),
          seo: visaRowSeo(row),
        };
      }
    } catch (error) {
      if (!isMissingTableError(error)) logServerError("public.visa.detail", error);
      // fall through to static
    }
  }

  const staticResult = getStaticVisaDestination(pageSlug, visaSlug);
  if (!staticResult) return null;
  return {
    page: staticResult.page,
    destination: staticResult.destination,
    seo: {
      title: `${staticResult.destination.name} Visa | Fly Time`,
      description: staticResult.destination.overview[0],
    },
  };
}

/** Published slugs for a category (used to seed generateStaticParams alongside static). */
export async function getPublishedVisaSlugs(category: VisaCategory): Promise<string[]> {
  if (!hasSupabaseAdminEnv()) return [];
  try {
    const rows = await readPublishedRows(category);
    return rows.map((row) => row.slug).filter(Boolean);
  } catch (error) {
    if (!isMissingTableError(error)) logServerError("public.visa.slugs", error);
    return [];
  }
}

async function readPublishedRows(category: VisaCategory): Promise<VisaDbRow[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("visa_destinations")
    .select(ROW_COLUMNS)
    .eq("category", category)
    .eq("is_published", true)
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as VisaDbRow[];
}

async function readPublishedRow(
  category: VisaCategory,
  slug: string,
): Promise<VisaDbRow | null> {
  const trimmed = slug?.trim();
  if (!trimmed) return null;
  const { data, error } = await getSupabaseAdminClient()
    .from("visa_destinations")
    .select(ROW_COLUMNS)
    .eq("category", category)
    .eq("slug", trimmed)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as VisaDbRow | null) ?? null;
}

export { VISA_CATEGORY_TO_PAGE_SLUG };
