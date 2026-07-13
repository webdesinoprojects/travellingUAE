import { requireAdminPageAccess } from "@/server/admin/access";
import { listVisaDestinations } from "@/server/admin/visa-cms";
import { VisaDestinationsTable } from "@/features/admin/visa/components/VisaDestinationsTable";

export const dynamic = "force-dynamic";

export default async function AdminGlobalVisaPage() {
  await requireAdminPageAccess("editor");
  const items = await listVisaDestinations("global");

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">Visa CMS</p>
        <h1 className="font-serif text-2xl font-black tracking-tight">Global visa destinations</h1>
        <p className="mt-1 text-sm font-semibold text-brand-brown">
          Published rows drive <span className="font-mono">/global-visa</span>. With none, the static
          fallback is used.
        </p>
      </div>
      <VisaDestinationsTable category="global" items={items} />
    </div>
  );
}
