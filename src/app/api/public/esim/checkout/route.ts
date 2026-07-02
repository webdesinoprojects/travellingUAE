import { readDateString, readJsonObject, readString, requireEmail } from "@/server/http/validation";
import { jsonError, jsonOk } from "@/server/http/response";
import { airhubRouteError } from "@/server/providers/airhub/http";
import {
  createEsimOrderFromPlan,
  createEsimStripeSession,
} from "@/server/providers/airhub/orders";
import { getAirhubPlansForCountry } from "@/server/providers/airhub/plans";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const countryCode = readString(body, "countryCode", {
      min: 2,
      max: 2,
      required: true,
    })!.toUpperCase();
    const planCode = readString(body, "planCode", {
      min: 1,
      max: 80,
      required: true,
    })!;
    const guestName = readString(body, "guestName", { max: 120 });
    const guestEmail = requireEmail(
      readString(body, "guestEmail", { max: 180, required: true }),
      "guestEmail",
    );
    const guestPhone = readString(body, "guestPhone", { max: 40 });
    const travelDate = readDateString(body, "travelDate");
    const listing = await getAirhubPlansForCountry(countryCode);

    if (listing.status === "disabled") {
      return jsonError(503, "eSIM checkout is not available.");
    }

    const plan = listing.plans.find((item) => item.planCode === planCode);
    if (!plan) {
      return jsonError(404, "This eSIM plan is no longer available.");
    }

    const order = await createEsimOrderFromPlan({
      plan,
      countryCode,
      guestName,
      guestEmail,
      guestPhone,
      travelDate,
    });
    const session = await createEsimStripeSession({
      publicReference: order.publicReference,
      lookupToken: order.lookupToken,
    });

    return jsonOk(session, { status: 201 });
  } catch (error) {
    return airhubRouteError("api.public.esim.checkout", error);
  }
}
