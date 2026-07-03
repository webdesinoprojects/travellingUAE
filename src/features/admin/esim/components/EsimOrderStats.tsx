import type { EsimOrderStats } from "@/features/admin/esim/types";

/** Compact KPI row for the orders list header. Wraps responsively. */
export function EsimOrderStats({ stats }: { stats: EsimOrderStats }) {
  const tiles: Array<{ label: string; value: number }> = [
    { label: "Total orders", value: stats.total },
    { label: "Paid", value: stats.paid },
    { label: "Activation pending", value: stats.activationPending },
    { label: "Fulfilled", value: stats.fulfilled },
    { label: "Purchase failed", value: stats.purchaseFailed },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-lg border border-[#d7c5ad] bg-white/78 px-4 py-3 dark:border-white/10 dark:bg-white/[0.06]"
        >
          <dt className="text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
            {tile.label}
          </dt>
          <dd className="mt-1 text-2xl font-black">{tile.value.toLocaleString("en")}</dd>
        </div>
      ))}
    </dl>
  );
}
