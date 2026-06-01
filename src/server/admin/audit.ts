import "server-only";

import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";
import type { AdminActor } from "@/server/supabase/auth";

export async function writeAdminAuditLog({
  actor,
  action,
  table,
  entityId,
  before,
  after,
}: {
  actor: AdminActor;
  action: string;
  table: string;
  entityId?: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (!hasSupabaseAdminEnv()) {
    throw new Error("Admin database is not configured");
  }

  const result = await getSupabaseAdminClient().from("audit_log").insert({
    actor_id: actor.id,
    action,
    entity_table: table,
    entity_id: entityId,
    before_value: before,
    after_value: after,
  });

  if (result.error) {
    throw result.error;
  }
}
