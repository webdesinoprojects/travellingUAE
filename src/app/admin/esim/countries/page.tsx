import { requireAdminPageAccess } from "@/server/admin/access";
import { hasSupabaseAdminEnv } from "@/server/supabase/client";
import { listAdminCountries } from "@/server/admin/esim-countries";
import { normalizeCountryAdminQuery } from "@/server/admin/esim-visibility-helpers";
import { EsimAdminTabs } from "@/features/admin/esim/components/EsimAdminTabs";
import { EsimCountriesTable } from "@/features/admin/esim/components/EsimCountriesTable";
import { EsimVisibilityPagination } from "@/features/admin/esim/components/EsimVisibilityPagination";
import { EsimVisibilityToolbar } from "@/features/admin/esim/components/EsimVisibilityToolbar";

export const dynamic = "force-dynamic";

export default async function AdminEsimCountriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPageAccess("admin");

  const resolvedSearchParams = await searchParams;
  const query = normalizeCountryAdminQuery({
    filter: resolvedSearchParams.filter,
    q: resolvedSearchParams.q,
    page: resolvedSearchParams.page,
  });

  return (
    <div className="grid gap-5">
      <Heading />
      <EsimAdminTabs />

      {hasSupabaseAdminEnv() ? (
        <CountriesContent query={query} />
      ) : (
        <NotConfigured />
      )}
    </div>
  );
}

async function CountriesContent({
  query,
}: {
  query: ReturnType<typeof normalizeCountryAdminQuery>;
}) {
  const result = await listAdminCountries(query);
  const isFiltered = query.filter !== "all" || query.search !== "";

  const paginationParams: Record<string, string> = {};
  if (query.filter !== "all") paginationParams.filter = query.filter;
  if (query.search) paginationParams.q = query.search;

  return (
    <>
      <EsimVisibilityToolbar
        basePath="/admin/esim/countries"
        filter={query.filter}
        search={query.search}
        searchPlaceholder="Search name, ISO or display name"
      />
      <p className="text-xs font-bold text-brand-brown">
        {result.total} countr{result.total === 1 ? "y" : "ies"}
      </p>
      <EsimCountriesTable items={result.items} isFiltered={isFiltered} />
      <EsimVisibilityPagination
        basePath="/admin/esim/countries"
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        params={paginationParams}
        unit="country"
        unitPlural="countries"
      />
    </>
  );
}

function Heading() {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">Connectivity</p>
      <h1 className="font-serif text-2xl font-black tracking-tight">eSIM countries</h1>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="rounded-lg border border-[#d7c5ad] bg-white/78 p-8 text-center dark:border-white/10 dark:bg-white/[0.06]">
      <p className="text-sm font-bold text-brand-brown">
        Database is not configured. eSIM countries are unavailable.
      </p>
    </div>
  );
}
