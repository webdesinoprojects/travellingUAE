import { jsonOk } from "@/server/http/response";
import { readJsonObject, readString } from "@/server/http/validation";
import { airhubRouteError } from "@/server/providers/airhub/http";
import { createEsimStripeSession } from "@/server/providers/airhub/orders";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ publicReference: string }> },
) {
  try {
    const { publicReference } = await context.params;
    const body = await readJsonObject(request);
    const lookupToken = readString(body, "lookupToken", {
      min: 20,
      max: 200,
      required: true,
    })!;
    const session = await createEsimStripeSession({
      publicReference,
      lookupToken,
    });

    return jsonOk(session);
  } catch (error) {
    return airhubRouteError("api.public.esim.order.stripe-session", error);
  }
}
