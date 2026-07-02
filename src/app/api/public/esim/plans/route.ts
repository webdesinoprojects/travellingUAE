import { NextResponse } from "next/server";

import { jsonError, jsonOk } from "@/server/http/response";
import { toSafeAirhubPlanFetchFailure } from "@/server/providers/airhub/errors";
import { airhubRouteError } from "@/server/providers/airhub/http";
import { getAirhubPlansForCountry } from "@/server/providers/airhub/plans";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const countryCode = searchParams.get("countryCode")?.trim();

    if (!countryCode) {
      return jsonError(400, "countryCode is required.");
    }

    const listing = await getAirhubPlansForCountry(countryCode);
    return jsonOk(listing);
  } catch (error) {
    const safePlanError = toSafeAirhubPlanFetchFailure(error);

    if (safePlanError) {
      console.error("[api.public.esim.plans]", {
        code: safePlanError.code,
        status: safePlanError.status,
      });

      return NextResponse.json(
        {
          ok: false,
          code: safePlanError.code,
          message: safePlanError.message,
        },
        { status: safePlanError.status },
      );
    }

    return airhubRouteError("api.public.esim.plans", error);
  }
}
