import { communitySpaces, type CommunitySpace } from "@/content/community";
import { pastEvents, upcomingEvents, type EventItem } from "@/content/events";
import {
  getSiteCommunitySpaces,
  getSiteEvents,
  getSitePageCopy,
  type SiteCommunitySpaceRow,
  type SiteEventRow,
} from "@/db/siteQueries";
import { sanitizeSiteImageUrl } from "@/lib/mediaKeys";
import {
  defaultCommunityCopy,
  defaultEventsCopy,
  mergeGallery,
  parseCommunityCopy,
  parseEventsCopy,
  parseJsonArray,
  type CommunityPageCopy,
  type EventsPageCopy,
} from "@/lib/siteCopy";

export type { CommunityPageCopy, EventsPageCopy };
export { defaultCommunityCopy, defaultEventsCopy, parseJsonArray };

export type EventsPageData = {
  copy: EventsPageCopy;
  upcoming: EventItem[];
  past: EventItem[];
};

export type CommunityPageData = {
  copy: CommunityPageCopy;
  spaces: CommunitySpace[];
};

export function eventRowToItem(row: SiteEventRow): EventItem {
  const photos = mergeGallery(
    sanitizeSiteImageUrl(row.coverUrl),
    parseJsonArray(row.photos).map(sanitizeSiteImageUrl).filter(Boolean),
  );
  return {
    date: row.date,
    title: row.title,
    description: row.description,
    tags: parseJsonArray(row.tags),
    past: Boolean(row.isPast),
    cover: photos[0] || undefined,
    photos,
  };
}

export function spaceRowToItem(row: SiteCommunitySpaceRow): CommunitySpace {
  const photos = mergeGallery(
    sanitizeSiteImageUrl(row.imageUrl),
    parseJsonArray(row.photos).map(sanitizeSiteImageUrl).filter(Boolean),
  );
  return {
    title: row.title,
    icon: row.icon,
    description: row.description,
    image: photos[0] || "",
    photos,
  };
}

/** `null` = D1 unavailable (use hardcoded fallback). A successful query, even with 0 rows, is live CMS data. */
export function resolveEventsPageData(
  db: { rows: SiteEventRow[]; copyRaw: string | null } | null,
): EventsPageData {
  if (!db) {
    return { copy: defaultEventsCopy, upcoming: upcomingEvents, past: pastEvents };
  }
  const items = db.rows.map(eventRowToItem);
  return {
    copy: parseEventsCopy(db.copyRaw) ?? defaultEventsCopy,
    upcoming: items.filter((e) => !e.past),
    past: items.filter((e) => e.past),
  };
}

export function resolveCommunityPageData(
  db: { rows: SiteCommunitySpaceRow[]; copyRaw: string | null } | null,
): CommunityPageData {
  if (!db) {
    return { copy: defaultCommunityCopy, spaces: communitySpaces };
  }
  return {
    copy: parseCommunityCopy(db.copyRaw) ?? defaultCommunityCopy,
    spaces: db.rows.map(spaceRowToItem),
  };
}

export async function loadEventsPageData(): Promise<EventsPageData> {
  try {
    const [rows, copyRow] = await Promise.all([
      getSiteEvents(),
      getSitePageCopy("events"),
    ]);
    return resolveEventsPageData({ rows, copyRaw: copyRow?.content ?? null });
  } catch (error) {
    console.error("Events CMS load failed:", error);
    return resolveEventsPageData(null);
  }
}

export async function loadCommunityPageData(): Promise<CommunityPageData> {
  try {
    const [rows, copyRow] = await Promise.all([
      getSiteCommunitySpaces(),
      getSitePageCopy("community"),
    ]);
    return resolveCommunityPageData({ rows, copyRaw: copyRow?.content ?? null });
  } catch (error) {
    console.error("Community CMS load failed:", error);
    return resolveCommunityPageData(null);
  }
}
