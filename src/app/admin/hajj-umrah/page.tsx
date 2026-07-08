import { HajjUmrahPageEditor } from "@/features/admin/components/HajjUmrahPageEditor";
import { requireAdminPageAccess } from "@/server/admin/access";
import { getAdminHajjUmrahPageContent } from "@/server/admin/hajj-umrah-page";

export const dynamic = "force-dynamic";

export default async function AdminHajjUmrahPage() {
  await requireAdminPageAccess("editor");
  const content = await getAdminHajjUmrahPageContent();

  return <HajjUmrahPageEditor initialContent={content} />;
}
