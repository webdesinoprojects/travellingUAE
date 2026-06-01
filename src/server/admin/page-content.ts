import "server-only";

import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";
import type {
  AdminCmsPage,
  AdminCmsPageContent,
  AdminCmsPageStatus,
} from "@/types/cms";

type DbCmsPage = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  seo_title: string | null;
  seo_description: string | null;
  status: AdminCmsPageStatus;
  updated_at: string | null;
};

export async function getAdminCmsPageContent(): Promise<AdminCmsPageContent> {
  if (!hasSupabaseAdminEnv()) {
    return {
      source: "unconfigured",
      pages: [],
    };
  }

  const result = await getSupabaseAdminClient()
    .from("pages")
    .select(
      "id,slug,title,excerpt,body,seo_title,seo_description,status,updated_at",
    )
    .order("updated_at", { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return {
    source: "database",
    pages: ((result.data ?? []) as DbCmsPage[]).map(mapPage),
  };
}

function mapPage(row: DbCmsPage): AdminCmsPage {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    body: row.body,
    seoTitle: row.seo_title ?? "",
    seoDescription: row.seo_description ?? "",
    status: row.status,
    updatedAt: row.updated_at,
  };
}
