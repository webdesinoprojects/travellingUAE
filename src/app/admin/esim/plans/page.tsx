import { requireAdminPageAccess } from "@/server/admin/access";
import { hasSupabaseAdminEnv } from "@/server/supabase/client";
import { listAdminPlans } from "@/server/admin/esim-plans";
import { normalizePlanAdminQuery } from "@/server/admin/esim-visibility-helpers";
import { EsimAdminTabs } from "@/features/admin/esim/components/EsimAdminTabs";
import { EsimPlansTable } from "@/features/admin/esim/components/EsimPlansTable";
import { EsimVisibilityPagination } from "@/features/admin/esim/components/EsimVisibilityPagination";
import { EsimVisibilityToolbar } from "@/features/admin/esim/components/EsimVisibilityToolbar";

export const dynamic = "force-dynamic";

export default async function AdminEsimPlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPageAccess("admin");

  const resolvedSearchParams = await searchParams;
  const query = normalizePlanAdminQuery({
    filter: resolvedSearchParams.filter,
    country: resolvedSearchParams.country,
    q: resolvedSearchParams.q,
    page: resolvedSearchParams.page,
  });

  return (
    <div className="grid gap-5">
      <Heading />
      <EsimAdminTabs />

      {hasSupabaseAdminEnv() ? (
        <PlansContent query={query} />
      ) : (
        <NotConfigured />
      )}
    </div>
  );
}

async function PlansContent({
  query,
}: {
  query: ReturnType<typeof normalizePlanAdminQuery>;
}) {
  const result = await listAdminPlans(query);

  const paginationParams: Record<string, string> = {};
  if (query.filter !== "all") paginationParams.filter = query.filter;
  if (query.countryCode !== "all") paginationParams.country = query.countryCode;
  if (query.search) paginationParams.q = query.search;

  return (
    <>
      <EsimVisibilityToolbar
        basePath="/admin/esim/plans"
        filter={query.filter}
        search={query.search}
        searchPlaceholder="Search plan name, code or country"
        country={query.countryCode}
        countryOptions={result.countries}
      />
      <p className="text-xs font-bold text-brand-brown">
        {result.total} plan{result.total === 1 ? "" : "s"}
      </p>
      <EsimPlansTable items={result.items} />
      <EsimVisibilityPagination
        basePath="/admin/esim/plans"
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        params={paginationParams}
      />
    </>
  );
}

function Heading() {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">Connectivity</p>
      <h1 className="font-serif text-2xl font-black tracking-tight">eSIM plans</h1>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="rounded-lg border border-[#d7c5ad] bg-white/78 p-8 text-center dark:border-white/10 dark:bg-white/[0.06]">
      <p className="text-sm font-bold text-brand-brown">
        Database is not configured. eSIM plans are unavailable.
      </p>
    </div>
  );
}
