import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAdminPageAccess } from "@/server/admin/access";
import { isVisaCategory } from "@/server/public/visa-normalize";
import { VisaDestinationForm } from "@/features/admin/visa/components/VisaDestinationForm";
import { emptyVisaFormValues } from "@/features/admin/visa/form-values";

export const dynamic = "force-dynamic";

export default async function NewVisaDestinationPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await requireAdminPageAccess("editor");
  const { category } = await searchParams;
  const cat = isVisaCategory(category) ? category : "gulf";

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/visa/${cat}`}
          aria-label="Back to list"
          className="inline-flex size-10 items-center justify-center rounded-lg border border-border-soft bg-white dark:bg-white/10"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">Visa CMS</p>
          <h1 className="font-serif text-2xl font-black capitalize tracking-tight">New {cat} destination</h1>
        </div>
      </div>

      <VisaDestinationForm mode="create" initial={emptyVisaFormValues(cat)} />
    </div>
  );
}
