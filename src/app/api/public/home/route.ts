import { getPublicHomeContent } from "@/server/public/home";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";

export async function GET() {
  try {
    const home = await getPublicHomeContent();

    return jsonOk({ home });
  } catch (error) {
    logServerError("api.public.home", error);
    return jsonError(500);
  }
}
