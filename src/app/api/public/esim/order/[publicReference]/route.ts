import { jsonError, jsonOk } from "@/server/http/response";
import { airhubRouteError } from "@/server/providers/airhub/http";
import { getPublicEsimOrder } from "@/server/providers/airhub/orders";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ publicReference: string }> },
) {
  try {
    const { publicReference } = await context.params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return jsonError(404, "Invalid eSIM order lookup.");
    }

    const order = await getPublicEsimOrder({
      publicReference,
      lookupToken: token,
    });

    return jsonOk({ order });
  } catch (error) {
    return airhubRouteError("api.public.esim.order", error);
  }
}
