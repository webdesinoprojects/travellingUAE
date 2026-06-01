import {
  getPublicFooterColumns,
  getPublicHeaderNavigation,
} from "@/server/public/cms";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";

export async function GET() {
  try {
    const [header, footer] = await Promise.all([
      getPublicHeaderNavigation(),
      getPublicFooterColumns(),
    ]);

    return jsonOk({ header, footer });
  } catch (error) {
    logServerError("api.public.navigation", error);
    return jsonError(500);
  }
}
