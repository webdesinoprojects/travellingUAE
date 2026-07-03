import { requireAdminPageAccess } from "@/server/admin/access";
import { hasSupabaseAdminEnv } from "@/server/supabase/client";
import {
  getEsimOrderStats,
  listEsimOrders,
} from "@/server/admin/esim-orders";
import { normalizeEsimListQuery } from "@/server/admin/esim-orders-helpers";
import { EsimOrderStats } from "@/features/admin/esim/components/EsimOrderStats";
import { EsimOrdersPagination } from "@/features/admin/esim/components/EsimOrdersPagination";
import { EsimOrdersTable } from "@/features/admin/esim/components/EsimOrdersTable";
import { EsimOrdersToolbar } from "@/features/admin/esim/components/EsimOrdersToolbar";

export const dynamic = "force-dynamic";

export default async function AdminEsimOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPageAccess("admin");

  const resolvedSearchParams = await searchParams;
  const query = normalizeEsimListQuery({
    status: resolvedSearchParams.status,
    q: resolvedSearchParams.q,
    page: resolvedSearchParams.page,
  });

  if (!hasSupabaseAdminEnv()) {
    return (
      <div className="grid gap-5">
        <PageHeading />
        <NotConfigured />
      </div>
    );
  }

  const [result, stats] = await Promise.all([listEsimOrders(query), getEsimOrderStats()]);

  return (
    <div className="grid gap-5">
      <PageHeading />
      <EsimOrderStats stats={stats} />
      <EsimOrdersToolbar status={query.status} search={query.search} />
      <EsimOrdersTable items={result.items} />
      <EsimOrdersPagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        status={query.status}
        search={query.search}
      />
    </div>
  );
}

function PageHeading() {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">Connectivity</p>
      <h1 className="font-serif text-2xl font-black tracking-tight">eSIM orders</h1>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="rounded-lg border border-[#d7c5ad] bg-white/78 p-8 text-center dark:border-white/10 dark:bg-white/[0.06]">
      <p className="text-sm font-bold text-brand-brown">
        Database is not configured. eSIM orders are unavailable.
      </p>
    </div>
  );
}
