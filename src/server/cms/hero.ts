import "server-only";

import { isRecord } from "@/server/http/validation";
import type { PublicHeroMedia } from "@/types/home";

export const FALLBACK_HOME_HERO_MEDIA: PublicHeroMedia = {
  backgroundImage:
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=2200&q=86",
  backgroundAlt: "Road trip through a warm desert mountain route",
};

const TRUSTED_MEDIA_HOSTS = new Set([
  "images.unsplash.com",
  "res.cloudinary.com",
  "ik.imagekit.io",
]);

export function mapHomeHeroPayload(payload: unknown): PublicHeroMedia {
  if (!isRecord(payload)) {
    return FALLBACK_HOME_HERO_MEDIA;
  }

  const image =
    typeof payload.backgroundImage === "string"
      ? payload.backgroundImage.trim()
      : "";
  const alt =
    typeof payload.backgroundAlt === "string"
      ? payload.backgroundAlt.trim()
      : "";

  return {
    backgroundImage: isTrustedPublicMediaUrl(image)
      ? image
      : FALLBACK_HOME_HERO_MEDIA.backgroundImage,
    backgroundAlt:
      alt.length >= 4 && alt.length <= 240
        ? alt
        : FALLBACK_HOME_HERO_MEDIA.backgroundAlt,
  };
}

export function validateHomeHeroMedia(
  backgroundImage: string,
  backgroundAlt: string,
): PublicHeroMedia {
  requireTrustedPublicMediaUrl(backgroundImage);

  if (backgroundAlt.length < 4 || backgroundAlt.length > 240) {
    throw new Error("Hero alt text is invalid");
  }

  return { backgroundImage, backgroundAlt };
}

export function requireTrustedPublicMediaUrl(value: string) {
  if (!isTrustedPublicMediaUrl(value)) {
    throw new Error("Unsupported public image URL");
  }

  return value;
}

function isTrustedPublicMediaUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "https:" && TRUSTED_MEDIA_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
