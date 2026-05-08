import { AdminDashboard } from "@/features/admin/components/AdminDashboard";
import { requireAdminPageAccess } from "@/server/admin/access";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdminPageAccess();

  return <AdminDashboard />;
}
