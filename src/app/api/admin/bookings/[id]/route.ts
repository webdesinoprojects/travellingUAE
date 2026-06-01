import type { NextRequest } from "next/server";

import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/server/supabase/client";
import { writeAdminAuditLog } from "@/server/admin/audit";
import { readString } from "@/server/http/validation";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BOOKING_STATUSES = [
  "new",
  "contacted",
  "confirmed",
  "cancelled",
  "completed",
] as const;

type BookingStatus = (typeof BOOKING_STATUSES)[number];

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const access = await verifyAdminApiAccess(request, "admin");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    if (!UUID_RE.test(id)) {
      return jsonError(400, "Invalid booking ID.");
    }

    if (!hasSupabaseAdminEnv()) {
      return jsonError(503, "Database is not configured.");
    }

    const supabase = getSupabaseAdminClient();
    const result = await supabase
      .from("bookings")
      .select(
        "id,customer_name,customer_email,customer_phone,travelers_count,travel_date,status,admin_notes,created_at,updated_at",
      )
      .eq("id", id)
      .single();

    if (result.error) {
      if (result.error.code === "PGRST116") {
        return jsonError(404, "Booking not found.");
      }

      throw result.error;
    }

    const row = result.data;

    return jsonOk({
      booking: {
        id: row.id,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        customerPhone: row.customer_phone,
        travelersCount: row.travelers_count,
        travelDate: row.travel_date,
        status: row.status,
        adminNotes: row.admin_notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    logServerError("api.admin.bookings.detail", error);
    return jsonError(500);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const access = await verifyAdminApiAccess(request, "admin");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    if (!UUID_RE.test(id)) {
      return jsonError(400, "Invalid booking ID.");
    }

    if (!hasSupabaseAdminEnv()) {
      return jsonError(503, "Database is not configured.");
    }

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    if (!body || typeof body !== "object") {
      return jsonError(400, "Invalid request body.");
    }

    const statusVal = readString(body as Record<string, unknown>, "status", {
      max: 20,
    });
    const notesVal = readString(
      body as Record<string, unknown>,
      "adminNotes",
      { max: 4000 },
    );

    const updates: Record<string, unknown> = {};

    if (statusVal !== undefined) {
      if (!BOOKING_STATUSES.includes(statusVal as BookingStatus)) {
        return jsonError(400, "The record could not be updated.");
      }

      updates.status = statusVal;
    }

    if (notesVal !== undefined) {
      updates.admin_notes = notesVal;
    }

    if (Object.keys(updates).length === 0) {
      return jsonError(400, "The record could not be updated.");
    }

    const supabase = getSupabaseAdminClient();
    const before = await supabase
      .from("bookings")
      .select("id,status,admin_notes")
      .eq("id", id)
      .single();

    if (before.error) {
      if (before.error.code === "PGRST116") {
        return jsonError(404, "Booking not found.");
      }

      throw before.error;
    }

    const result = await supabase
      .from("bookings")
      .update(updates)
      .eq("id", id)
      .select("id,customer_name,travelers_count,travel_date,status,admin_notes,updated_at")
      .single();

    if (result.error) {
      throw result.error;
    }

    await writeAdminAuditLog({
      actor: access.actor,
      action: "bookings.update",
      table: "bookings",
      entityId: id,
      before: { id: before.data.id, status: before.data.status },
      after: { id: result.data.id, status: result.data.status },
    });

    const row = result.data;

    return jsonOk({
      booking: {
        id: row.id,
        customerName: row.customer_name,
        travelersCount: row.travelers_count,
        travelDate: row.travel_date,
        status: row.status,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    logServerError("api.admin.bookings.update", error);
    return jsonError(400, "The record could not be updated.");
  }
}
