import { FooterSettingsEditor } from "@/features/admin/components/FooterSettingsEditor";
import { HomeCmsPageChrome } from "@/features/admin/components/HomeCmsPageChrome";
import { requireAdminPageAccess } from "@/server/admin/access";
import { getAdminFooterSettings } from "@/server/admin/footer-settings";

export const dynamic = "force-dynamic";

export default async function AdminHomeFooterPage() {
  await requireAdminPageAccess("editor");
  const settings = await getAdminFooterSettings();

  return (
    <HomeCmsPageChrome active="footer">
      <FooterSettingsEditor initialSettings={settings} />
    </HomeCmsPageChrome>
  );
}
