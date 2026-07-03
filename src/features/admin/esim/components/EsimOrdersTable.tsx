import Link from "next/link";
import { ArrowUpRight, Inbox } from "lucide-react";

import { EsimStatusBadge } from "@/features/admin/esim/components/EsimStatusBadge";
import { formatEsimDate, formatEsimDateTime, formatEsimMoney, formatEsimText } from "@/features/admin/esim/format";
import type { EsimOrderListItem } from "@/features/admin/esim/types";

/**
 * Sanitized orders list. Rendered on the server (no "use client"), so the row
 * data never ships to the browser as a JSON payload. No sensitive fulfillment
 * fields are present in EsimOrderListItem.
 */
export function EsimOrdersTable({ items }: { items: EsimOrderListItem[] }) {
  if (items.length === 0) {
    return (
      <div className="grid place-items-center gap-2 rounded-lg border border-dashed border-[#d7c5ad] bg-white/60 px-6 py-14 text-center dark:border-white/10 dark:bg-white/[0.04]">
        <Inbox aria-hidden="true" className="size-8 text-brand-brown" />
        <p className="text-sm font-bold text-brand-brown">No eSIM orders match these filters.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#d7c5ad] bg-white/78 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
      {/* Desktop / tablet: scrollable table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[880px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#e4d6bf] text-xs font-black uppercase tracking-[0.1em] text-brand-brown dark:border-white/10">
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-[#efe3cf] last:border-0 hover:bg-[#fffaf2] dark:border-white/5 dark:hover:bg-white/[0.04]"
              >
                <td className="px-4 py-3 font-black">{item.publicReference}</td>
                <td className="px-4 py-3">
                  <div className="font-bold">{formatEsimText(item.guestName)}</div>
                  <div className="text-xs text-brand-brown">{item.guestEmail}</div>
                </td>
                <td className="px-4 py-3 font-semibold">{formatEsimText(item.countryName)}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold">{formatEsimText(item.planName)}</div>
                  <div className="text-xs text-brand-brown">{item.planCode}</div>
                </td>
                <td className="px-4 py-3 font-bold">{formatEsimMoney(item.price, item.currency)}</td>
                <td className="px-4 py-3">
                  <EsimStatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-brand-brown">
                  {formatEsimDate(item.paidAt)}
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-brand-brown">
                  {formatEsimDate(item.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/esim/orders/${item.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-border-soft bg-white px-3 py-1.5 text-xs font-black text-brand-navy hover:bg-[#fffaf2] dark:bg-white/10 dark:text-white"
                  >
                    View
                    <ArrowUpRight aria-hidden="true" className="size-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="grid gap-3 p-3 md:hidden">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-[#e4d6bf] bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-black">{item.publicReference}</p>
                <p className="truncate text-xs text-brand-brown">{item.guestEmail}</p>
              </div>
              <EsimStatusBadge status={item.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Cell label="Country" value={formatEsimText(item.countryName)} />
              <Cell label="Plan" value={formatEsimText(item.planName)} />
              <Cell label="Amount" value={formatEsimMoney(item.price, item.currency)} />
              <Cell label="Created" value={formatEsimDateTime(item.createdAt)} />
            </dl>
            <Link
              href={`/admin/esim/orders/${item.id}`}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-lg border border-border-soft bg-white text-sm font-black text-brand-navy dark:bg-white/10 dark:text-white"
            >
              View order
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-black uppercase tracking-[0.1em] text-brand-brown">{label}</dt>
      <dd className="mt-0.5 truncate font-bold">{value}</dd>
    </div>
  );
}
