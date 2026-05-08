import { notFound } from "next/navigation";

import { AdminResourcePage } from "@/features/admin/components/AdminResourcePage";
import {
  getAdminResourceKeys,
  isAdminResource,
} from "@/server/admin/dal";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return getAdminResourceKeys().map((resource) => ({ resource }));
}

export default async function AdminResourceRoutePage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;

  if (!isAdminResource(resource)) {
    notFound();
  }

  return <AdminResourcePage resource={resource} />;
}
