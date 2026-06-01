import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAdminPageAccess } from "@/server/admin/access";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/server/supabase/client";
import { CategoryEditor } from "@/features/admin/components/CategoryEditor";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  await requireAdminPageAccess("editor");

  if (!UUID_RE.test(id)) {
    notFound();
  }

  if (!hasSupabaseAdminEnv()) {
    return (
      <div className="grid gap-5">
        <BackLink />
        <div className="rounded-lg border border-[#d7c5ad] bg-white/78 p-8 text-center dark:border-white/10 dark:bg-white/[0.06]">
          <p className="text-sm font-bold text-brand-brown">
            Database is not configured.
          </p>
        </div>
      </div>
    );
  }

  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from("categories")
    .select("id,name,slug,description,sort_order,status")
    .eq("id", id)
    .single();

  if (result.error || !result.data) {
    notFound();
  }

  const row = result.data;
  const initial = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    sortOrder: row.sort_order ?? 0,
    status: row.status,
  };

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <BackLink />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">
            Inventory
          </p>
          <h1 className="font-serif text-2xl font-black tracking-tight">
            {row.name}
          </h1>
        </div>
      </div>

      <CategoryEditor initial={initial} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/categories"
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border-soft bg-white text-brand-navy dark:bg-white/10 dark:text-white"
      aria-label="Back to categories"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
    </Link>
  );
}
