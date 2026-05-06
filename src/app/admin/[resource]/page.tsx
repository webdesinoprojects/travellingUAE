import { notFound } from "next/navigation";

import { AdminResourcePage } from "@/features/admin/components/AdminResourcePage";
import { resourceConfigs } from "@/features/admin/mock/admin-data";

type AdminResourceRoute = keyof typeof resourceConfigs;

export function generateStaticParams() {
  return Object.keys(resourceConfigs).map((resource) => ({ resource }));
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

function isAdminResource(resource: string): resource is AdminResourceRoute {
  return resource in resourceConfigs;
}
