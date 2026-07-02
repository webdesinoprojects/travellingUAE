import { jsonOk } from "@/server/http/response";
import { getLocalAirhubCountries } from "@/server/providers/airhub/countries";
import { airhubRouteError } from "@/server/providers/airhub/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const countries = await getLocalAirhubCountries({
      query: searchParams.get("q"),
      limit: Number(searchParams.get("limit") ?? 80),
    });

    return jsonOk({ countries });
  } catch (error) {
    return airhubRouteError("api.public.esim.countries", error);
  }
}
