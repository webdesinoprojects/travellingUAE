import { requireAdminPageAccess } from "@/server/admin/access";
import { getAdminResourceDTO } from "@/server/admin/dal";
import { MediaLibrary } from "@/features/admin/components/MediaLibrary";
import { hasImageKitEnv } from "@/server/media/imagekit";

export const dynamic = "force-dynamic";

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPageAccess("editor");
  const resolved = await searchParams;
  const sp = (key: string) => {
    const value = resolved[key];
    return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
  };

  const config = await getAdminResourceDTO("media", {
    q: sp("q"),
    status: sp("status"),
    cursor: sp("cursor"),
    limit: sp("limit") ? Number(sp("limit")) : undefined,
    folder: sp("folder"),
  });

  return (
    <MediaLibrary
      config={config}
      uploadsEnabled={hasImageKitEnv()}
    />
  );
}
