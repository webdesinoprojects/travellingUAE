import "server-only";

import { GENERIC_PUBLIC_ERROR } from "@/lib/safe-error";
import {
  readJsonObject,
  readString,
  requireEmail,
} from "@/server/http/validation";
import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";

export type MutationResult = {
  ok: boolean;
  message: string;
};

export async function subscribeNewsletter(request: Request): Promise<MutationResult> {
  if (!hasSupabaseAdminEnv()) {
    return {
      ok: false,
      message: GENERIC_PUBLIC_ERROR,
    };
  }

  const body = await readJsonObject(request);
  const email = requireEmail(readString(body, "email", { required: true }));
  const locale = readString(body, "locale", { max: 8 }) ?? "en";
  const source = readString(body, "source", { max: 80 }) ?? "website";
  const supabase = getSupabaseAdminClient();
  const result = await supabase.from("newsletter_subscribers").upsert(
    {
      email,
      locale_code: locale,
      source,
      is_active: true,
      unsubscribed_at: null,
    },
    { onConflict: "email" },
  );

  if (result.error) {
    throw result.error;
  }

  return {
    ok: true,
    message: "You are subscribed.",
  };
}

