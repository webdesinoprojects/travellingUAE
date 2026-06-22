import "server-only";

import { getSupabaseAdminClient } from "@/server/supabase/client";

export type LocalHotelContent = {
  hotelId: string;
  name: string;
  starRating: number | null;
  imageUrl: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function getLocalHotelContent(
  providerId: string,
  hotelIds: string[],
  language = "en",
) {
  const uniqueIds = [...new Set(hotelIds.filter(Boolean))].slice(0, 300);
  if (uniqueIds.length === 0) return new Map<string, LocalHotelContent>();

  const result = await getSupabaseAdminClient()
    .from("provider_hotel_content")
    .select(
      "hotel_id,name,star_rating,primary_image_url,address,latitude,longitude",
    )
    .eq("provider_id", providerId)
    .eq("language", language)
    .in("hotel_id", uniqueIds);

  if (result.error) throw result.error;

  const content = new Map<string, LocalHotelContent>();
  for (const row of (result.data ?? []) as Array<Record<string, unknown>>) {
    const hotelId = typeof row.hotel_id === "string" ? row.hotel_id : "";
    const name = typeof row.name === "string" ? row.name : "";
    if (!hotelId || !name) continue;
    content.set(hotelId, {
      hotelId,
      name,
      starRating: finiteOrNull(row.star_rating),
      imageUrl: httpsUrlOrNull(row.primary_image_url),
      address: textOrNull(row.address),
      latitude: finiteOrNull(row.latitude),
      longitude: finiteOrNull(row.longitude),
    });
  }
  return content;
}

function finiteOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function httpsUrlOrNull(value: unknown) {
  const text = textOrNull(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
