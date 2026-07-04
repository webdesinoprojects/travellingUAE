import "server-only";

import { getSupabaseAdminClient } from "@/server/supabase/client";
import type {
  EsimOrderDetail,
  EsimOrderListQuery,
  EsimOrderListResult,
  EsimOrderStats,
  EsimOrderStatus,
} from "@/features/admin/esim/types";

import {
  computePageCount,
  toEsimOrderDetail,
  toEsimOrderListItem,
  type EsimOrderDetailRow,
  type EsimOrderListRow,
} from "./esim-orders-helpers";

/**
 * Admin-only data access for eSIM orders.
 *
 * Server-only. Every function returns a sanitized DTO (see the mappers): the
 * list NEVER selects sensitive fulfillment columns, and the detail exposes those
 * columns only as presence booleans. `lookup_token_hash` is never selected.
 */

// Columns for the list view — deliberately excludes all sensitive fulfillment,
// stripe, and token columns.
const LIST_COLUMNS =
  "id,public_reference,guest_email,guest_name,country_name,plan_name,plan_code,price,currency,status,paid_at,created_at";

// Columns for the detail view. The sensitive fulfillment columns are read ONLY
// so the mapper can compute presence booleans; their raw values never leave the
// server (toEsimOrderDetail drops them).
const DETAIL_COLUMNS = [
  "id",
  "public_reference",
  "status",
  "created_at",
  "updated_at",
  "expires_at",
  "guest_name",
  "guest_email",
  "guest_phone",
  "provider",
  "partner_code",
  "country_code",
  "country_name",
  "plan_code",
  "plan_name",
  "travel_date",
  "price",
  "currency",
  "supplier_price",
  "supplier_currency",
  "markup_amount",
  "pricing_rule_id",
  "paid_amount",
  "paid_currency",
  "paid_at",
  "stripe_checkout_session_id",
  "stripe_payment_intent_id",
  "stripe_completed_event_id",
  "unique_order_id",
  "provider_order_id",
  "activation_code",
  "lpa_code",
  "qr_payload",
  "apn",
  "sim_id",
  "sim_pin",
  "provider_response",
  "error_code",
].join(",");

const SEARCH_COLUMNS = [
  "public_reference",
  "guest_email",
  "plan_name",
  "country_name",
  "plan_code",
] as const;

export async function listEsimOrders(query: EsimOrderListQuery): Promise<EsimOrderListResult> {
  const supabase = getSupabaseAdminClient();

  let builder = supabase.from("esim_orders").select(LIST_COLUMNS, { count: "exact" });

  if (query.status !== "all") {
    builder = builder.eq("status", query.status);
  }

  if (query.search) {
    // `query.search` is pre-sanitized (no comma/paren/%/\ metacharacters), so
    // this .or() filter cannot be broken out of.
    const pattern = `%${query.search}%`;
    builder = builder.or(SEARCH_COLUMNS.map((column) => `${column}.ilike.${pattern}`).join(","));
  }

  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;

  const { data, error, count } = await builder
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  const total = count ?? 0;
  const rows = (data ?? []) as unknown as EsimOrderListRow[];

  return {
    items: rows.map(toEsimOrderListItem),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: computePageCount(total, query.pageSize),
  };
}

export async function getEsimOrderById(id: string): Promise<EsimOrderDetail | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("esim_orders")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  return toEsimOrderDetail(data as unknown as EsimOrderDetailRow);
}

export async function getEsimOrderStats(): Promise<EsimOrderStats> {
  const [total, paid, fulfilled, purchaseFailed] = await Promise.all([
    countOrders(),
    countOrders("paid"),
    countOrders("fulfilled"),
    countOrders("purchase_failed"),
  ]);

  return {
    total,
    paid,
    // Fulfillment is disabled, so a "paid" order is awaiting activation.
    activationPending: paid,
    fulfilled,
    purchaseFailed,
  };
}

/** Count-only query (head request) — transfers a count, never row data. */
async function countOrders(status?: EsimOrderStatus): Promise<number> {
  const supabase = getSupabaseAdminClient();
  let builder = supabase.from("esim_orders").select("id", { count: "exact", head: true });

  if (status) {
    builder = builder.eq("status", status);
  }

  const { count, error } = await builder;
  if (error) {
    throw error;
  }
  return count ?? 0;
}
