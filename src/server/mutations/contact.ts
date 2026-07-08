import "server-only";

import { GENERIC_PUBLIC_ERROR } from "@/lib/safe-error";
import { validateHajjUmrahFields } from "@/lib/validation/hajj-umrah";
import {
  readJsonObject,
  readNumber,
  readString,
  requireEmail,
} from "@/server/http/validation";
import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";

import type { MutationResult } from "@/server/mutations/newsletter";
import type { UnknownRecord } from "@/server/http/validation";

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
  const source = readString(body, "source", { max: 80 }) ?? "website";

  if (source === "hajj-umrah-page") {
    return createHajjUmrahContactSubmission(body);
  }

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
  const travelDate = readString(body, "travelDate", { max: 40 });
  const departureCity = readString(body, "departureCity", { max: 120 });
  const nationality = readString(body, "nationality", { max: 120 });
  const travelers = readNumber(body, "travelers", {
    min: 1,
    max: 500,
  });
  const supabase = getSupabaseAdminClient();
  const result = await supabase.from("contact_submissions").insert({
    full_name: fullName,
    email,
    phone,
    subject,
    message,
    metadata: removeEmptyMetadata({
      source,
      travelDate,
      departureCity,
      nationality,
      travelers,
    }),
  });

  if (result.error) {
    throw result.error;
  }

  return {
    ok: true,
    message: "Your message has been received.",
  };
}

async function createHajjUmrahContactSubmission(
  body: UnknownRecord,
): Promise<MutationResult> {
  const validation = validateHajjUmrahFields({
    fullName: stringOrEmpty(body.fullName),
    phoneCode: stringOrEmpty(body.phoneCode),
    phoneNumber: stringOrEmpty(body.phoneNumber),
    email: stringOrEmpty(body.email),
    travelDate: stringOrEmpty(body.travelDate),
    departureCity: stringOrEmpty(body.departureCity),
    travelers:
      typeof body.travelers === "number" || typeof body.travelers === "string"
        ? body.travelers
        : "",
    nationality: stringOrEmpty(body.nationality),
    remarks: stringOrEmpty(body.remarks),
  });

  if (!validation.ok) {
    throw new Error("Invalid Hajj and Umrah enquiry");
  }

  const data = validation.data;
  const message = [
    "Hajj & Umrah pilgrimage enquiry",
    `Travel date: ${data.travelDate}`,
    `Departure city: ${data.departureCity}`,
    `Travelers: ${data.travelers}`,
    `Nationality: ${data.nationality}`,
    `Remarks: ${data.remarks || "No remarks supplied."}`,
  ].join("\n");
  const supabase = getSupabaseAdminClient();
  const result = await supabase.from("contact_submissions").insert({
    full_name: data.fullName,
    email: data.email,
    phone: data.phone,
    subject: "Hajj & Umrah pilgrimage enquiry",
    message,
    metadata: {
      source: "hajj-umrah-page",
      travelDate: data.travelDate,
      departureCity: data.departureCity,
      nationality: data.nationality,
      travelers: data.travelers,
      remarks: data.remarks,
    },
  });

  if (result.error) {
    throw result.error;
  }

  return {
    ok: true,
    message: "Your message has been received.",
  };
}

function removeEmptyMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value != null && value !== ""),
  );
}

function stringOrEmpty(value: unknown) {
  return typeof value === "string" ? value : "";
}
