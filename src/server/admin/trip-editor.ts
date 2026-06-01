import "server-only";

import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";

export type AdminTripEditorDestination = {
  id: string;
  name: string;
  status: string;
};

export async function listAdminTripDestinations(): Promise<
  AdminTripEditorDestination[]
> {
  if (!hasSupabaseAdminEnv()) {
    return [];
  }

  const result = await getSupabaseAdminClient()
    .from("destinations")
    .select("id,name,status")
    .neq("status", "archived")
    .order("name", { ascending: true })
    .limit(200);

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []).map((row) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    status: String(row.status ?? ""),
  }));
}
