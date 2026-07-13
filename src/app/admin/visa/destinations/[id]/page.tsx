import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAdminPageAccess } from "@/server/admin/access";
import { getVisaDestination } from "@/server/admin/visa-cms";
import { VisaDestinationForm } from "@/features/admin/visa/components/VisaDestinationForm";
import { visaRowToFormValues } from "@/features/admin/visa/form-values";

export const dynamic = "force-dynamic";

export default async function EditVisaDestinationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPageAccess("editor");
  const { id } = await params;
  const row = await getVisaDestination(id);

  if (!row) {
    notFound();
  }

  const category = row.category === "global" ? "global" : "gulf";

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/visa/${category}`}
          aria-label="Back to list"
          className="inline-flex size-10 items-center justify-center rounded-lg border border-border-soft bg-white dark:bg-white/10"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">Visa CMS</p>
          <h1 className="font-serif text-2xl font-black tracking-tight">Edit {row.name}</h1>
        </div>
      </div>

      <VisaDestinationForm mode="edit" destinationId={row.id} initial={visaRowToFormValues(row)} />
    </div>
  );
}
