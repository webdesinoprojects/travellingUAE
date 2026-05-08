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

import type { MutationResult } from "@/server/mutations/newsletter";

export async function createContactSubmission(
  request: Request,
): Promise<MutationResult> {
  if (!hasSupabaseAdminEnv()) {
    return {
      ok: false,
      message: GENERIC_PUBLIC_ERROR,
    };
  }

  const body = await readJsonObject(request);
  const fullName = readString(body, "fullName", {
    min: 2,
    max: 120,
    required: true,
  })!;
  const emailInput = readString(body, "email", { max: 180 });
  const email = emailInput ? requireEmail(emailInput) : undefined;
  const phone = readString(body, "phone", { max: 40 });
  const subject = readString(body, "subject", { max: 120 }) ?? "Website enquiry";
  const message = readString(body, "message", {
    min: 5,
    max: 2000,
    required: true,
  })!;
  const source = readString(body, "source", { max: 80 }) ?? "website";
  const supabase = getSupabaseAdminClient();
  const result = await supabase.from("contact_submissions").insert({
    full_name: fullName,
    email,
    phone,
    subject,
    message,
    metadata: { source },
  });

  if (result.error) {
    throw result.error;
  }

  return {
    ok: true,
    message: "Your message has been received.",
  };
}

