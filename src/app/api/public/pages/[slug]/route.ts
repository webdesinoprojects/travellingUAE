import { getPublicCmsPage } from "@/server/public/cms";
import { jsonError, jsonOk, logServerError } from "@/server/http/response";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const page = await getPublicCmsPage(slug);

    if (!page) {
      return jsonError(404, "The requested page was not found.");
    }

    return jsonOk({ page });
  } catch (error) {
    logServerError("api.public.pages.detail", error);
    return jsonError(500);
  }
}
