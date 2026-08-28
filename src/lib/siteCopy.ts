import {
  communityActivities,
  communityHero,
  communityIntro,
  communitySpecialEvents,
} from "@/content/community";
import { eventsHero, eventsPastCta } from "@/content/events";
import { sanitizeSiteImageUrl } from "@/lib/mediaKeys";

export type EventsPageCopy = {
  hero: { title: string; subtitle: string; chips: string[]; ribbonImage: string };
  pastCta: { title: string; body: string };
};

export type CommunityPageCopy = {
  hero: { title: string; subtitle: string; ribbonImage: string };
  intro: { title: string; paragraph: string };
  activities: {
    title: string;
    subtitle: string;
    badges: string[];
    rhythmTitle: string;
    rhythmIntro: string;
    weekly: { label: string; text: string }[];
  };
  specialEvents: {
    title: string;
    subtitle: string;
    cards: { title: string; description: string }[];
  };
};

export const defaultEventsCopy: EventsPageCopy = {
  hero: {
    title: eventsHero.title,
    subtitle: eventsHero.subtitle,
    chips: [...eventsHero.chips],
    ribbonImage: "/images/goko-holi-2024/IMG_6047.jpg",
  },
  pastCta: { ...eventsPastCta },
};

export const defaultCommunityCopy: CommunityPageCopy = {
  hero: {
    title: communityHero.title,
    subtitle: communityHero.subtitle,
    ribbonImage:
      "/legacy-images/62f5bf7bfc22850018b36726-63021b52b4a9f5776b671ae4_home_video-thumbnail_2.webp",
  },
  intro: { ...communityIntro },
  activities: {
    title: communityActivities.title,
    subtitle: communityActivities.subtitle,
    badges: [...communityActivities.badges],
    rhythmTitle: communityActivities.rhythmTitle,
    rhythmIntro: communityActivities.rhythmIntro,
    weekly: communityActivities.weekly.map((w) => ({ ...w })),
  },
  specialEvents: {
    title: communitySpecialEvents.title,
    subtitle: communitySpecialEvents.subtitle,
    cards: communitySpecialEvents.cards.map((c) => ({ ...c })),
  },
};

export function parseJsonArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim() !== "") : [];
  } catch {
    return [];
  }
}

export const SITE_GALLERY_MAX = 8;

/** Cover first, then extras; drop blanks and duplicates. Cap matches the admin gallery. */
export function mergeGallery(cover: string, photos: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of [cover, ...photos]) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= SITE_GALLERY_MAX) break;
  }
  return out;
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function strList(v: unknown, fallback: string[]): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : fallback;
}

export function parseEventsCopy(raw: string | null): EventsPageCopy | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as EventsPageCopy;
    if (!v?.hero?.title) return null;
    return {
      hero: {
        title: v.hero.title || defaultEventsCopy.hero.title,
        subtitle: str(v.hero.subtitle, defaultEventsCopy.hero.subtitle),
        chips: strList(v.hero.chips, defaultEventsCopy.hero.chips),
        ribbonImage: typeof v.hero.ribbonImage === "string"
          ? sanitizeSiteImageUrl(v.hero.ribbonImage)
          : defaultEventsCopy.hero.ribbonImage,
      },
      pastCta: {
        title: str(v.pastCta?.title, defaultEventsCopy.pastCta.title),
        body: str(v.pastCta?.body, defaultEventsCopy.pastCta.body),
      },
    };
  } catch {
    return null;
  }
}

export function parseCommunityCopy(raw: string | null): CommunityPageCopy | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as CommunityPageCopy;
    if (!v?.hero?.title) return null;
    return {
      hero: {
        title: v.hero.title || defaultCommunityCopy.hero.title,
        subtitle: str(v.hero.subtitle, defaultCommunityCopy.hero.subtitle),
        ribbonImage: typeof v.hero.ribbonImage === "string"
          ? sanitizeSiteImageUrl(v.hero.ribbonImage)
          : defaultCommunityCopy.hero.ribbonImage,
      },
      intro: {
        title: str(v.intro?.title, defaultCommunityCopy.intro.title),
        paragraph: str(v.intro?.paragraph, defaultCommunityCopy.intro.paragraph),
      },
      activities: {
        title: str(v.activities?.title, defaultCommunityCopy.activities.title),
        subtitle: str(v.activities?.subtitle, defaultCommunityCopy.activities.subtitle),
        badges: strList(v.activities?.badges, defaultCommunityCopy.activities.badges),
        rhythmTitle: str(v.activities?.rhythmTitle, defaultCommunityCopy.activities.rhythmTitle),
        rhythmIntro: str(v.activities?.rhythmIntro, defaultCommunityCopy.activities.rhythmIntro),
        weekly: Array.isArray(v.activities?.weekly)
          ? v.activities.weekly
              .filter((w) => !!w && typeof w === "object")
              .map((w) => {
                const row = w as { label?: unknown; text?: unknown };
                return { label: String(row.label ?? ""), text: String(row.text ?? "") };
              })
          : defaultCommunityCopy.activities.weekly,
      },
      specialEvents: {
        title: str(v.specialEvents?.title, defaultCommunityCopy.specialEvents.title),
        subtitle: str(v.specialEvents?.subtitle, defaultCommunityCopy.specialEvents.subtitle),
        cards: Array.isArray(v.specialEvents?.cards)
          ? v.specialEvents.cards
              .filter((c) => !!c && typeof c === "object")
              .map((c) => {
                const row = c as { title?: unknown; description?: unknown };
                return { title: String(row.title ?? ""), description: String(row.description ?? "") };
              })
          : defaultCommunityCopy.specialEvents.cards,
      },
    };
  } catch {
    return null;
  }
}
