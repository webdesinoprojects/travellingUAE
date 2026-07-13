"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Loader2, Pencil, Plus, Star } from "lucide-react";

import type { VisaAdminListItem } from "@/server/admin/visa-cms";

/**
 * Admin list of visa destinations for one category, with publish toggle + edit
 * links. Responsive: a scrollable table on deskt/tablet, stacked cards on mobile.
 */
export function VisaDestinationsTable({
  category,
  items,
}: {
  category: "global" | "gulf";
  items: VisaAdminListItem[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function togglePublish(item: VisaAdminListItem) {
    setBusyId(item.id);
    try {
      await fetch(`/api/admin/visa/destinations/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setPublished", isPublished: !item.isPublished }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-brand-brown">
          {items.length} {items.length === 1 ? "destination" : "destinations"}
        </p>
        <Link
          href={`/admin/visa/destinations/new?category=${category}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-navy px-4 text-sm font-black text-white dark:bg-brand-sand dark:text-brand-navy"
        >
          <Plus className="size-4" aria-hidden="true" />
          New destination
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#d7c5ad] bg-white/60 p-10 text-center dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-sm font-bold text-brand-brown">
            No {category} visa destinations in the CMS yet. The public page is using the static
            fallback content. Create one, or run the seed script.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop/tablet table */}
          <div className="hidden overflow-x-auto rounded-lg border border-[#d7c5ad] bg-white/78 md:block dark:border-white/10 dark:bg-white/[0.06]">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#e4d6bf] text-xs font-black uppercase tracking-[0.1em] text-brand-brown dark:border-white/10">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Sort</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-[#efe3cf] last:border-0 dark:border-white/5">
                    <td className="px-4 py-3 font-black">
                      <span className="inline-flex items-center gap-2">
                        {item.isFeatured ? <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" /> : null}
                        {item.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[13px] text-brand-brown">{item.slug}</td>
                    <td className="px-4 py-3 font-semibold">{item.startingPrice != null ? `${item.currency} ${item.startingPrice.toLocaleString("en-IN")}` : "—"}</td>
                    <td className="px-4 py-3 font-semibold">{item.sortOrder}</td>
                    <td className="px-4 py-3">
                      <StatusBadge published={item.isPublished} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <PublishButton item={item} busy={busyId === item.id} onClick={() => void togglePublish(item)} />
                        <EditLink id={item.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="grid gap-3 md:hidden">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-[#e4d6bf] bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black">
                      {item.isFeatured ? "★ " : ""}
                      {item.name}
                    </p>
                    <p className="truncate font-mono text-xs text-brand-brown">{item.slug}</p>
                  </div>
                  <StatusBadge published={item.isPublished} />
                </div>
                <p className="mt-2 text-sm font-semibold">
                  {item.startingPrice != null ? `${item.currency} ${item.startingPrice.toLocaleString("en-IN")}` : "No price"} · sort {item.sortOrder}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <PublishButton item={item} busy={busyId === item.id} onClick={() => void togglePublish(item)} />
                  <EditLink id={item.id} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function StatusBadge({ published }: { published: boolean }) {
  return published ? (
    <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
      Published
    </span>
  ) : (
    <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-black text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
      Draft
    </span>
  );
}

function PublishButton({ item, busy, onClick }: { item: VisaAdminListItem; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-soft bg-white px-3 text-xs font-black text-brand-navy hover:bg-[#fffaf2] disabled:opacity-50 dark:bg-white/10 dark:text-white"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : item.isPublished ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
      {item.isPublished ? "Unpublish" : "Publish"}
    </button>
  );
}

function EditLink({ id }: { id: string }) {
  return (
    <Link
      href={`/admin/visa/destinations/${id}`}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-navy px-3 text-xs font-black text-white dark:bg-brand-sand dark:text-brand-navy"
    >
      <Pencil className="size-3.5" aria-hidden="true" />
      Edit
    </Link>
  );
}
