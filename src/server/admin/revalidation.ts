import "server-only";

import { revalidatePath } from "next/cache";

export function revalidateTripSurfaces() {
  revalidatePath("/admin/trips");
  revalidatePath("/trips");
  revalidatePath("/trips/[destination]", "page");
  revalidatePath("/trips/[destination]/[tripSlug]", "page");
}

export function revalidateNavigationSurfaces() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/navigation");
  revalidatePath("/api/public/navigation");
}

export function revalidateCmsPageSurfaces() {
  revalidatePath("/admin/pages");
  revalidatePath("/[slug]", "page");
  revalidatePath("/api/public/pages/[slug]", "page");
}

export function revalidateTranslationSurfaces() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/translations");
}
