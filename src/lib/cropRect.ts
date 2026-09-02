/** Cover-crop source into target aspect. Wider sources crop the sides (centered). Taller sources crop from the top so faces stay in frame. */
export function cropRect(
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (srcW <= 0 || srcH <= 0 || targetW <= 0 || targetH <= 0) {
    return { sx: 0, sy: 0, sw: Math.max(1, srcW), sh: Math.max(1, srcH) };
  }
  const targetAspect = targetW / targetH;
  const srcAspect = srcW / srcH;
  if (srcAspect > targetAspect) {
    const sw = srcH * targetAspect;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  const sh = srcW / targetAspect;
  return { sx: 0, sy: 0, sw: srcW, sh };
}

export const SITE_IMAGE_TARGETS = {
  card: { width: 1600, height: 1000 },
  food: { width: 1200, height: 1200 },
  hero: { width: 1920, height: 1080 },
} as const;

export type SiteImageKind = keyof typeof SITE_IMAGE_TARGETS;
