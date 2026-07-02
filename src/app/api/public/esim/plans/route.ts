import { jsonError, jsonOk } from "@/server/http/response";
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
    return airhubRouteError("api.public.esim.plans", error);
  }
}
