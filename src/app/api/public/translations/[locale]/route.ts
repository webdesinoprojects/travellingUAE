import { type NextRequest } from "next/server";

import { jsonError, jsonOk, logServerError } from "@/server/http/response";
import { getPublicTranslations } from "@/server/public/translations";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ locale: string }> },
) {
  try {
    const { locale } = await context.params;
    const namespace = request.nextUrl.searchParams.get("namespace") ?? undefined;
    const translations = await getPublicTranslations(locale, namespace);

    return jsonOk({ translations });
  } catch (error) {
    logServerError("api.public.translations", error);
    return jsonError(500);
  }
}
