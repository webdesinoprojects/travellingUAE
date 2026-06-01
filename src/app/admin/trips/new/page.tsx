import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAdminPageAccess } from "@/server/admin/access";
import { TripEditor } from "@/features/admin/components/TripEditor";
import { listAdminTripDestinations } from "@/server/admin/trip-editor";

export const dynamic = "force-dynamic";

export default async function NewTripPage() {
  await requireAdminPageAccess("editor");
  const destinations = await listAdminTripDestinations();

  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/trips"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border-soft bg-white text-brand-navy dark:bg-white/10 dark:text-white"
          aria-label="Back to trips"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
        </Link>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">
            Inventory
          </p>
          <h1 className="font-serif text-2xl font-black tracking-tight">
            New trip
          </h1>
        </div>
      </div>

      {destinations.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
          Create a destination first. A trip must be linked to a non-archived
          destination.
        </div>
      ) : (
        <TripEditor destinations={destinations} />
      )}
    </div>
  );
}
