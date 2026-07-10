import "server-only";

import { writeAdminAuditLog } from "@/server/admin/audit";
import { requireTrustedPublicMediaUrl } from "@/server/cms/hero";
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
  AdminContentStatus,
  AdminHomeCollection,
  AdminHomeCollectionItem,
  AdminHomeContent,
  AdminHomeMediaOption,
  AdminHomeSectionCopy,
  AdminHomeService,
  AdminHomeTestimonial,
} from "@/types/home";
import type { TravelIconKey } from "@/types/travel";

export type HomeContentEntity =
  | "collections"
  | "items"
  | "services"
  | "testimonials"
  | "sections";
type HomeContentRecordEntity = Exclude<HomeContentEntity, "sections">;

type DbCollection = {
  id: string;
  title: string;
  eyebrow: string | null;
  description: string | null;
  type: "flytime_picks" | "route_board" | "custom";
  status: AdminContentStatus;
  sort_order: number;
};

type DbCollectionItem = {
  id: string;
  collection_id: string;
  title: string;
  subtitle: string | null;
  price_label: string | null;
  duration_label: string | null;
  action_label: string | null;
  href: string | null;
  media_id: string | null;
  status: AdminContentStatus;
  sort_order: number;
  metadata: Record<string, unknown> | null;
};

type DbService = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string | null;
  icon: string | null;
  media_id: string | null;
  status: AdminContentStatus;
  sort_order: number;
};

type DbTestimonial = {
  id: string;
  author: string;
  quote: string;
  media_id: string | null;
  status: AdminContentStatus;
  sort_order: number;
};

type DbHomeSection = {
  id: string;
  key: string;
  title: string | null;
  eyebrow: string | null;
  description: string | null;
  payload: Record<string, unknown> | null;
  status: AdminContentStatus;
};

type DbMedia = {
  id: string;
  public_id: string | null;
  url: string;
  secure_url: string | null;
  alt_text: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const homeCollectionTypes = new Set(["flytime_picks", "route_board"]);
const homeSectionDefaults: AdminHomeSectionCopy[] = [
  {
    key: "services",
    siteSectionKey: "home.services",
    eyebrow: "Support Desk",
    title: "What We Handle",
    description:
      "Flights, stays, visas and documents presented as simple service cards that work for quick enquiries.",
    status: "draft",
    source: "fallback",
  },
  {
    key: "testimonials",
    siteSectionKey: "home.testimonials",
    eyebrow: "Traveler Voices",
    title: "Stories From The Route",
    description:
      "A bento wall of recent traveler notes, built to scan quickly without turning the page into a review feed.",
    status: "draft",
    source: "fallback",
  },
];
const homeSectionKeys = homeSectionDefaults.map((section) => section.siteSectionKey);
const iconKeys = new Set<TravelIconKey>([
  "flight",
  "hotel",
  "package",
  "hajj",
  "wellness",
  "cruise",
  "visa",
  "bus",
  "transfer",
  "car",
  "passport",
  "document",
  "insurance",
  "sim",
]);

export async function getAdminHomeContent(): Promise<AdminHomeContent> {
  if (!hasSupabaseAdminEnv()) {
    return {
      source: "unconfigured",
      sections: [],
      collections: [],
      items: [],
      services: [],
      testimonials: [],
      media: [],
    };
  }

  const supabase = getSupabaseAdminClient();
  const [
    sectionsResult,
    collectionsResult,
    itemsResult,
    servicesResult,
    testimonialsResult,
    mediaResult,
  ] =
    await Promise.all([
      supabase
        .from("site_sections")
        .select("id,key,title,eyebrow,description,payload,status")
        .in("key", homeSectionKeys),
      supabase
        .from("collections")
        .select("id,title,eyebrow,description,type,status,sort_order")
        .in("type", ["flytime_picks", "route_board"])
        .order("sort_order", { ascending: true }),
      supabase
        .from("collection_items")
        .select(
          "id,collection_id,title,subtitle,price_label,duration_label,action_label,href,media_id,status,sort_order,metadata",
        )
        .order("sort_order", { ascending: true }),
      supabase
        .from("services")
        .select("id,slug,title,summary,body,icon,media_id,status,sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("testimonials")
        .select("id,author,quote,media_id,status,sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("media_assets")
        .select("id,public_id,url,secure_url,alt_text")
        .eq("resource_type", "image")
        .eq("status", "published")
        .order("updated_at", { ascending: false })
        .limit(100),
    ]);

  for (const error of [
    sectionsResult.error,
    collectionsResult.error,
    itemsResult.error,
    servicesResult.error,
    testimonialsResult.error,
    mediaResult.error,
  ]) {
    if (error) {
      throw error;
    }
  }

  const collections = (collectionsResult.data ?? []) as DbCollection[];
  const visibleCollections = collections.filter((row) =>
    homeCollectionTypes.has(row.type),
  );
  const typeByCollectionId = new Map(
    visibleCollections.map((row) => [
      row.id,
      row.type as AdminHomeCollection["type"],
    ]),
  );

  return {
    source: "database",
    sections: mapHomeSections((sectionsResult.data ?? []) as DbHomeSection[]),
    collections: visibleCollections.map(mapCollection),
    items: ((itemsResult.data ?? []) as DbCollectionItem[])
      .filter((row) => typeByCollectionId.has(row.collection_id))
      .map((row) => mapItem(row, typeByCollectionId.get(row.collection_id)!)),
    services: ((servicesResult.data ?? []) as DbService[]).map(mapService),
    testimonials: ((testimonialsResult.data ?? []) as DbTestimonial[]).map(
      mapTestimonial,
    ),
    media: ((mediaResult.data ?? []) as DbMedia[]).flatMap(mapMedia),
  };
}

export async function createAdminHomeContent(
  entity: HomeContentEntity,
  request: Request,
  actor: AdminActor,
) {
  if (entity === "sections") {
    throw new Error("Sections are updated by key");
  }

  const recordEntity = entity as HomeContentRecordEntity;
  requireConfiguredAdmin();
  const payload = await buildPayload(
    recordEntity,
    await readJsonObject(request),
    true,
  );
  await requirePublishableContent(recordEntity, payload);
  const supabase = getSupabaseAdminClient();
  const result = await supabase
    .from(tableForEntity(recordEntity))
    .insert(payload)
    .select(selectForEntity(recordEntity))
    .single();

  if (result.error) {
    throw result.error;
  }

  const row = normalizeRecord(result.data);
  await writeAdminAuditLog({
    actor,
    action: `home.${recordEntity}.create`,
    table: tableForEntity(recordEntity),
    entityId: requireUuid(String(row.id)),
    before: null,
    after: safeAudit(recordEntity, row),
  });

  return getAdminHomeContent();
}

export async function updateAdminHomeContent(
  entity: HomeContentEntity,
  id: string,
  request: Request,
  actor: AdminActor,
) {
  if (entity === "sections") {
    return updateAdminHomeSection(id, request, actor);
  }

  const recordEntity = entity as HomeContentRecordEntity;
  requireConfiguredAdmin();
  const safeId = requireUuid(id);
  const body = await readJsonObject(request);
  const payload = await buildPayload(recordEntity, body, false);

  if (Object.keys(payload).length === 0) {
    throw new Error("No supported fields were provided");
  }

  const supabase = getSupabaseAdminClient();
  const beforeResult = await supabase
    .from(tableForEntity(recordEntity))
    .select(selectForEntity(recordEntity))
    .eq("id", safeId)
    .single();

  if (beforeResult.error) {
    throw beforeResult.error;
  }

  const before = normalizeRecord(beforeResult.data);
  await requirePublishableContent(recordEntity, { ...before, ...payload });
  const result = await supabase
    .from(tableForEntity(recordEntity))
    .update(payload)
    .eq("id", safeId)
    .select(selectForEntity(recordEntity))
    .single();

  if (result.error) {
    throw result.error;
  }

  const after = normalizeRecord(result.data);
  await writeAdminAuditLog({
    actor,
    action: `home.${recordEntity}.update`,
    table: tableForEntity(recordEntity),
    entityId: safeId,
    before: safeAudit(recordEntity, before),
    after: safeAudit(recordEntity, after),
  });

  return getAdminHomeContent();
}

export async function archiveAdminHomeContent(
  entity: HomeContentEntity,
  id: string,
  actor: AdminActor,
) {
  if (entity === "sections") {
    throw new Error("Sections cannot be archived from Home CMS");
  }

  const recordEntity = entity as HomeContentRecordEntity;
  requireConfiguredAdmin();
  const safeId = requireUuid(id);
  const supabase = getSupabaseAdminClient();
  const beforeResult = await supabase
    .from(tableForEntity(recordEntity))
    .select(selectForEntity(recordEntity))
    .eq("id", safeId)
    .single();

  if (beforeResult.error) {
    throw beforeResult.error;
  }

  const result = await supabase
    .from(tableForEntity(recordEntity))
    .update({ status: "archived" })
    .eq("id", safeId)
    .select(selectForEntity(recordEntity))
    .single();

  if (result.error) {
    throw result.error;
  }

  const before = normalizeRecord(beforeResult.data);
  const after = normalizeRecord(result.data);
  await writeAdminAuditLog({
    actor,
    action: `home.${recordEntity}.archive`,
    table: tableForEntity(recordEntity),
    entityId: safeId,
    before: safeAudit(recordEntity, before),
    after: safeAudit(recordEntity, after),
  });

  return getAdminHomeContent();
}

async function updateAdminHomeSection(
  key: string,
  request: Request,
  actor: AdminActor,
) {
  requireConfiguredAdmin();
  const definition = readHomeSectionDefinition(key);
  const body = await readJsonObject(request);
  const title = readString(body, "title", {
    min: 2,
    max: 140,
    required: true,
  })!;
  const eyebrow = readString(body, "eyebrow", { max: 100 }) ?? "";
  const description = readString(body, "description", { max: 400 }) ?? "";
  const status = readStatus(body) ?? "draft";

  if (status === "published") {
    requireTextValue(title, "Section title");
  }

  const payload = {
    eyebrow,
    title,
    subtitle: description,
  };
  const supabase = getSupabaseAdminClient();
  const beforeResult = await supabase
    .from("site_sections")
    .select("id,key,title,eyebrow,description,payload,status")
    .eq("key", definition.siteSectionKey)
    .maybeSingle();

  if (beforeResult.error) {
    throw beforeResult.error;
  }

  const before = (beforeResult.data ?? null) as DbHomeSection | null;
  const result = await supabase
    .from("site_sections")
    .upsert(
      {
        key: definition.siteSectionKey,
        title,
        eyebrow,
        description,
        payload,
        status,
      },
      { onConflict: "key" },
    )
    .select("id,key,title,eyebrow,description,payload,status")
    .single();

  if (result.error) {
    throw result.error;
  }

  const after = result.data as DbHomeSection;
  await writeAdminAuditLog({
    actor,
    action: "home.sections.update",
    table: "site_sections",
    entityId: after.id,
    before: before ? safeHomeSectionAudit(before, definition) : null,
    after: safeHomeSectionAudit(after, definition),
  });

  return getAdminHomeContent();
}

async function buildPayload(
  entity: HomeContentRecordEntity,
  body: UnknownRecord,
  creating: boolean,
) {
  switch (entity) {
    case "collections":
      return requireCreateFields(
        compact({
          slug: readString(body, "slug", { min: 2, max: 140 }),
          title: readString(body, "title", {
            min: 2,
            max: 140,
            required: creating,
          }),
          eyebrow: readString(body, "eyebrow", { max: 100 }),
          description: readString(body, "description", { max: 400 }),
          type: readCollectionType(body),
          status: readStatus(body),
          sort_order: readNumber(body, "sortOrder", { min: 0, max: 10000 }),
        }),
        creating ? ["slug", "title", "type"] : [],
      );
    case "items": {
      const title = readString(body, "title", {
        min: 2,
        max: 140,
        required: creating,
      });
      const mediaId = await readValidatedMediaId(body);
      return requireCreateFields(
        compact({
          collection_id: readRequiredUuid(body, "collectionId", creating),
          title,
          subtitle: readString(body, "subtitle", { max: 220 }),
          price_label: readString(body, "priceLabel", { max: 60 }),
          duration_label: readString(body, "durationLabel", { max: 60 }),
          action_label: readString(body, "actionLabel", { max: 40 }),
          href: readInternalHref(body),
          media_id: mediaId,
          status: readStatus(body),
          sort_order: readNumber(body, "sortOrder", { min: 0, max: 10000 }),
          metadata: readLayoutMetadata(body),
        }),
        creating ? ["collection_id", "title", "href", "media_id"] : [],
      );
    }
    case "services": {
      const title = readString(body, "title", {
        min: 2,
        max: 140,
        required: creating,
      });
      return requireCreateFields(
        compact({
          slug:
            readString(body, "slug", { max: 140 }) ??
            (creating && title ? slugify(title) : undefined),
          title,
          summary: readString(body, "summary", { max: 260 }),
          body: readString(body, "body", { max: 1500 }),
          icon: readIcon(body),
          media_id: await readValidatedMediaId(body),
          status: readStatus(body),
          sort_order: readNumber(body, "sortOrder", { min: 0, max: 10000 }),
        }),
        creating ? ["slug", "title", "media_id"] : [],
      );
    }
    case "testimonials":
      return requireCreateFields(
        compact({
          author: readString(body, "author", {
            min: 2,
            max: 120,
            required: creating,
          }),
          quote: readString(body, "quote", {
            min: 10,
            max: 700,
            required: creating,
          }),
          media_id: await readValidatedMediaId(body),
          status: readStatus(body),
          sort_order: readNumber(body, "sortOrder", { min: 0, max: 10000 }),
        }),
        creating ? ["author", "quote"] : [],
      );
  }
}

async function readValidatedMediaId(body: UnknownRecord) {
  if (!Object.prototype.hasOwnProperty.call(body, "mediaId")) {
    return undefined;
  }

  if (body.mediaId === "" || body.mediaId === null) {
    return null;
  }

  if (typeof body.mediaId !== "string") {
    throw new Error("mediaId is invalid");
  }

  const id = requireUuid(body.mediaId);
  const result = await getSupabaseAdminClient()
    .from("media_assets")
    .select("url,secure_url")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (result.error || !result.data) {
    throw result.error ?? new Error("Media was not found");
  }

  const media = result.data as { url: string; secure_url: string | null };
  requireTrustedPublicMediaUrl(media.secure_url ?? media.url);

  return id;
}

function readRequiredUuid(
  body: UnknownRecord,
  key: string,
  required: boolean,
) {
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

function readLayoutMetadata(body: UnknownRecord) {
  if (!Object.prototype.hasOwnProperty.call(body, "layout")) {
    return undefined;
  }

  const value = readString(body, "layout", { max: 20 });

  if (!value || !["featured", "wide", "small"].includes(value)) {
    throw new Error("layout is invalid");
  }

  return { size: value };
}

function readStatus(body: UnknownRecord) {
  if (!Object.prototype.hasOwnProperty.call(body, "status")) {
    return undefined;
  }

  const value = readString(body, "status", { max: 20 });

  if (
    value !== "draft" &&
    value !== "published" &&
    value !== "archived"
  ) {
    throw new Error("status is invalid");
  }

  return value;
}

function readCollectionType(body: UnknownRecord) {
  if (!Object.prototype.hasOwnProperty.call(body, "type")) {
    return undefined;
  }

  const value = readString(body, "type", { max: 30 });

  if (!value || !homeCollectionTypes.has(value)) {
    throw new Error("collection type is invalid");
  }

  return value;
}

function readIcon(body: UnknownRecord) {
  if (!Object.prototype.hasOwnProperty.call(body, "icon")) {
    return undefined;
  }

  const value = readString(body, "icon", { max: 30 });

  if (!value || !iconKeys.has(value as TravelIconKey)) {
    throw new Error("icon is invalid");
  }

  return value;
}

async function requirePublishableContent(
  entity: HomeContentRecordEntity,
  row: Record<string, unknown>,
) {
  if (row.status !== "published") {
    return;
  }

  if (entity === "collections") {
    requireTextValue(row.title, "Collection title");
    return;
  }

  if (entity === "items") {
    requireTextValue(row.title, "Card title");
    requireTextValue(row.price_label, "Card price");
    requireTextValue(row.action_label, "Card action");
    requireTextValue(row.href, "Card link");
    requireTextValue(row.media_id, "Card media");

    const collectionId = requireUuid(String(row.collection_id));
    const result = await getSupabaseAdminClient()
      .from("collections")
      .select("type")
      .eq("id", collectionId)
      .maybeSingle();

    if (result.error || !result.data) {
      throw result.error ?? new Error("Collection was not found");
    }

    const type = (result.data as { type: string }).type;

    if (!homeCollectionTypes.has(type)) {
      throw new Error("Card collection is not a homepage section");
    }

    if (type === "route_board") {
      requireTextValue(row.duration_label, "Route duration");
    }

    return;
  }

  if (entity === "services") {
    requireTextValue(row.title, "Service title");
    requireTextValue(row.summary, "Service summary");
    requireTextValue(row.icon, "Service icon");
    requireTextValue(row.media_id, "Service media");
    return;
  }

  requireTextValue(row.author, "Testimonial author");
  requireTextValue(row.quote, "Testimonial quote");
}

function mapHomeSections(rows: DbHomeSection[]): AdminHomeSectionCopy[] {
  const byKey = new Map(rows.map((row) => [row.key, row]));

  return homeSectionDefaults.map((definition) => {
    const row = byKey.get(definition.siteSectionKey);

    if (!row) {
      return definition;
    }

    const payload = row.payload ?? {};
    const eyebrow =
      readPayloadText(payload.eyebrow) ?? row.eyebrow?.trim() ?? "";
    const title = readPayloadText(payload.title) ?? row.title?.trim() ?? "";
    const description =
      readPayloadText(payload.subtitle) ??
      readPayloadText(payload.description) ??
      row.description?.trim() ??
      "";

    return {
      id: row.id,
      key: definition.key,
      siteSectionKey: definition.siteSectionKey,
      eyebrow: eyebrow || definition.eyebrow,
      title: title || definition.title,
      description: description || definition.description,
      status: row.status,
      source: "database",
    };
  });
}

function mapCollection(row: DbCollection): AdminHomeCollection {
  return {
    id: row.id,
    title: row.title,
    eyebrow: row.eyebrow ?? "",
    description: row.description ?? "",
    type: row.type as AdminHomeCollection["type"],
    status: row.status,
    sortOrder: row.sort_order,
  };
}

function mapItem(
  row: DbCollectionItem,
  collectionType: AdminHomeCollection["type"],
): AdminHomeCollectionItem {
  const layout = row.metadata?.size;

  return {
    id: row.id,
    collectionId: row.collection_id,
    collectionType,
    title: row.title,
    subtitle: row.subtitle ?? "",
    priceLabel: row.price_label ?? "",
    durationLabel: row.duration_label ?? "",
    actionLabel: row.action_label ?? "",
    href: row.href ?? "",
    mediaId: row.media_id ?? "",
    status: row.status,
    sortOrder: row.sort_order,
    layout:
      layout === "featured" || layout === "wide" || layout === "small"
        ? layout
        : "small",
  };
}

function mapService(row: DbService): AdminHomeService {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? "",
    body: row.body ?? "",
    icon: iconKeys.has(row.icon as TravelIconKey)
      ? (row.icon as TravelIconKey)
      : "package",
    mediaId: row.media_id ?? "",
    status: row.status,
    sortOrder: row.sort_order,
  };
}

function mapTestimonial(row: DbTestimonial): AdminHomeTestimonial {
  return {
    id: row.id,
    author: row.author,
    quote: row.quote,
    mediaId: row.media_id ?? "",
    status: row.status,
    sortOrder: row.sort_order,
  };
}

function mapMedia(row: DbMedia): AdminHomeMediaOption[] {
  const imageUrl = row.secure_url ?? row.url;

  try {
    requireTrustedPublicMediaUrl(imageUrl);
  } catch {
    return [];
  }

  return [
    {
      id: row.id,
      label: row.public_id ?? row.alt_text ?? "Image asset",
      imageUrl,
      imageAlt: row.alt_text ?? "",
    },
  ];
}

function selectForEntity(entity: HomeContentRecordEntity) {
  switch (entity) {
    case "collections":
      return "id,title,eyebrow,description,type,status,sort_order";
    case "items":
      return "id,collection_id,title,subtitle,price_label,duration_label,action_label,href,media_id,status,sort_order,metadata";
    case "services":
      return "id,slug,title,summary,body,icon,media_id,status,sort_order";
    case "testimonials":
      return "id,author,quote,media_id,status,sort_order";
  }
}

function tableForEntity(entity: HomeContentRecordEntity) {
  return entity === "items" ? "collection_items" : entity;
}

function requireConfiguredAdmin() {
  if (!hasSupabaseAdminEnv()) {
    throw new Error("Admin database is not configured");
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

function safeAudit(entity: HomeContentRecordEntity, row: Record<string, unknown>) {
  const allowed = selectForEntity(entity).split(",");

  return Object.fromEntries(
    allowed
      .filter((key) => key !== "body")
      .map((key) => [key, row[key] ?? null]),
  );
}

function safeHomeSectionAudit(
  row: DbHomeSection,
  definition: AdminHomeSectionCopy,
) {
  return {
    key: definition.siteSectionKey,
    status: row.status,
    section: mapHomeSections([row]).find(
      (item) => item.key === definition.key,
    ),
  };
}

function readHomeSectionDefinition(key: string) {
  const definition = homeSectionDefaults.find(
    (section) => section.key === key || section.siteSectionKey === key,
  );

  if (!definition) {
    throw new Error("Unknown homepage section");
  }

  return definition;
}

function readPayloadText(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
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

function requireTextValue(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required for published content`);
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
