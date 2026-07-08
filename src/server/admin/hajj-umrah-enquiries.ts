import "server-only";

import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";
import type { AdminActor } from "@/server/supabase/auth";

export const HAJJ_UMRAH_SOURCE = "hajj-umrah-page";

export type HajjUmrahEnquiryRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  travelDate: string;
  departureCity: string;
  travelers: number | null;
  nationality: string;
  remarks: string;
  message: string;
  status: string;
  adminNotes: string | null;
  readAt: string | null;
  readBy: string | null;
  createdAt: string;
};

export type HajjUmrahEnquiryListResult = {
  source: "database" | "unconfigured";
  enquiries: HajjUmrahEnquiryRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type DbContactSubmission = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  message: string;
  status: string;
  admin_notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function listHajjUmrahEnquiries({
  q,
  page = 1,
  status,
}: {
  q?: string;
  page?: number;
  status?: string;
} = {}): Promise<HajjUmrahEnquiryListResult> {
  const safePage = Math.max(1, Math.trunc(page));
  const pageSize = 20;

  if (!hasSupabaseAdminEnv()) {
    return {
      source: "unconfigured",
      enquiries: [],
      page: safePage,
      pageSize,
      total: 0,
      totalPages: 0,
    };
  }

  const supabase = getSupabaseAdminClient();
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("contact_submissions")
    .select(
      "id,full_name,email,phone,message,status,admin_notes,metadata,created_at",
      { count: "exact" },
    )
    .contains("metadata", { source: HAJJ_UMRAH_SOURCE })
    .order("created_at", { ascending: false })
    .range(from, to);

  const trimmedQ = q?.trim();

  if (trimmedQ) {
    const escaped = trimmedQ.replace(/[%_]/g, "\\$&");
    query = query.or(
      `full_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%`,
    );
  }

  if (
    status &&
    ["new", "contacted", "confirmed", "cancelled", "completed"].includes(status)
  ) {
    query = query.eq("status", status);
  }

  const result = await query;

  if (result.error) {
    throw result.error;
  }

  return {
    source: "database",
    enquiries: ((result.data ?? []) as DbContactSubmission[]).map(mapRow),
    page: safePage,
    pageSize,
    total: result.count ?? 0,
    totalPages: Math.ceil((result.count ?? 0) / pageSize),
  };
}

export async function getHajjUmrahEnquiryById(
  id: string,
): Promise<HajjUmrahEnquiryRow | null> {
  if (!UUID_RE.test(id) || !hasSupabaseAdminEnv()) {
    return null;
  }

  const result = await getSupabaseAdminClient()
    .from("contact_submissions")
    .select(
      "id,full_name,email,phone,message,status,admin_notes,metadata,created_at",
    )
    .eq("id", id)
    .contains("metadata", { source: HAJJ_UMRAH_SOURCE })
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data ? mapRow(result.data as DbContactSubmission) : null;
}

export async function markHajjUmrahEnquiryRead(
  id: string,
  actor: AdminActor,
): Promise<HajjUmrahEnquiryRow | null> {
  if (!UUID_RE.test(id) || !hasSupabaseAdminEnv()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const current = await supabase
    .from("contact_submissions")
    .select(
      "id,full_name,email,phone,message,status,admin_notes,metadata,created_at",
    )
    .eq("id", id)
    .contains("metadata", { source: HAJJ_UMRAH_SOURCE })
    .maybeSingle();

  if (current.error) {
    throw current.error;
  }

  if (!current.data) {
    return null;
  }

  const row = current.data as DbContactSubmission;
  const metadata = row.metadata ?? {};

  if (stringMeta(metadata, "hajjUmrahReadAt") || stringMeta(metadata, "readAt")) {
    return mapRow(row);
  }

  const readBy = actor.email ?? actor.fullName ?? actor.id ?? actor.role;
  const result = await supabase
    .from("contact_submissions")
    .update({
      metadata: {
        ...metadata,
        hajjUmrahReadAt: new Date().toISOString(),
        hajjUmrahReadBy: readBy,
      },
    })
    .eq("id", id)
    .select(
      "id,full_name,email,phone,message,status,admin_notes,metadata,created_at",
    )
    .single();

  if (result.error) {
    throw result.error;
  }

  return mapRow(result.data as DbContactSubmission);
}

function mapRow(row: DbContactSubmission): HajjUmrahEnquiryRow {
  const metadata = row.metadata ?? {};

  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    travelDate: stringMeta(metadata, "travelDate"),
    departureCity: stringMeta(metadata, "departureCity"),
    travelers: numberMeta(metadata, "travelers"),
    nationality: stringMeta(metadata, "nationality"),
    remarks: stringMeta(metadata, "remarks") || extractRemarks(row.message),
    message: row.message,
    status: row.status,
    adminNotes: row.admin_notes,
    readAt:
      stringMeta(metadata, "hajjUmrahReadAt") || stringMeta(metadata, "readAt") || null,
    readBy:
      stringMeta(metadata, "hajjUmrahReadBy") || stringMeta(metadata, "readBy") || null,
    createdAt: row.created_at,
  };
}

function stringMeta(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  return typeof value === "string" ? value : "";
}

function numberMeta(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractRemarks(message: string) {
  const line = message
    .split("\n")
    .find((item) => item.toLowerCase().startsWith("remarks:"));

  if (!line) {
    return "";
  }

  const value = line.replace(/^remarks:\s*/i, "").trim();

  return value === "No remarks supplied." ? "" : value;
}
