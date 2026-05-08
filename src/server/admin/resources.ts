import "server-only";

import type { AdminResourceRow } from "@/features/admin/types";
import {
  isRecord,
  readDateString,
  readJsonObject,
  readNumber,
  readString,
  requireEmail,
  type UnknownRecord,
} from "@/server/http/validation";
import {
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/server/supabase/client";
import type { AdminActor, AdminRole } from "@/server/supabase/auth";
import type { AdminResourceKey } from "@/server/admin/dal";

type PublishStatus = "draft" | "published" | "archived";
type BookingStatus =
  | "new"
  | "contacted"
  | "confirmed"
  | "cancelled"
  | "completed";

type AdminCrudResult = {
  resource: AdminResourceKey;
  action: "created" | "updated" | "deleted";
  row: AdminResourceRow;
};

export type CrudDefinition = {
  resource: AdminResourceKey;
  table: string;
  select: string;
  requiredRole: AdminRole;
  create?: (body: UnknownRecord) => Promise<Record<string, unknown>>;
  update?: (body: UnknownRecord) => Promise<Record<string, unknown>>;
  remove?: "archive" | "cancel" | "unsubscribe" | "hard-delete";
  toRow: (row: Record<string, unknown>) => AdminResourceRow;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const RESOURCE_DEFINITIONS: Partial<Record<AdminResourceKey, CrudDefinition>> = {
  destinations: {
    resource: "destinations",
    table: "destinations",
    select:
      "id,slug,name,country,city,result_title,currency,package_date,poster_title,poster_price,poster_season,latitude,longitude,map_zoom,status,sort_order,updated_at",
    requiredRole: "editor",
    create: buildDestinationPayload,
    update: buildDestinationPayload,
    remove: "archive",
    toRow: destinationRow,
  },
  trips: {
    resource: "trips",
    table: "trips",
    select:
      "id,destination_id,slug,title,city,summary,overview,badge,duration_days,duration_label,nights,has_flights,hotel_star,price_amount,currency,start_date,travelers_label,latitude,longitude,map_zoom,status,sort_order,updated_at",
    requiredRole: "editor",
    create: buildTripPayload,
    update: buildTripPayload,
    remove: "archive",
    toRow: tripRow,
  },
  categories: {
    resource: "categories",
    table: "categories",
    select: "id,slug,name,description,status,sort_order,updated_at",
    requiredRole: "editor",
    create: buildCategoryPayload,
    update: buildCategoryPayload,
    remove: "archive",
    toRow: taxonomyRow,
  },
  pages: {
    resource: "pages",
    table: "pages",
    select:
      "id,slug,title,excerpt,body,status,seo_title,seo_description,updated_at",
    requiredRole: "editor",
    create: buildPagePayload,
    update: buildPagePayload,
    remove: "archive",
    toRow: pageRow,
  },
  navigation: {
    resource: "navigation",
    table: "navigation_items",
    select:
      "id,location,parent_id,label,href,has_dropdown,status,sort_order,updated_at",
    requiredRole: "editor",
    create: buildNavigationPayload,
    update: buildNavigationPayload,
    remove: "archive",
    toRow: navigationRow,
  },
  media: {
    resource: "media",
    table: "media_assets",
    select:
      "id,provider,public_id,url,secure_url,alt_text,resource_type,width,height,bytes,format,folder,metadata,updated_at",
    requiredRole: "editor",
    create: buildMediaPayload,
    update: buildMediaPayload,
    remove: "hard-delete",
    toRow: mediaRow,
  },
  bookings: {
    resource: "bookings",
    table: "bookings",
    select:
      "id,customer_name,customer_email,customer_phone,travelers_count,travel_date,status,admin_notes,created_at,updated_at",
    requiredRole: "admin",
    create: buildBookingPayload,
    update: buildBookingPayload,
    remove: "cancel",
    toRow: bookingRow,
  },
  newsletter: {
    resource: "newsletter",
    table: "newsletter_subscribers",
    select: "id,email,locale_code,source,is_active,created_at,unsubscribed_at",
    requiredRole: "admin",
    create: buildNewsletterPayload,
    update: buildNewsletterPayload,
    remove: "unsubscribe",
    toRow: newsletterRow,
  },
  translations: {
    resource: "translations",
    table: "translations",
    select:
      "id,locale_code,namespace,translation_key,value,status,updated_at",
    requiredRole: "editor",
    create: buildTranslationPayload,
    update: buildTranslationPayload,
    remove: "archive",
    toRow: translationRow,
  },
  home: {
    resource: "home",
    table: "site_sections",
    select: "id,key,title,eyebrow,description,payload,status,updated_at",
    requiredRole: "editor",
    create: buildSiteSectionPayload,
    update: buildSiteSectionPayload,
    remove: "archive",
    toRow: siteSectionRow,
  },
  users: {
    resource: "users",
    table: "profiles",
    select: "id,email,full_name,role,is_active,updated_at",
    requiredRole: "admin",
    update: buildProfilePayload,
    toRow: profileRow,
  },
};

export function getCrudDefinition(resource: AdminResourceKey) {
  return RESOURCE_DEFINITIONS[resource];
}

export async function createAdminResource(
  resource: AdminResourceKey,
  request: Request,
  actor: AdminActor,
): Promise<AdminCrudResult> {
  const definition = requireDefinition(resource);

  if (!definition.create) {
    throw new Error("Resource does not support create");
  }

  const body = await readJsonObject(request);
  const payload = await definition.create(body);
  const supabase = getAdminCrudClient();
  const result = await supabase
    .from(definition.table)
    .insert(payload)
    .select(definition.select)
    .single();

  if (result.error) {
    throw result.error;
  }

  const row = normalizeRow(result.data);

  await writeAuditLog({
    actor,
    action: `${resource}.create`,
    table: definition.table,
    entityId: readRowId(row),
    before: null,
    after: safeAuditValue(row),
  });

  return {
    resource,
    action: "created",
    row: definition.toRow(row),
  };
}

export async function updateAdminResource(
  resource: AdminResourceKey,
  id: string,
  request: Request,
  actor: AdminActor,
): Promise<AdminCrudResult> {
  const definition = requireDefinition(resource);

  if (!definition.update) {
    throw new Error("Resource does not support update");
  }

  const safeId = requireUuid(id);
  const body = await readJsonObject(request);
  const payload = await definition.update(body);

  if (Object.keys(payload).length === 0) {
    throw new Error("No supported fields were provided");
  }

  const supabase = getAdminCrudClient();
  const before = await selectResourceRow(definition, safeId);
  const result = await supabase
    .from(definition.table)
    .update(payload)
    .eq("id", safeId)
    .select(definition.select)
    .single();

  if (result.error) {
    throw result.error;
  }

  const row = normalizeRow(result.data);

  await writeAuditLog({
    actor,
    action: `${resource}.update`,
    table: definition.table,
    entityId: safeId,
    before: safeAuditValue(before),
    after: safeAuditValue(row),
  });

  return {
    resource,
    action: "updated",
    row: definition.toRow(row),
  };
}

export async function deleteAdminResource(
  resource: AdminResourceKey,
  id: string,
  actor: AdminActor,
): Promise<AdminCrudResult> {
  const definition = requireDefinition(resource);
  const safeId = requireUuid(id);

  if (!definition.remove) {
    throw new Error("Resource does not support delete");
  }

  const supabase = getAdminCrudClient();
  const before = await selectResourceRow(definition, safeId);
  let row: Record<string, unknown>;

  if (definition.remove === "hard-delete") {
    const result = await supabase
      .from(definition.table)
      .delete()
      .eq("id", safeId)
      .select(definition.select)
      .single();

    if (result.error) {
      throw result.error;
    }

    row = normalizeRow(result.data);
  } else {
    const payload =
      definition.remove === "archive"
        ? { status: "archived" }
        : definition.remove === "cancel"
          ? { status: "cancelled" }
          : {
              is_active: false,
              unsubscribed_at: new Date().toISOString(),
            };
    const result = await supabase
      .from(definition.table)
      .update(payload)
      .eq("id", safeId)
      .select(definition.select)
      .single();

    if (result.error) {
      throw result.error;
    }

    row = normalizeRow(result.data);
  }

  await writeAuditLog({
    actor,
    action: `${resource}.delete`,
    table: definition.table,
    entityId: safeId,
    before: safeAuditValue(before),
    after: safeAuditValue(row),
  });

  return {
    resource,
    action: "deleted",
    row: definition.toRow(row),
  };
}

function getAdminCrudClient() {
  if (!hasSupabaseAdminEnv()) {
    throw new Error("Admin database is not configured");
  }

  return getSupabaseAdminClient();
}

function requireDefinition(resource: AdminResourceKey) {
  const definition = getCrudDefinition(resource);

  if (!definition) {
    throw new Error("Resource is read only");
  }

  return definition;
}

async function selectResourceRow(definition: CrudDefinition, id: string) {
  const result = await getAdminCrudClient()
    .from(definition.table)
    .select(definition.select)
    .eq("id", id)
    .single();

  if (result.error) {
    throw result.error;
  }

  return normalizeRow(result.data);
}

async function writeAuditLog({
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
  const result = await getAdminCrudClient().from("audit_log").insert({
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

function buildDestinationPayload(body: UnknownRecord) {
  const name = readString(body, "name", { min: 2, max: 120 });
  const payload = pickDefined({
    slug:
      readString(body, "slug", { max: 120 }) ??
      (name ? slugify(name) : undefined),
    name,
    country: readString(body, "country", { max: 120 }),
    city: readString(body, "city", { max: 120 }),
    search_label: readString(body, "searchLabel", { max: 120 }),
    result_title: readString(body, "resultTitle", { max: 160 }),
    currency: readString(body, "currency", { max: 12 }),
    package_date: readDateString(body, "packageDate"),
    poster_title: readString(body, "posterTitle", { max: 120 }),
    poster_price: readNumber(body, "posterPrice", { min: 0 }),
    poster_season: readString(body, "posterSeason", { max: 80 }),
    latitude: readNumber(body, "latitude", { min: -90, max: 90 }),
    longitude: readNumber(body, "longitude", { min: -180, max: 180 }),
    map_zoom: readNumber(body, "mapZoom", { min: 1, max: 18 }),
    status: readPublishStatus(body),
    sort_order: readNumber(body, "sortOrder", { min: 0 }),
  });

  return Promise.resolve(payload);
}

async function buildTripPayload(body: UnknownRecord) {
  const title = readString(body, "title", { min: 2, max: 160 });
  const destinationId =
    readUuid(body, "destinationId") ??
    (await resolveDestinationId(readString(body, "destinationSlug", { max: 120 })));
  const payload = pickDefined({
    destination_id: destinationId,
    slug:
      readString(body, "slug", { max: 160 }) ??
      (title ? slugify(title) : undefined),
    title,
    city: readString(body, "city", { max: 120 }),
    summary: readString(body, "summary", { max: 320 }),
    overview: readString(body, "overview", { max: 3000 }),
    badge: readString(body, "badge", { max: 80 }),
    duration_days: readNumber(body, "durationDays", { min: 1, max: 90 }),
    duration_label: readString(body, "durationLabel", { max: 80 }),
    nights: readNumber(body, "nights", { min: 0, max: 90 }),
    has_flights: readBoolean(body, "hasFlights"),
    hotel_star: readNumber(body, "hotelStar", { min: 1, max: 5 }),
    price_amount: readNumber(body, "priceAmount", { min: 0 }),
    currency: readString(body, "currency", { max: 12 }),
    start_date: readDateString(body, "startDate"),
    travelers_label: readString(body, "travelersLabel", { max: 80 }),
    latitude: readNumber(body, "latitude", { min: -90, max: 90 }),
    longitude: readNumber(body, "longitude", { min: -180, max: 180 }),
    map_zoom: readNumber(body, "mapZoom", { min: 1, max: 18 }),
    status: readPublishStatus(body),
    sort_order: readNumber(body, "sortOrder", { min: 0 }),
  });

  return payload;
}

function buildCategoryPayload(body: UnknownRecord) {
  const name = readString(body, "name", { min: 2, max: 120 });

  return Promise.resolve(
    pickDefined({
      slug:
        readString(body, "slug", { max: 120 }) ??
        (name ? slugify(name) : undefined),
      name,
      description: readString(body, "description", { max: 800 }),
      status: readPublishStatus(body),
      sort_order: readNumber(body, "sortOrder", { min: 0 }),
    }),
  );
}

function buildPagePayload(body: UnknownRecord) {
  const title = readString(body, "title", { min: 2, max: 180 });

  return Promise.resolve(
    pickDefined({
      slug:
        readString(body, "slug", { max: 140 }) ??
        (title ? slugify(title) : undefined),
      title,
      excerpt: readString(body, "excerpt", { max: 320 }),
      body: readString(body, "body", { min: 1, max: 20000 }),
      status: readPublishStatus(body),
      seo_title: readString(body, "seoTitle", { max: 180 }),
      seo_description: readString(body, "seoDescription", { max: 320 }),
    }),
  );
}

function buildNavigationPayload(body: UnknownRecord) {
  return Promise.resolve(
    pickDefined({
      location: readEnum(body, "location", ["header", "footer"]),
      parent_id: readUuid(body, "parentId"),
      label: readString(body, "label", { min: 1, max: 120 }),
      href: readString(body, "href", { min: 1, max: 240 }),
      has_dropdown: readBoolean(body, "hasDropdown"),
      status: readPublishStatus(body),
      sort_order: readNumber(body, "sortOrder", { min: 0 }),
    }),
  );
}

function buildMediaPayload(body: UnknownRecord) {
  return Promise.resolve(
    pickDefined({
      provider: readEnum(body, "provider", ["external", "cloudinary", "imagekit"]),
      public_id: readString(body, "publicId", { max: 240 }),
      url: readString(body, "url", { min: 8, max: 1200 }),
      secure_url: readString(body, "secureUrl", { max: 1200 }),
      alt_text: readString(body, "altText", { max: 240 }),
      resource_type: readString(body, "resourceType", { max: 40 }),
      width: readNumber(body, "width", { min: 1 }),
      height: readNumber(body, "height", { min: 1 }),
      bytes: readNumber(body, "bytes", { min: 0 }),
      format: readString(body, "format", { max: 40 }),
      folder: readString(body, "folder", { max: 240 }),
      metadata: readJsonValue(body, "metadata"),
    }),
  );
}

function buildBookingPayload(body: UnknownRecord) {
  const email = readString(body, "email", { max: 180 });

  return Promise.resolve(
    pickDefined({
      customer_name: readString(body, "fullName", { min: 2, max: 120 }),
      customer_email: email ? requireEmail(email) : undefined,
      customer_phone: readString(body, "phone", { min: 5, max: 40 }),
      travelers_count: readNumber(body, "travelersCount", { min: 1, max: 50 }),
      travel_date: readDateString(body, "travelDate"),
      status: readBookingStatus(body),
      admin_notes: readString(body, "adminNotes", { max: 4000 }),
    }),
  );
}

function buildNewsletterPayload(body: UnknownRecord) {
  const email = readString(body, "email", { max: 180 });

  return Promise.resolve(
    pickDefined({
      email: email ? requireEmail(email) : undefined,
      locale_code: readString(body, "locale", { max: 12 }),
      source: readString(body, "source", { max: 120 }),
      is_active: readBoolean(body, "isActive"),
    }),
  );
}

function buildTranslationPayload(body: UnknownRecord) {
  return Promise.resolve(
    pickDefined({
      locale_code: readString(body, "locale", { min: 2, max: 12 }),
      namespace: readString(body, "namespace", { min: 1, max: 80 }),
      translation_key: readString(body, "key", { min: 1, max: 160 }),
      value: readString(body, "value", { min: 1, max: 10000 }),
      status: readPublishStatus(body),
    }),
  );
}

function buildSiteSectionPayload(body: UnknownRecord) {
  const title = readString(body, "title", { max: 180 });

  return Promise.resolve(
    pickDefined({
      key:
        readString(body, "key", { max: 120 }) ??
        (title ? slugify(title) : undefined),
      title,
      eyebrow: readString(body, "eyebrow", { max: 120 }),
      description: readString(body, "description", { max: 1000 }),
      payload: readJsonValue(body, "payload"),
      status: readPublishStatus(body),
    }),
  );
}

function buildProfilePayload(body: UnknownRecord) {
  return Promise.resolve(
    pickDefined({
      full_name: readString(body, "fullName", { max: 120 }),
      role: readEnum(body, "role", ["admin", "editor"]),
      is_active: readBoolean(body, "isActive"),
    }),
  );
}

async function resolveDestinationId(slug: string | undefined) {
  if (!slug) {
    return undefined;
  }

  const result = await getAdminCrudClient()
    .from("destinations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return (result.data as { id?: string } | null)?.id;
}

function destinationRow(row: Record<string, unknown>): AdminResourceRow {
  return {
    id: stringValue(row.id),
    name: stringValue(row.name),
    country: stringValue(row.country),
    packages: 0,
    bookings: 0,
    status: stringValue(row.status),
  };
}

function tripRow(row: Record<string, unknown>): AdminResourceRow {
  return {
    id: stringValue(row.id),
    title: stringValue(row.title),
    destinationId: stringValue(row.destination_id),
    duration: stringValue(row.duration_label) || `${numberValue(row.duration_days)} days`,
    price: `${stringValue(row.currency) || "SAR"} ${numberValue(
      row.price_amount,
    ).toLocaleString("en-US")}`,
    status: stringValue(row.status),
  };
}

function taxonomyRow(row: Record<string, unknown>): AdminResourceRow {
  return {
    id: stringValue(row.id),
    name: stringValue(row.name),
    type: "Category",
    items: 0,
    status: stringValue(row.status),
  };
}

function pageRow(row: Record<string, unknown>): AdminResourceRow {
  return {
    id: stringValue(row.id),
    title: stringValue(row.title),
    slug: `/${stringValue(row.slug).replace(/^\/+/, "")}`,
    locale: "EN",
    status: stringValue(row.status),
  };
}

function navigationRow(row: Record<string, unknown>): AdminResourceRow {
  return {
    id: stringValue(row.id),
    label: stringValue(row.label),
    location: stringValue(row.location),
    href: stringValue(row.href),
    status: stringValue(row.status),
  };
}

function mediaRow(row: Record<string, unknown>): AdminResourceRow {
  return {
    id: stringValue(row.id),
    name: stringValue(row.public_id) || stringValue(row.url).split("/").pop() || "Asset",
    folder: stringValue(row.folder),
    provider: stringValue(row.provider),
    status: "published",
  };
}

function bookingRow(row: Record<string, unknown>): AdminResourceRow {
  return {
    id: stringValue(row.id),
    guest: stringValue(row.customer_name),
    destination: "Private enquiry",
    travelDate: stringValue(row.travel_date),
    value: "Pending",
    status: stringValue(row.status),
  };
}

function newsletterRow(row: Record<string, unknown>): AdminResourceRow {
  return {
    id: stringValue(row.id),
    email: redactEmail(stringValue(row.email)),
    locale: stringValue(row.locale_code),
    source: stringValue(row.source),
    status: row.is_active === false ? "archived" : "published",
  };
}

function translationRow(row: Record<string, unknown>): AdminResourceRow {
  return {
    id: stringValue(row.id),
    namespace: stringValue(row.namespace),
    key: stringValue(row.translation_key),
    locale: stringValue(row.locale_code).toUpperCase(),
    status: stringValue(row.status),
  };
}

function siteSectionRow(row: Record<string, unknown>): AdminResourceRow {
  return {
    id: stringValue(row.id),
    section: stringValue(row.title) || stringValue(row.key),
    owner: "CMS",
    items: 1,
    status: stringValue(row.status),
  };
}

function profileRow(row: Record<string, unknown>): AdminResourceRow {
  return {
    id: stringValue(row.id),
    name: stringValue(row.full_name) || redactEmail(stringValue(row.email)),
    role: stringValue(row.role),
    lastActive: "Backend",
    status: row.is_active === false ? "archived" : "published",
  };
}

function safeAuditValue(row: Record<string, unknown> | null) {
  if (!row) {
    return null;
  }

  const copy = { ...row };

  delete copy.customer_email;
  delete copy.customer_phone;
  delete copy.admin_notes;
  delete copy.email;

  return copy;
}

function readRowId(row: Record<string, unknown>) {
  const id = stringValue(row.id);

  return UUID_RE.test(id) ? id : undefined;
}

function normalizeRow(value: unknown) {
  if (!isRecord(value)) {
    throw new Error("Invalid database response");
  }

  return value;
}

function readPublishStatus(body: UnknownRecord): PublishStatus | undefined {
  return readEnum(body, "status", ["draft", "published", "archived"]);
}

function readBookingStatus(body: UnknownRecord): BookingStatus | undefined {
  return readEnum(body, "status", [
    "new",
    "contacted",
    "confirmed",
    "cancelled",
    "completed",
  ]);
}

function readEnum<T extends string>(
  body: UnknownRecord,
  key: string,
  values: readonly T[],
) {
  const value = readString(body, key, { max: 80 });

  if (!value) {
    return undefined;
  }

  if (!values.includes(value as T)) {
    throw new Error(`${key} is invalid`);
  }

  return value as T;
}

function readBoolean(body: UnknownRecord, key: string) {
  const value = body[key];

  if (value == null || value === "") {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${key} must be boolean`);
  }

  return value;
}

function readUuid(body: UnknownRecord, key: string) {
  const value = readString(body, key, { max: 40 });

  if (!value) {
    return undefined;
  }

  return requireUuid(value);
}

function requireUuid(value: string) {
  if (!UUID_RE.test(value)) {
    throw new Error("Invalid record id");
  }

  return value;
}

function readJsonValue(body: UnknownRecord, key: string) {
  const value = body[key];

  if (value == null) {
    return undefined;
  }

  if (!isRecord(value) && !Array.isArray(value)) {
    throw new Error(`${key} must be a JSON object or array`);
  }

  return value;
}

function pickDefined(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function numberValue(value: unknown) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : 0;
}

function redactEmail(value: string) {
  const [name, domain] = value.split("@");

  if (!name || !domain) {
    return value;
  }

  return `${name.slice(0, 1)}****@${domain}`;
}
