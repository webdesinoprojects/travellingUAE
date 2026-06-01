import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { TripDetail } from "@/components/trips/TripDetail";
import { requireAdminPageAccess } from "@/server/admin/access";
import { getAdminTripPreview } from "@/server/admin/trip-preview";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function TripPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  await requireAdminPageAccess("editor");

  if (!UUID_RE.test(id)) {
    notFound();
  }

  const preview = await getAdminTripPreview(id);

  if (!preview) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background text-brand-navy dark:bg-black dark:text-white">
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm font-black text-amber-900">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/trips/${id}`}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 py-1"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to editor
          </Link>
          <span>
            Admin preview - status:{" "}
            <span className="uppercase">{preview.status}</span>
          </span>
        </div>
        <span className="text-xs font-bold text-amber-900">
          Not indexed. Not visible to the public. Authenticated admin/editor only.
        </span>
      </div>

      <TripDetail destination={preview.destination} pkg={preview.pkg} itinerary={null} />
    </div>
  );
}
