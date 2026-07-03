import { Globe2 } from "lucide-react";

import type { AdminCountryItem } from "@/features/admin/esim/visibility-types";

import { EsimCountryRow } from "./EsimCountryRow";

export function EsimCountriesTable({
  items,
  isFiltered = false,
}: {
  items: AdminCountryItem[];
  isFiltered?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="grid place-items-center gap-2 rounded-lg border border-dashed border-[#d7c5ad] bg-white/60 px-6 py-14 text-center dark:border-white/10 dark:bg-white/[0.04]">
        <Globe2 aria-hidden="true" className="size-8 text-brand-brown" />
        <p className="text-sm font-bold text-brand-brown">
          {isFiltered
            ? "No matching eSIM countries found."
            : "No eSIM countries are synced yet."}
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3">
      {items.map((country) => (
        <EsimCountryRow key={country.isoCode} country={country} />
      ))}
    </ul>
  );
}
