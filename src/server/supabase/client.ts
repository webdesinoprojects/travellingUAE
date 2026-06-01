import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

let cachedPublicClient: SupabaseClient | null = null;

export function hasSupabaseAdminEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function hasSupabasePublicEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getSupabaseAdminClient() {
  return createSupabaseAdminClient();
}

export function getSupabasePublicServerClient() {
  if (cachedPublicClient) {
    return cachedPublicClient;
  }

  cachedPublicClient = createConfiguredPublicClient("flytime-next-public-server");
  return cachedPublicClient;
}

export function createSupabasePublicAuthClient() {
  return createConfiguredPublicClient("flytime-next-admin-auth");
}

function createConfiguredPublicClient(clientInfo: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase public environment is not configured");
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": clientInfo,
      },
    },
  });
}
