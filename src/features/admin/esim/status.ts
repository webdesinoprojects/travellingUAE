import type { EsimOrderStatus } from "./types";

/** Status filter options exposed in the admin list toolbar (Phase 1A spec). */
export const ESIM_ORDER_FILTERS: ReadonlyArray<{
  value: "all" | EsimOrderStatus;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "payment_pending", label: "Payment pending" },
  { value: "paid", label: "Paid" },
  { value: "purchase_started", label: "Purchase started" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "pending_review", label: "Pending review" },
  { value: "purchase_failed", label: "Purchase failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
];

export type EsimStatusTone = "positive" | "pending" | "danger" | "neutral";

export function esimStatusTone(status: EsimOrderStatus): EsimStatusTone {
  switch (status) {
    case "fulfilled":
      return "positive";
    case "payment_pending":
    case "paid":
    case "purchase_started":
      return "pending";
    case "purchase_failed":
    case "cancelled":
    case "expired":
      return "danger";
    default:
      return "neutral";
  }
}

export function esimStatusLabel(status: EsimOrderStatus): string {
  return status.replace(/_/g, " ");
}
