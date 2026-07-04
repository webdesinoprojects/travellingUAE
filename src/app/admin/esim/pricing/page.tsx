import { requireAdminPageAccess } from "@/server/admin/access";
import { EsimAdminTabs } from "@/features/admin/esim/components/EsimAdminTabs";
import { EsimPricingDashboard } from "@/features/admin/esim/components/EsimPricingDashboard";
import { getAdminPricingPageModel } from "@/server/esim/pricing-rules";
import { hasSupabaseAdminEnv } from "@/server/supabase/client";

export const dynamic = "force-dynamic";

export default async function AdminEsimPricingPage() {
  await requireAdminPageAccess("admin");

  return (
    <div className="grid gap-5">
      <Heading />
      <EsimAdminTabs />

      {hasSupabaseAdminEnv() ? <PricingContent /> : <NotConfigured />}
    </div>
  );
}

async function PricingContent() {
  const model = await getAdminPricingPageModel();
  return <EsimPricingDashboard model={model} />;
}

function Heading() {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">Connectivity</p>
      <h1 className="font-serif text-2xl font-black tracking-tight">eSIM pricing</h1>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="rounded-lg border border-[#d7c5ad] bg-white/78 p-8 text-center dark:border-white/10 dark:bg-white/[0.06]">
      <p className="text-sm font-bold text-brand-brown">
        Database is not configured. eSIM pricing is unavailable.
      </p>
    </div>
  );
}
