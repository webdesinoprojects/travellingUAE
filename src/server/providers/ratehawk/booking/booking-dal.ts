import "server-only";

import { randomUUID } from "node:crypto";

import { getSupabaseAdminClient } from "@/server/supabase/client";
import type { BookingContext, BookingRepository } from "./orchestrator.ts";
import type {
  BookingState,
  ParsedPaymentType,
  RoomGuests,
  RoomOccupancy,
} from "./contracts.ts";

const PG_UNIQUE_VIOLATION = "23505";

const BOOKING_CONTEXT_COLUMNS = `id,
  provider_order_status,
  provider_status_version,
  provider_attempt_count,
  provider_partner_order_id,
  provider_order_item_id,
  provider_booking_cutoff_at,
  provider_payment_type,
  provider_payment_types,
  provider_is_gender_specification_required,
  customer_email,
  customer_first_name,
  customer_last_name,
  customer_phone,
  travelers_count,
  option_session_id,
  metadata`;

/** Parse a persisted provider_payment_types jsonb value into ParsedPaymentType[]. */
function parseStoredPaymentTypes(raw: unknown): ParsedPaymentType[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedPaymentType[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    if (
      typeof r.type === "string" &&
      typeof r.amount === "string" &&
      typeof r.currencyCode === "string"
    ) {
      out.push({
        type: r.type,
        amount: r.amount,
        currencyCode: r.currencyCode,
        isNeedCreditCardData: r.isNeedCreditCardData === true,
        isNeedCvc: r.isNeedCvc === true,
      });
    }
  }
  return out;
}

function parseStoredCheckoutGuestRooms(raw: unknown): RoomGuests[] | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }

  const rooms: RoomGuests[] = [];

  for (const room of raw) {
    if (!room || typeof room !== "object" || Array.isArray(room)) {
      return null;
    }

    const rawGuests = (room as Record<string, unknown>).guests;

    if (!Array.isArray(rawGuests) || rawGuests.length === 0) {
      return null;
    }

    const guests: RoomGuests["guests"] = [];

    for (const guest of rawGuests) {
      if (!guest || typeof guest !== "object" || Array.isArray(guest)) {
        return null;
      }

      const rec = guest as Record<string, unknown>;
      const firstName = typeof rec.firstName === "string" ? rec.firstName.trim() : "";
      const lastName = typeof rec.lastName === "string" ? rec.lastName.trim() : "";
      const gender =
        rec.gender === "male" || rec.gender === "female" || rec.gender === "unknown"
          ? rec.gender
          : undefined;

      if (!firstName || !lastName) {
        return null;
      }

      guests.push({
        firstName,
        lastName,
        ...(gender ? { gender } : {}),
        ...(rec.isChild === true ? { isChild: true } : {}),
        ...(typeof rec.age === "number" && Number.isInteger(rec.age)
          ? { age: rec.age }
          : {}),
      });
    }

    rooms.push({ guests });
  }

  return rooms.length > 0 ? rooms : null;
}

/** Map a bookings row (selected with BOOKING_CONTEXT_COLUMNS) to a BookingContext. */
async function mapBookingRowToContext(
  row: Record<string, unknown>,
): Promise<BookingContext> {
  // Resolve prebook hash + exact occupancy through the
  // option session -> selection -> prebook snapshot -> original quote snapshot chain.
  const { prebookHash, occupancy } = await resolvePrebookContext(
    row.option_session_id as string | null,
  );

  // Resolve stored user IP from booking metadata if captured at checkout.
  const meta = row.metadata as Record<string, unknown> | null;
  const userIp = typeof meta?.user_ip === "string" ? (meta.user_ip as string) : null;
  const checkoutGuestRooms = parseStoredCheckoutGuestRooms(meta?.checkout_guest_rooms);

  // Resolve payment type from booking column (set when job is enqueued).
  const rawPaymentType = row.provider_payment_type as string | null;
  const paymentType =
    rawPaymentType === "now" ? "now" : rawPaymentType === "deposit" ? "deposit" : "hotel";

  return {
    bookingId: row.id as string,
    providerOrderStatus: (row.provider_order_status as BookingState | null) ?? null,
    providerStatusVersion: (row.provider_status_version as number) ?? 0,
    providerAttemptCount: (row.provider_attempt_count as number) ?? 0,
    providerPartnerOrderId: (row.provider_partner_order_id as string | null) ?? null,
    providerBookingCutoffAt: (row.provider_booking_cutoff_at as string | null) ?? null,
    prebookHash: prebookHash ?? "",
    customerEmail: (row.customer_email as string) ?? "",
    customerFirstName: (row.customer_first_name as string | null) ?? null,
    customerLastName: (row.customer_last_name as string | null) ?? null,
    customerPhone: (row.customer_phone as string | null) ?? null,
    travelersCount: (row.travelers_count as number) ?? 1,
    language: "en",
    paymentType,
    userIp,
    occupancy,
    checkoutGuestRooms,
    providerPaymentTypes: parseStoredPaymentTypes(row.provider_payment_types),
    isGenderSpecificationRequired: row.provider_is_gender_specification_required === true,
  };
}

// ---- Supabase booking repository ------------------------------------------

/**
 * Production BookingRepository backed by Supabase admin client.
 *
 * All mutations are explicit and version-checked. No raw provider payloads,
 * hashes, or PII are stored in the event/job tables.
 *
 * NOTE: These tables are added by migration 20260613090000_provider_booking_state.sql
 * (not applied yet). The query shapes here match that migration exactly.
 */
export function createSupabaseBookingRepository(): BookingRepository {
  return {
    async getBookingContext(bookingId) {
      const supabase = getSupabaseAdminClient();

      const { data: booking, error: bookingErr } = await supabase
        .from("bookings")
        .select(BOOKING_CONTEXT_COLUMNS)
        .eq("id", bookingId)
        .single();

      if (bookingErr || !booking) return null;

      return mapBookingRowToContext(booking as Record<string, unknown>);
    },

    async transitionState({ bookingId, toState, expectedVersion, patch }) {
      const supabase = getSupabaseAdminClient();

      const update: Record<string, unknown> = {
        provider_order_status: toState,
        provider_status_version: expectedVersion + 1,
        provider_last_status_at: new Date().toISOString(),
      };

      if (patch) {
        if (patch.providerPartnerOrderId !== undefined)
          update.provider_partner_order_id = patch.providerPartnerOrderId;
        if (patch.providerAttemptCount !== undefined)
          update.provider_attempt_count = patch.providerAttemptCount;
        if (patch.providerResultCode !== undefined)
          update.provider_result_code = patch.providerResultCode;
        if (patch.providerBookingCutoffAt !== undefined)
          update.provider_booking_cutoff_at = patch.providerBookingCutoffAt;
        if (patch.providerConfirmedAt !== undefined)
          update.provider_confirmed_at = patch.providerConfirmedAt;
        if (patch.providerCancelledAt !== undefined)
          update.provider_cancelled_at = patch.providerCancelledAt;
      }

      const { data, error } = await supabase
        .from("bookings")
        .update(update)
        .eq("id", bookingId)
        .eq("provider_status_version", expectedVersion)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      return data !== null;
    },

    async createAttempt({ bookingId, partnerOrderId, attemptNumber }) {
      const supabase = getSupabaseAdminClient();

      const { data, error } = await supabase
        .from("provider_booking_attempts")
        .insert({
          booking_id: bookingId,
          partner_order_id: partnerOrderId,
          attempt_number: attemptNumber,
          status: "pending",
        })
        .select("id")
        .single();

      if (error) throw error;
      return (data as { id: string }).id;
    },

    async updateAttemptStatus(partnerOrderId, status, errorCode) {
      const supabase = getSupabaseAdminClient();

      const update: Record<string, unknown> = {
        status,
        completed_at:
          status === "completed" || status === "failed" ? new Date().toISOString() : null,
      };

      if (errorCode) update.error_code = errorCode;

      const { error } = await supabase
        .from("provider_booking_attempts")
        .update(update)
        .eq("partner_order_id", partnerOrderId);

      if (error) throw error;
    },

    async appendEvent(event) {
      const supabase = getSupabaseAdminClient();

      const { error } = await supabase.from("provider_booking_events").insert({
        booking_id: event.bookingId,
        job_id: event.jobId ?? null,
        step: event.step,
        outcome: event.outcome,
        provider_result_code: event.providerResultCode ?? null,
        http_status: event.httpStatus ?? null,
        from_state: event.fromState ?? null,
        to_state: event.toState ?? null,
        attempt: event.attempt ?? null,
        note: event.note ?? null,
      });

      if (error) throw error;
    },

    async enqueueJob(job) {
      const supabase = getSupabaseAdminClient();

      const runAfter = new Date(Date.now() + job.runAfterMs).toISOString();

      // Idempotent enqueue: the unique dedupe_key index guarantees at most one
      // job per logical action (no duplicate poll/cancel/sync for the same
      // attempt/event). On conflict we no-op and return the EXISTING job id.
      const insert = await supabase
        .from("provider_booking_jobs")
        .insert({
          booking_id: job.bookingId,
          job_type: job.jobType,
          status: "queued",
          dedupe_key: job.dedupeKey,
          run_after: runAfter,
          max_attempts: job.maxAttempts,
          partner_order_id: job.partnerOrderId ?? null,
          payload: job.payload,
        })
        .select("id")
        .maybeSingle();

      if (!insert.error && insert.data) {
        return (insert.data as { id: string }).id;
      }
      if (insert.error && insert.error.code !== PG_UNIQUE_VIOLATION) {
        throw insert.error;
      }

      // Conflict (or no row returned): return the existing queued/in-progress job.
      const existing = await supabase
        .from("provider_booking_jobs")
        .select("id")
        .eq("dedupe_key", job.dedupeKey)
        .maybeSingle();
      if (existing.error) throw existing.error;
      return (existing.data as { id: string } | null)?.id ?? "";
    },

    async storeCreateBookingResult({
      bookingId,
      orderId,
      itemId,
      paymentTypes,
      isGenderSpecificationRequired,
    }) {
      const supabase = getSupabaseAdminClient();
      const patch: Record<string, unknown> = {
        // payment_types stored as sanitized JSON: type/amount/currency + need-card
        // flags only. NO card data is ever stored.
        provider_payment_types: paymentTypes,
        provider_is_gender_specification_required: isGenderSpecificationRequired,
      };
      if (orderId != null) patch.provider_order_id = orderId;
      if (itemId != null) patch.provider_order_item_id = itemId;

      const { error } = await supabase.from("bookings").update(patch).eq("id", bookingId);
      if (error) throw error;
    },
  };
}

// ---- Job-worker DB helpers -------------------------------------------------

export type JobRow = {
  id: string;
  booking_id: string;
  job_type: string;
  status: string;
  attempts: number;
  max_attempts: number;
  partner_order_id: string | null;
  payload: Record<string, unknown>;
};

const JOB_SELECT =
  "id, booking_id, job_type, status, attempts, max_attempts, partner_order_id, payload";

const JOB_LEASE_MS = 120_000;

/**
 * Atomically claim a specific job and return its full row. A job is claimable
 * ONLY when it is DUE (run_after <= now) AND either queued OR its previous lease
 * has expired (status='leased' AND leased_until < now) - so a crashed worker's
 * job is recoverable without ever double-running an actively-leased job.
 *
 * Service-role only (RLS: editors read, service role bypasses). Returns null if
 * the job is not found, not due, or actively leased by someone else.
 */
export async function claimAndGetJob(
  jobId: string,
  workerId: string,
): Promise<JobRow | null> {
  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const leaseUntil = new Date(Date.now() + JOB_LEASE_MS).toISOString();

  const { data, error } = await supabase
    .from("provider_booking_jobs")
    .update({
      status: "leased",
      lease_owner: workerId,
      leased_until: leaseUntil,
      locked_at: nowIso,
    })
    .eq("id", jobId)
    .lte("run_after", nowIso)
    // queued, OR a leased job whose lease has expired (crash recovery).
    .or(`status.eq.queued,and(status.eq.leased,leased_until.lt.${nowIso})`)
    .select(JOB_SELECT)
    .maybeSingle();

  if (error) throw error;
  return data as JobRow | null;
}

export async function incrementJobAttempts(jobId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  // Read current, then write incremented value.
  const { data } = await supabase
    .from("provider_booking_jobs")
    .select("attempts")
    .eq("id", jobId)
    .single();
  const current = (data as { attempts?: number } | null)?.attempts ?? 0;
  await supabase
    .from("provider_booking_jobs")
    .update({ attempts: current + 1 })
    .eq("id", jobId);
}

export async function markJobSucceeded(jobId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("provider_booking_jobs")
    .update({ status: "succeeded" })
    .eq("id", jobId);
  if (error) throw error;
}

export async function markJobFailed(jobId: string, errorCode: string | null): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("provider_booking_jobs")
    .update({ status: "failed", last_error_code: errorCode ?? null })
    .eq("id", jobId);
  if (error) throw error;
}

export async function markJobDead(jobId: string, errorCode: string | null): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("provider_booking_jobs")
    .update({ status: "dead", last_error_code: errorCode ?? null })
    .eq("id", jobId);
  if (error) throw error;
}

export async function requeueJob(
  jobId: string,
  runAfterMs: number,
  errorCode: string | null,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const runAfter = new Date(Date.now() + runAfterMs).toISOString();
  const { error } = await supabase
    .from("provider_booking_jobs")
    .update({ status: "queued", run_after: runAfter, last_error_code: errorCode ?? null })
    .eq("id", jobId);
  if (error) throw error;
}

// ---- Webhook event store (prompt 04; hardened) -----------------------------

import type {
  WebhookEventStore,
  WebhookReceipt,
  ReceiptClaim,
} from "./webhook-handler.ts";

/** Webhook receipt lease window. A crashed processor's lease expires after this. */
const WEBHOOK_LEASE_MS = 60_000;

/**
 * Supabase-backed WebhookEventStore with claim/lease idempotency (service-role
 * only; RLS gives editors read access and the service role bypasses RLS).
 *
 * A receipt is marked 'processed' ONLY after its side effects are durably
 * applied. A duplicate already-processed delivery is reported so the route can
 * 200; an unprocessed/'failed'/stale-lease receipt is re-claimed and retried.
 */
export function createWebhookEventStore(): WebhookEventStore {
  return {
    async claimReceipt(receipt: WebhookReceipt): Promise<ReceiptClaim> {
      const supabase = getSupabaseAdminClient();
      const lockedBy = randomUUID();
      const nowIso = new Date().toISOString();
      const leaseUntil = new Date(Date.now() + WEBHOOK_LEASE_MS).toISOString();

      // 1. Try to INSERT a fresh receipt already in 'processing' (we own it).
      const insert = await supabase
        .from("provider_booking_webhook_events")
        .insert({
          dedupe_key: receipt.dedupeKey,
          booking_id: receipt.bookingId,
          partner_order_id: receipt.partnerOrderId,
          raw_status: receipt.rawStatus,
          normalized_outcome: receipt.normalizedOutcome,
          signature_valid: receipt.signatureValid,
          status: "processing",
          attempt_count: 1,
          locked_at: nowIso,
          locked_until: leaseUntil,
          locked_by: lockedBy,
        })
        .select("id")
        .maybeSingle();

      if (!insert.error) return "claimed";
      if (insert.error.code !== PG_UNIQUE_VIOLATION) throw insert.error;

      // 2. Row exists. Atomically claim it ONLY if it is not processed and its
      //    lease is free/expired. The WHERE guard makes this race-safe.
      const claim = await supabase
        .from("provider_booking_webhook_events")
        .update({
          status: "processing",
          locked_at: nowIso,
          locked_until: leaseUntil,
          locked_by: lockedBy,
        })
        .eq("dedupe_key", receipt.dedupeKey)
        .neq("status", "processed")
        .or(`locked_until.is.null,locked_until.lt.${nowIso}`)
        .select("id")
        .maybeSingle();

      if (claim.error) throw claim.error;
      if (claim.data) {
        // Bump attempt_count for the reclaim (best-effort, non-atomic counter).
        const { data: cur } = await supabase
          .from("provider_booking_webhook_events")
          .select("attempt_count")
          .eq("dedupe_key", receipt.dedupeKey)
          .maybeSingle();
        const next = ((cur as { attempt_count?: number } | null)?.attempt_count ?? 0) + 1;
        await supabase
          .from("provider_booking_webhook_events")
          .update({ attempt_count: next })
          .eq("dedupe_key", receipt.dedupeKey);
        return "claimed";
      }

      // 3. Could not claim: either already processed, or another active lease.
      const { data: row } = await supabase
        .from("provider_booking_webhook_events")
        .select("status")
        .eq("dedupe_key", receipt.dedupeKey)
        .maybeSingle();
      return (row as { status?: string } | null)?.status === "processed"
        ? "already_processed"
        : "in_progress";
    },

    async markProcessed(dedupeKey, httpStatus, bookingId) {
      const supabase = getSupabaseAdminClient();
      const patch: Record<string, unknown> = {
        status: "processed",
        processed_at: new Date().toISOString(),
        http_status: httpStatus,
        locked_until: null,
        locked_by: null,
        error_message: null,
      };
      if (bookingId) patch.booking_id = bookingId;
      const { error } = await supabase
        .from("provider_booking_webhook_events")
        .update(patch)
        .eq("dedupe_key", dedupeKey);
      if (error) throw error;
    },

    async markFailed(dedupeKey, httpStatus, errorMessage) {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase
        .from("provider_booking_webhook_events")
        .update({
          status: "failed",
          http_status: httpStatus,
          error_message: errorMessage.slice(0, 200),
          locked_until: null, // release the lease so the next delivery re-claims
          locked_by: null,
        })
        .eq("dedupe_key", dedupeKey);
      if (error) throw error;
    },

    async getBookingByPartnerOrderId(partnerOrderId) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from("bookings")
        .select(BOOKING_CONTEXT_COLUMNS)
        .eq("provider_partner_order_id", partnerOrderId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapBookingRowToContext(data as Record<string, unknown>);
    },
  };
}

// ---- Post-booking repository (prompt 05) ----------------------------------

import type { PostBookingRepository } from "./post-booking.ts";

/**
 * PostBookingRepository: the base booking repo plus order-info persistence and
 * the SEPARATE refund state machine. Used by the cancel + order-info workers.
 */
export function createSupabasePostBookingRepository(): PostBookingRepository {
  const base = createSupabaseBookingRepository();

  return {
    ...base,

    async storeOrderInfo({ bookingId, hotelConfirmationNumber, penaltyAmount, penaltyCurrency }) {
      const supabase = getSupabaseAdminClient();
      const patch: Record<string, unknown> = {
        provider_order_info_synced_at: new Date().toISOString(),
      };
      // Only write fields we actually resolved; never clobber with null.
      if (hotelConfirmationNumber != null)
        patch.provider_hotel_confirmation_number = hotelConfirmationNumber;
      if (penaltyAmount != null) patch.provider_cancel_penalty_amount = penaltyAmount;
      if (penaltyCurrency != null) patch.provider_cancel_penalty_currency = penaltyCurrency;

      const { error } = await supabase.from("bookings").update(patch).eq("id", bookingId);
      if (error) throw error;
    },

    async setRefundState(bookingId, state) {
      const supabase = getSupabaseAdminClient();
      // Refund machine is separate; only move 'none' -> 'review' here (idempotent).
      const { error } = await supabase
        .from("bookings")
        .update({ provider_refund_state: state })
        .eq("id", bookingId)
        .eq("provider_refund_state", "none");
      if (error) throw error;
    },
  };
}

// ---- Prebook hash + occupancy resolution -----------------------------------

/** Parse `safe_payload.guests` ([{adults, children:number[]}]) into RoomOccupancy[]. */
function parseOccupancy(raw: unknown): RoomOccupancy[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const rooms: RoomOccupancy[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const rec = entry as Record<string, unknown>;
    const adults =
      typeof rec.adults === "number" && Number.isInteger(rec.adults) ? rec.adults : null;
    if (!adults || adults < 1) return null;
    const childrenAges = Array.isArray(rec.children)
      ? (rec.children as unknown[])
          .map((c) => (typeof c === "number" && Number.isInteger(c) ? c : null))
          .filter((n): n is number => n !== null)
      : [];
    rooms.push({ adults, childrenAges });
  }
  return rooms.length > 0 ? rooms : null;
}

/**
 * Resolve the server-only prebook hash AND the exact searched occupancy.
 *
 * Chain: option session -> selected selection -> prebook snapshot
 * (metadata.prebook_hash + metadata.quote_snapshot_id) -> original quote
 * snapshot (safe_payload.guests). Occupancy lives on the ORIGINAL quote
 * snapshot, not the prebook snapshot.
 */
async function resolvePrebookContext(
  optionSessionId: string | null,
): Promise<{ prebookHash: string | null; occupancy: RoomOccupancy[] | null }> {
  const empty = { prebookHash: null, occupancy: null };
  if (!optionSessionId) return empty;

  const supabase = getSupabaseAdminClient();

  // Find the selected option for this session.
  const { data: selection, error: selErr } = await supabase
    .from("trip_option_selections")
    .select("metadata")
    .eq("session_id", optionSessionId)
    .eq("status", "selected")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selErr || !selection) return empty;

  const selMeta = (selection as { metadata: Record<string, unknown> | null }).metadata;
  const snapshotId =
    typeof selMeta?.prebook_snapshot_id === "string" ? selMeta.prebook_snapshot_id : null;
  if (!snapshotId) return empty;

  // Prebook snapshot: prebook_hash + link back to the original quote snapshot.
  const { data: snapshot, error: snapErr } = await supabase
    .from("provider_quote_snapshots")
    .select("metadata")
    .eq("id", snapshotId)
    .single();

  if (snapErr || !snapshot) return empty;

  const snapMeta = (snapshot as { metadata: Record<string, unknown> | null }).metadata;
  const prebookHash =
    typeof snapMeta?.prebook_hash === "string" ? snapMeta.prebook_hash : null;
  const quoteSnapshotId =
    typeof snapMeta?.quote_snapshot_id === "string" ? snapMeta.quote_snapshot_id : null;

  if (!quoteSnapshotId) return { prebookHash, occupancy: null };

  // Original quote snapshot: safe_payload.guests holds the exact occupancy.
  const { data: quote, error: quoteErr } = await supabase
    .from("provider_quote_snapshots")
    .select("safe_payload")
    .eq("id", quoteSnapshotId)
    .single();

  if (quoteErr || !quote) return { prebookHash, occupancy: null };

  const safePayload = (quote as { safe_payload: Record<string, unknown> | null }).safe_payload;
  const occupancy = parseOccupancy(safePayload?.guests);

  return { prebookHash, occupancy };
}
