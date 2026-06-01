import "server-only";

import { writeAdminAuditLog } from "@/server/admin/audit";
import {
  isRecord,
  readJsonObject,
  readNumber,
  readString,
  type UnknownRecord,
} from "@/server/http/validation";
import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";
import type { AdminActor } from "@/server/supabase/auth";
import type {
  AdminFooterColumn,
  AdminFooterLink,
  AdminHeaderNavigationItem,
  AdminNavigationContent,
  AdminNavigationStatus,
} from "@/types/navigation";

export type NavigationContentEntity =
  | "header-items"
  | "footer-columns"
  | "footer-links";

type DbHeaderItem = {
  id: string;
  parent_id: string | null;
  label: string;
  href: string;
  has_dropdown: boolean;
  status: AdminNavigationStatus;
  sort_order: number;
};

type DbFooterColumn = {
  id: string;
  title: string;
  status: AdminNavigationStatus;
  sort_order: number;
};

type DbFooterLink = {
  id: string;
  column_id: string;
  label: string;
  href: string;
  status: AdminNavigationStatus;
  sort_order: number;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getAdminNavigationContent(): Promise<AdminNavigationContent> {
  if (!hasSupabaseAdminEnv()) {
    return {
      source: "unconfigured",
      headerItems: [],
      footerColumns: [],
      footerLinks: [],
    };
  }

  const supabase = getSupabaseAdminClient();
  const [headerResult, columnsResult, linksResult] = await Promise.all([
    supabase
      .from("navigation_items")
      .select("id,parent_id,label,href,has_dropdown,status,sort_order")
      .eq("location", "header")
      .order("sort_order", { ascending: true }),
    supabase
      .from("footer_columns")
      .select("id,title,status,sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from("footer_links")
      .select("id,column_id,label,href,status,sort_order")
      .order("sort_order", { ascending: true }),
  ]);

  for (const error of [
    headerResult.error,
    columnsResult.error,
    linksResult.error,
  ]) {
    if (error) {
      throw error;
    }
  }

  return {
    source: "database",
    headerItems: ((headerResult.data ?? []) as DbHeaderItem[]).map(mapHeaderItem),
    footerColumns: ((columnsResult.data ?? []) as DbFooterColumn[]).map(mapFooterColumn),
    footerLinks: ((linksResult.data ?? []) as DbFooterLink[]).map(mapFooterLink),
  };
}

export async function createAdminNavigationContent(
  entity: NavigationContentEntity,
  request: Request,
  actor: AdminActor,
) {
  requireConfiguredAdmin();
  const payload = await buildPayload(entity, await readJsonObject(request), true);
  await requirePublishableContent(entity, payload);
  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from(tableForEntity(entity))
    .insert(payload)
    .select(selectForEntity(entity))
    .single();

  if (result.error) {
    throw result.error;
  }

  const row = normalizeRecord(result.data);
  await writeAdminAuditLog({
    actor,
    action: `navigation.${entity}.create`,
    table: tableForEntity(entity),
    entityId: requireUuid(String(row.id)),
    before: null,
    after: safeAudit(entity, row),
  });

  return getAdminNavigationContent();
}

export async function updateAdminNavigationContent(
  entity: NavigationContentEntity,
  id: string,
  request: Request,
  actor: AdminActor,
) {
  requireConfiguredAdmin();
  const safeId = requireUuid(id);
  const payload = await buildPayload(entity, await readJsonObject(request), false);

  if (Object.keys(payload).length === 0) {
    throw new Error("No supported fields were provided");
  }

  const supabase = getSupabaseAdminClient();
  const beforeResult = await supabase
    .from(tableForEntity(entity))
    .select(selectForEntity(entity))
    .eq("id", safeId)
    .single();

  if (beforeResult.error) {
    throw beforeResult.error;
  }

  const before = normalizeRecord(beforeResult.data);
  await requirePublishableContent(entity, { ...before, ...payload }, safeId);
  const result = await supabase
    .from(tableForEntity(entity))
    .update(payload)
    .eq("id", safeId)
    .select(selectForEntity(entity))
    .single();

  if (result.error) {
    throw result.error;
  }

  const after = normalizeRecord(result.data);
  await writeAdminAuditLog({
    actor,
    action: `navigation.${entity}.update`,
    table: tableForEntity(entity),
    entityId: safeId,
    before: safeAudit(entity, before),
    after: safeAudit(entity, after),
  });

  return getAdminNavigationContent();
}

export async function archiveAdminNavigationContent(
  entity: NavigationContentEntity,
  id: string,
  actor: AdminActor,
) {
  requireConfiguredAdmin();
  const safeId = requireUuid(id);
  const supabase = getSupabaseAdminClient();
  const beforeResult = await supabase
    .from(tableForEntity(entity))
    .select(selectForEntity(entity))
    .eq("id", safeId)
    .single();

  if (beforeResult.error) {
    throw beforeResult.error;
  }

  const result = await supabase
    .from(tableForEntity(entity))
    .update({ status: "archived" })
    .eq("id", safeId)
    .select(selectForEntity(entity))
    .single();

  if (result.error) {
    throw result.error;
  }

  const before = normalizeRecord(beforeResult.data);
  const after = normalizeRecord(result.data);
  await writeAdminAuditLog({
    actor,
    action: `navigation.${entity}.archive`,
    table: tableForEntity(entity),
    entityId: safeId,
    before: safeAudit(entity, before),
    after: safeAudit(entity, after),
  });

  return getAdminNavigationContent();
}

async function buildPayload(
  entity: NavigationContentEntity,
  body: UnknownRecord,
  creating: boolean,
) {
  if (entity === "header-items") {
    return requireCreateFields(
      compact({
        location: creating ? "header" : undefined,
        parent_id: readOptionalUuid(body, "parentId"),
        label: readString(body, "label", {
          min: 1,
          max: 120,
          required: creating,
        }),
        href: readInternalHref(body),
        has_dropdown: readBoolean(body, "hasDropdown"),
        status: readStatus(body),
        sort_order: readNumber(body, "sortOrder", { min: 0, max: 10000 }),
      }),
      creating ? ["label", "href"] : [],
    );
  }

  if (entity === "footer-columns") {
    return requireCreateFields(
      compact({
        title: readString(body, "title", {
          min: 1,
          max: 120,
          required: creating,
        }),
        status: readStatus(body),
        sort_order: readNumber(body, "sortOrder", { min: 0, max: 10000 }),
      }),
      creating ? ["title"] : [],
    );
  }

  return requireCreateFields(
    compact({
      column_id: readRequiredUuid(body, "columnId", creating),
      label: readString(body, "label", {
        min: 1,
        max: 120,
        required: creating,
      }),
      href: readInternalHref(body),
      status: readStatus(body),
      sort_order: readNumber(body, "sortOrder", { min: 0, max: 10000 }),
    }),
    creating ? ["column_id", "label", "href"] : [],
  );
}

async function requirePublishableContent(
  entity: NavigationContentEntity,
  row: Record<string, unknown>,
  recordId?: string,
) {
  if (row.status !== "published") {
    return;
  }

  if (entity === "footer-columns") {
    requireText(row.title, "Footer column title");
    return;
  }

  requireText(row.label, "Link label");
  requireText(row.href, "Link path");

  if (entity === "footer-links") {
    const columnId = requireUuid(String(row.column_id));
    const result = await getSupabaseAdminClient()
      .from("footer_columns")
      .select("status")
      .eq("id", columnId)
      .maybeSingle();

    if (result.error || !result.data) {
      throw result.error ?? new Error("Footer column was not found");
    }

    if ((result.data as { status: AdminNavigationStatus }).status !== "published") {
      throw new Error("Footer column must be published first");
    }

    return;
  }

  if (row.parent_id) {
    const parentId = requireUuid(String(row.parent_id));

    if (recordId && parentId === recordId) {
      throw new Error("Navigation item cannot be its own parent");
    }

    const result = await getSupabaseAdminClient()
      .from("navigation_items")
      .select("location,parent_id,status")
      .eq("id", parentId)
      .maybeSingle();

    if (result.error || !result.data) {
      throw result.error ?? new Error("Parent navigation item was not found");
    }

    const parent = result.data as {
      location: string;
      parent_id: string | null;
      status: AdminNavigationStatus;
    };

    if (
      parent.location !== "header" ||
      parent.parent_id ||
      parent.status !== "published"
    ) {
      throw new Error("Parent navigation item must be a published top-level header item");
    }
  }
}

function readOptionalUuid(body: UnknownRecord, key: string) {
  if (!Object.prototype.hasOwnProperty.call(body, key)) {
    return undefined;
  }

  if (body[key] === "" || body[key] === null) {
    return null;
  }

  const value = readString(body, key, { max: 40 });
  return value ? requireUuid(value) : null;
}

function readRequiredUuid(body: UnknownRecord, key: string, required: boolean) {
  const value = readString(body, key, { max: 40, required });
  return value ? requireUuid(value) : undefined;
}

function readInternalHref(body: UnknownRecord) {
  const value = readString(body, "href", { min: 1, max: 240 });

  if (!value) {
    return undefined;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    throw new Error("href must be a site path");
  }

  return value;
}

function readStatus(body: UnknownRecord) {
  if (!Object.prototype.hasOwnProperty.call(body, "status")) {
    return undefined;
  }

  const value = readString(body, "status", { max: 20 });

  if (value !== "draft" && value !== "published" && value !== "archived") {
    throw new Error("status is invalid");
  }

  return value;
}

function readBoolean(body: UnknownRecord, key: string) {
  if (!Object.prototype.hasOwnProperty.call(body, key)) {
    return undefined;
  }

  if (typeof body[key] !== "boolean") {
    throw new Error(`${key} must be boolean`);
  }

  return body[key];
}

function mapHeaderItem(row: DbHeaderItem): AdminHeaderNavigationItem {
  return {
    id: row.id,
    parentId: row.parent_id,
    label: row.label,
    href: row.href,
    hasDropdown: row.has_dropdown,
    status: row.status,
    sortOrder: row.sort_order,
  };
}

function mapFooterColumn(row: DbFooterColumn): AdminFooterColumn {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    sortOrder: row.sort_order,
  };
}

function mapFooterLink(row: DbFooterLink): AdminFooterLink {
  return {
    id: row.id,
    columnId: row.column_id,
    label: row.label,
    href: row.href,
    status: row.status,
    sortOrder: row.sort_order,
  };
}

function tableForEntity(entity: NavigationContentEntity) {
  if (entity === "header-items") {
    return "navigation_items";
  }

  return entity === "footer-columns" ? "footer_columns" : "footer_links";
}

function selectForEntity(entity: NavigationContentEntity) {
  if (entity === "header-items") {
    return "id,parent_id,label,href,has_dropdown,status,sort_order";
  }

  return entity === "footer-columns"
    ? "id,title,status,sort_order"
    : "id,column_id,label,href,status,sort_order";
}

function safeAudit(
  entity: NavigationContentEntity,
  row: Record<string, unknown>,
) {
  return Object.fromEntries(
    selectForEntity(entity)
      .split(",")
      .map((key) => [key, row[key] ?? null]),
  );
}

function requireConfiguredAdmin() {
  if (!hasSupabaseAdminEnv()) {
    throw new Error("Admin database is not configured");
  }
}

function normalizeRecord(value: unknown) {
  if (!isRecord(value)) {
    throw new Error("Invalid database response");
  }

  return value;
}

function requireUuid(value: string) {
  if (!UUID_RE.test(value)) {
    throw new Error("Invalid record id");
  }

  return value;
}

function requireText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required for published content`);
  }
}

function requireCreateFields(
  payload: Record<string, unknown>,
  fields: string[],
) {
  for (const field of fields) {
    if (payload[field] === undefined || payload[field] === "") {
      throw new Error(`${field} is required`);
    }
  }

  return payload;
}

function compact(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}
