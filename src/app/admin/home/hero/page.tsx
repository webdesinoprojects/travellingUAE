import { HomeCmsPageChrome } from "@/features/admin/components/HomeCmsPageChrome";
import { HomeHeroEditor } from "@/features/admin/components/HomeHeroEditor";
import { requireAdminPageAccess } from "@/server/admin/access";
import { getAdminHomeHero } from "@/server/admin/home-cms";

export const dynamic = "force-dynamic";

export default async function AdminHomeHeroPage() {
  await requireAdminPageAccess("editor");
  const hero = await getAdminHomeHero();

  return (
    <HomeCmsPageChrome active="hero">
      <HomeHeroEditor initialHero={hero} />
    </HomeCmsPageChrome>
  );
}
