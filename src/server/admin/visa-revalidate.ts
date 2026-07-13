import "server-only";

import { revalidatePath } from "next/cache";

/**
 * Purge the public visa route caches after a CMS mutation so edits appear
 * immediately. Listing pages are force-dynamic (always fresh); the dynamic
 * detail routes are revalidated by their route pattern. Call only from a route
 * handler / server action (never during render).
 */
export function revalidateVisaPublicPaths(): void {
  revalidatePath("/global-visa");
  revalidatePath("/gulf-visa");
  revalidatePath("/global-visa/[visaSlug]", "page");
  revalidatePath("/gulf-visa/[visaSlug]", "page");
}
