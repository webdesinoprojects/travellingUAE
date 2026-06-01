import type { NextRequest } from "next/server";

import { jsonError, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/server/supabase/client";
import { writeAdminAuditLog } from "@/server/admin/audit";

export const dynamic = "force-dynamic";

const VALID_STATUSES = [
  "new",
  "contacted",
  "confirmed",
  "cancelled",
  "completed",
];

export async function GET(request: NextRequest) {
  try {
    const access = await verifyAdminApiAccess(request, "admin");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    if (!hasSupabaseAdminEnv()) {
      return jsonError(503, "Database is not configured.");
    }

    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const q = url.searchParams.get("q")?.trim();

    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("bookings")
      .select("id,travelers_count,travel_date,status,created_at")
      .order("created_at", { ascending: false })
      .limit(2000);

    if (statusParam && VALID_STATUSES.includes(statusParam)) {
      query = query.eq("status", statusParam);
    }

    if (q) {
      const escaped = q.replace(/[%_]/g, "\\$&");
      query = query.ilike("customer_name", `%${escaped}%`);
    }

    const result = await query;

    if (result.error) {
      throw result.error;
    }

    await writeAdminAuditLog({
      actor: access.actor,
      action: "bookings.export",
      table: "bookings",
      entityId: undefined,
      before: null,
      after: { rowCount: result.data.length, status: statusParam ?? "all" },
    });

    const csvRows = [
      ["ID", "Travelers", "Travel Date", "Status", "Created"].join(","),
      ...result.data.map((row) =>
        [
          csvCell(row.id),
          csvCell(String(row.travelers_count ?? "")),
          csvCell(row.travel_date ?? ""),
          csvCell(row.status ?? ""),
          csvCell(row.created_at ?? ""),
        ].join(","),
      ),
    ].join("\r\n");

    const truncated = result.data.length >= 2000;

    return new Response(csvRows, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bookings-${Date.now()}.csv"`,
        "Cache-Control": "no-store",
        "X-Export-Limit": "2000",
        "X-Export-Truncated": truncated ? "true" : "false",
      },
    });
  } catch (error) {
    logServerError("api.admin.bookings.export", error);
    return jsonError(500);
  }
}

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
