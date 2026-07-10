import "server-only";

import { isRecord } from "@/server/http/validation";
import type { PublicHeroMedia } from "@/types/home";

export const FALLBACK_HOME_HERO_MEDIA: PublicHeroMedia = {
  title: "Journeys built around your time.",
  subtitle:
    "Flights, stays, visas and holiday routes in one calm booking experience for families, groups and frequent travelers.",
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

  const title = readText(payload.title);
  const subtitle = readText(payload.subtitle);
  const image =
    readText(payload.backgroundImage) ??
    readText(payload.backgroundImageUrl) ??
    readText(payload.imageUrl) ??
    "";
  const alt =
    readText(payload.backgroundAlt) ??
    readText(payload.imageAlt) ??
    readText(payload.alt) ??
    "";

  return {
    title:
      title && title.length >= 4 && title.length <= 140
        ? title
        : FALLBACK_HOME_HERO_MEDIA.title,
    subtitle:
      subtitle && subtitle.length >= 8 && subtitle.length <= 320
        ? subtitle
        : FALLBACK_HOME_HERO_MEDIA.subtitle,
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
  title = FALLBACK_HOME_HERO_MEDIA.title,
  subtitle = FALLBACK_HOME_HERO_MEDIA.subtitle,
): PublicHeroMedia {
  requireTrustedPublicMediaUrl(backgroundImage);

  if (title.length < 4 || title.length > 140) {
    throw new Error("Hero title is invalid");
  }

  if (subtitle.length < 8 || subtitle.length > 320) {
    throw new Error("Hero subtitle is invalid");
  }

  if (backgroundAlt.length < 4 || backgroundAlt.length > 240) {
    throw new Error("Hero alt text is invalid");
  }

  return { title, subtitle, backgroundImage, backgroundAlt };
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

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}
