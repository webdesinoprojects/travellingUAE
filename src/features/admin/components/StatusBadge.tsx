import type { AdminStatus } from "@/features/admin/types";

export function StatusBadge({ status }: { status: AdminStatus }) {
  const label = status.replace("-", " ");
  const className =
    status === "published" ||
    status === "confirmed" ||
    status === "completed"
      ? "bg-[#e8f7ff] text-brand-blue dark:bg-white/10 dark:text-brand-sand"
      : status === "new" || status === "draft" || status === "scheduled"
        ? "bg-[#fff3df] text-[#8a5f31] dark:bg-brand-sand/15 dark:text-brand-sand"
        : status === "missing" || status === "cancelled"
          ? "bg-[#ffe8e2] text-[#a33b1f] dark:bg-red-500/15 dark:text-red-200"
          : "bg-[#ead7bd] text-brand-navy dark:bg-white/10 dark:text-white";

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black capitalize ${className}`}
    >
      {label}
    </span>
  );
}
