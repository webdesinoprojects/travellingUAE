/** Presentational formatters for the admin eSIM views. Pure, no side effects. */

const EM_DASH = "—";

export function formatEsimDateTime(value: string | null): string {
  if (!value) return EM_DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EM_DASH;
  return `${date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}

export function formatEsimDate(value: string | null): string {
  if (!value) return EM_DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EM_DASH;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatEsimMoney(amount: number | null, currency: string | null): string {
  if (amount == null) return EM_DASH;
  const code = currency ? currency.toUpperCase() : "";
  const value = amount.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return code ? `${code} ${value}` : value;
}

export function formatEsimText(value: string | null | undefined): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : EM_DASH;
}
