import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAdminPageAccess } from "@/server/admin/access";
import { DestinationEditor } from "@/features/admin/components/DestinationEditor";

export const dynamic = "force-dynamic";

export default async function NewDestinationPage() {
  await requireAdminPageAccess("editor");

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/destinations"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border-soft bg-white text-brand-navy dark:bg-white/10 dark:text-white"
          aria-label="Back to destinations"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
        </Link>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">
            Inventory
          </p>
          <h1 className="font-serif text-2xl font-black tracking-tight">
            New destination
          </h1>
        </div>
      </div>

      <DestinationEditor />
    </div>
  );
}
