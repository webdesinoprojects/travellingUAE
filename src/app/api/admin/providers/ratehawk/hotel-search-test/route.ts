import type { NextRequest } from "next/server";

import { writeAdminAuditLog } from "@/server/admin/audit";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { verifyAdminApiAccess } from "@/server/supabase/auth";
import { getRateHawkReadiness } from "@/server/providers/ratehawk/config";
import { mapProviderError } from "@/server/providers/ratehawk/errors";
import {
  getRateHawkOverview,
  searchHotelsByRegion,
  suggestRegionsAndHotels,
  type GuestRoom,
} from "@/server/providers/ratehawk/hotels";

export const dynamic = "force-dynamic";

type TestMode = "overview" | "suggest" | "search";

function parseMode(value: string | null): TestMode {
  if (value === "suggest" || value === "search") {
    return value;
  }

  return "overview";
}

function parseChildren(value: string | null): number[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((age) => Number.isInteger(age));
}

/**
 * GET /api/admin/providers/ratehawk/hotel-search-test
 *
 * Protected (editor+) readiness and safe hotel-search check for RateHawk/ETG.
 * Never returns credentials, auth headers or raw provider payloads. When
 * credentials are missing it returns configured=false with HTTP 200 so the
 * build and admin tooling stay healthy.
 *
 * Query:
 * - mode=overview|suggest|search (default overview)
 * - suggest: query (>=2 chars), language?
 * - search:  regionId, checkin (YYYY-MM-DD), checkout, residency (ISO-2),
 *            adults?, children? (csv ages), currency?, language?
 */
export async function GET(request: NextRequest) {
  try {
    const access = await verifyAdminApiAccess(request, "editor");

    if (!access.ok) {
      return jsonError(
        access.status,
        "You are not allowed to access this area.",
      );
    }

    const readiness = getRateHawkReadiness();

    if (!readiness.configured) {
      return jsonOk({
        configured: false,
        readiness,
        mode: null,
        result: null,
      });
    }

    const params = request.nextUrl.searchParams;
    const mode = parseMode(params.get("mode"));

    let result: unknown = null;

    try {
      if (mode === "overview") {
        result = await getRateHawkOverview(request.signal);
      } else if (mode === "suggest") {
        const query = params.get("query") ?? "";
        const language = params.get("language") ?? "en";
        result = await suggestRegionsAndHotels(
          query,
          language,
          request.signal,
        );
      } else {
        const adults = Number.parseInt(params.get("adults") ?? "2", 10);
        const room: GuestRoom = {
          adults: Number.isInteger(adults) ? adults : 2,
          children: parseChildren(params.get("children")),
        };

        result = await searchHotelsByRegion({
          regionId: Number.parseInt(params.get("regionId") ?? "", 10),
          checkin: params.get("checkin") ?? "",
          checkout: params.get("checkout") ?? "",
          residency: (params.get("residency") ?? "").toLowerCase(),
          guests: [room],
          currency: params.get("currency") ?? undefined,
          language: params.get("language") ?? undefined,
          signal: request.signal,
        });
      }
    } catch (providerError) {
      // Keep full detail in server logs only; respond generically.
      logServerError("api.admin.providers.ratehawk.hotel-search-test", providerError);
      const mapped = mapProviderError(providerError);
      return jsonError(mapped.status, mapped.message);
    }

    await writeAdminAuditLog({
      actor: access.actor,
      action: "provider.ratehawk.hotel_search_test",
      table: "external_providers",
      entityId: undefined,
      before: null,
      after: { provider: "ratehawk", env: readiness.env, mode },
    });

    return jsonOk({
      configured: true,
      readiness,
      mode,
      result,
    });
  } catch (error) {
    logServerError("api.admin.providers.ratehawk.hotel-search-test", error);
    return jsonError(400, "The provider test could not be completed.");
  }
}
