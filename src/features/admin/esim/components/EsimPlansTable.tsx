import { PackageOpen } from "lucide-react";

import type { AdminPlanItem } from "@/features/admin/esim/visibility-types";

import { EsimPlanRow } from "./EsimPlanRow";

export function EsimPlansTable({ items }: { items: AdminPlanItem[] }) {
  if (items.length === 0) {
    return (
      <div className="grid place-items-center gap-2 rounded-lg border border-dashed border-[#d7c5ad] bg-white/60 px-6 py-14 text-center dark:border-white/10 dark:bg-white/[0.04]">
        <PackageOpen aria-hidden="true" className="size-8 text-brand-brown" />
        <p className="text-sm font-bold text-brand-brown">
          No cached plans match these filters. Plans appear here once a country&apos;s plans have
          been fetched by the public flow.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3">
      {items.map((plan) => (
        <EsimPlanRow key={`${plan.countryCode}:${plan.planCode}`} plan={plan} />
      ))}
    </ul>
  );
}
