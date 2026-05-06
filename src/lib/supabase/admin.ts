import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireServerEnv } from "@/lib/supabase/env";

let cachedAdminClient: SupabaseClient | null = null;

export function createSupabaseAdminClient(): SupabaseClient {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  cachedAdminClient = createClient(
    requireServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          "X-Client-Info": "flytime-next-server",
        },
      },
    },
  );

  return cachedAdminClient;
}
