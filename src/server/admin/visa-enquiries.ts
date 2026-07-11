import "server-only";

import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";
import type { AdminActor } from "@/server/supabase/auth";

export const VISA_APPLY_SOURCE = "visa-apply-online";
export const VISA_CALL_SOURCE = "visa-call-request";
export const VISA_ENQUIRY_SOURCES = [VISA_APPLY_SOURCE, VISA_CALL_SOURCE] as const;

export type VisaEnquirySource = (typeof VISA_ENQUIRY_SOURCES)[number];
export type VisaEnquiryTypeFilter = "apply" | "call";

export type VisaEnquiryRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string;
  status: string;
  adminNotes: string | null;
  source: VisaEnquirySource;
  typeLabel: string;
  visaType: string;
  travelers: number | null;
  destination: string;
  readAt: string | null;
  readBy: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};

export type VisaEnquiryListResult = {
  source: "database" | "unconfigured";
  enquiries: VisaEnquiryRow[];
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
  subject: string | null;
  message: string;
  status: string;
  admin_notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const PAGE_SIZE = 20;
const VALID_STATUSES = ["new", "contacted", "confirmed", "cancelled", "completed"];
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function listVisaEnquiries({
  q,
  page = 1,
  status,
  type,
}: {
  q?: string;
  page?: number;
  status?: string;
  type?: string;
} = {}): Promise<VisaEnquiryListResult> {
  const safePage = Math.max(1, Math.trunc(page));

  if (!hasSupabaseAdminEnv()) {
    return {
      source: "unconfigured",
      enquiries: [],
      page: safePage,
      pageSize: PAGE_SIZE,
      total: 0,
      totalPages: 0,
    };
  }

  const supabase = getSupabaseAdminClient();
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  let query = supabase
    .from("contact_submissions")
    .select(
      "id,full_name,email,phone,subject,message,status,admin_notes,metadata,created_at,updated_at",
      { count: "exact" },
    )
    .in("metadata->>source", sourcesForFilter(type))
    .order("created_at", { ascending: false })
    .range(from, to);

  const trimmedQ = q?.trim();

  if (trimmedQ) {
    const escaped = escapeLike(trimmedQ);
    query = query.or(
      `full_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%,subject.ilike.%${escaped}%,message.ilike.%${escaped}%`,
    );
  }

  if (status && VALID_STATUSES.includes(status)) {
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
    pageSize: PAGE_SIZE,
    total: result.count ?? 0,
    totalPages: Math.ceil((result.count ?? 0) / PAGE_SIZE),
  };
}

export async function getVisaEnquiryById(id: string): Promise<VisaEnquiryRow | null> {
  if (!UUID_RE.test(id) || !hasSupabaseAdminEnv()) {
    return null;
  }

  const result = await getSupabaseAdminClient()
    .from("contact_submissions")
    .select(
      "id,full_name,email,phone,subject,message,status,admin_notes,metadata,created_at,updated_at",
    )
    .eq("id", id)
    .in("metadata->>source", [...VISA_ENQUIRY_SOURCES])
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data ? mapRow(result.data as DbContactSubmission) : null;
}

export async function markVisaEnquiryRead(
  id: string,
  actor: AdminActor,
): Promise<VisaEnquiryRow | null> {
  if (!UUID_RE.test(id) || !hasSupabaseAdminEnv()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const current = await supabase
    .from("contact_submissions")
    .select(
      "id,full_name,email,phone,subject,message,status,admin_notes,metadata,created_at,updated_at",
    )
    .eq("id", id)
    .in("metadata->>source", [...VISA_ENQUIRY_SOURCES])
    .maybeSingle();

  if (current.error) {
    throw current.error;
  }

  if (!current.data) {
    return null;
  }

  const row = current.data as DbContactSubmission;
  const metadata = row.metadata ?? {};

  if (stringMeta(metadata, "visaReadAt")) {
    return mapRow(row);
  }

  const readBy = actor.email ?? actor.fullName ?? actor.id ?? actor.role;
  const result = await supabase
    .from("contact_submissions")
    .update({
      metadata: {
        ...metadata,
        visaReadAt: new Date().toISOString(),
        visaReadBy: readBy,
      },
    })
    .eq("id", id)
    .select(
      "id,full_name,email,phone,subject,message,status,admin_notes,metadata,created_at,updated_at",
    )
    .single();

  if (result.error) {
    throw result.error;
  }

  return mapRow(result.data as DbContactSubmission);
}

function mapRow(row: DbContactSubmission): VisaEnquiryRow {
  const metadata = row.metadata ?? {};
  const source = parseVisaSource(stringMeta(metadata, "source"));
  const subject = row.subject ?? "";
  const message = row.message;

  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    subject: row.subject,
    message,
    status: row.status,
    adminNotes: row.admin_notes,
    source,
    typeLabel: source === VISA_APPLY_SOURCE ? "Apply Online" : "Call Request",
    visaType: stringMeta(metadata, "visaType") || extractLineValue(message, "Visa type"),
    travelers: numberMeta(metadata, "travelers"),
    destination: extractDestination(subject, message),
    readAt: stringMeta(metadata, "visaReadAt") || null,
    readBy: stringMeta(metadata, "visaReadBy") || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata,
  };
}

function sourcesForFilter(type?: string): VisaEnquirySource[] {
  if (type === "apply") return [VISA_APPLY_SOURCE];
  if (type === "call") return [VISA_CALL_SOURCE];
  return [...VISA_ENQUIRY_SOURCES];
}

function parseVisaSource(value: string): VisaEnquirySource {
  return value === VISA_CALL_SOURCE ? VISA_CALL_SOURCE : VISA_APPLY_SOURCE;
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

function extractLineValue(message: string, label: string) {
  const line = message
    .split("\n")
    .find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));

  if (!line) return "";
  return line.replace(new RegExp(`^${escapeRegExp(label)}:\\s*`, "i"), "").trim();
}

function extractDestination(subject: string, message: string) {
  const candidate = subject || message.split("\n")[0] || "";
  return candidate
    .replace(/\s+visa\s+(application enquiry|call request|support).*$/i, "")
    .replace(/\s+visa$/i, "")
    .trim();
}

function escapeLike(value: string) {
  return value.replace(/[%_]/g, "\\$&");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
