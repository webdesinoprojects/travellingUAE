import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { jsonError } from "@/server/http/response";
import { syncAirhubCountriesFromProvider } from "@/server/providers/airhub/countries";
import { airhubRouteError } from "@/server/providers/airhub/http";
import { verifyAdminApiAccess } from "@/server/supabase/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const access = await verifyAdminApiAccess(request, "admin");

    if (!access.ok) {
      return jsonError(access.status, "You are not allowed to access this area.");
    }

    const result = await syncAirhubCountriesFromProvider();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return airhubRouteError("api.admin.airhub.sync-countries", error);
  }
}
