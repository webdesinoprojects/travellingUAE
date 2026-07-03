import { esimStatusLabel, esimStatusTone, type EsimStatusTone } from "@/features/admin/esim/status";
import type { EsimOrderStatus } from "@/features/admin/esim/types";

const TONE_CLASS: Record<EsimStatusTone, string> = {
  positive: "bg-[#e8f7ff] text-brand-blue dark:bg-white/10 dark:text-brand-sand",
  pending: "bg-[#fff3df] text-[#8a5f31] dark:bg-brand-sand/15 dark:text-brand-sand",
  danger: "bg-[#ffe8e2] text-[#a33b1f] dark:bg-red-500/15 dark:text-red-200",
  neutral: "bg-[#ead7bd] text-brand-navy dark:bg-white/10 dark:text-white",
};

export function EsimStatusBadge({ status }: { status: EsimOrderStatus }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black capitalize ${TONE_CLASS[esimStatusTone(status)]}`}
    >
      {esimStatusLabel(status)}
    </span>
  );
}
