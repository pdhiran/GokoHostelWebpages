import { mediaUrlToKey } from "./mediaKeys";

const LEGACY_FOOD_IMAGE_RE = /^(?:images\/)?[a-zA-Z0-9._-]+\.(?:jpe?g|png|webp)$/;

export function sanitizeFoodImageUrl(value: unknown): string {
  const url = String(value || "").trim();
  if (!url) return "";

  const mediaKey = mediaUrlToKey(url);
  if (mediaKey?.startsWith("menu/")) return url;
  if (LEGACY_FOOD_IMAGE_RE.test(url)) return url;
  return "";
}

export function foodImageSrc(value: unknown): string {
  const url = sanitizeFoodImageUrl(value);
  if (!url || url.startsWith("/api/media/")) return url;
  return `/images/food/${url.replace(/^images\//, "")}`;
}
