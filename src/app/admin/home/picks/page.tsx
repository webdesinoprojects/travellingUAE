import { HomeCmsPageChrome } from "@/features/admin/components/HomeCmsPageChrome";
import { HomeContentEditor } from "@/features/admin/components/HomeContentEditor";
import { requireAdminPageAccess } from "@/server/admin/access";
import { getAdminHomeContent } from "@/server/admin/home-content";

export const dynamic = "force-dynamic";

export default async function AdminHomePicksPage() {
  await requireAdminPageAccess("editor");
  const content = await getAdminHomeContent();

  return (
    <HomeCmsPageChrome active="picks">
      <HomeContentEditor initialContent={content} view="picks" />
    </HomeCmsPageChrome>
  );
}
