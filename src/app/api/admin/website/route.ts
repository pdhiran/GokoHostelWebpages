import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { isPiRuntime } from "@/lib/runtime";
import { deleteMediaKeys } from "@/lib/mediaR2";
import { collectMediaKeys, keyToMediaUrl, mediaUrlToKey, releasedMediaKeys, sanitizeSiteImageUrl } from "@/lib/mediaKeys";
import { defaultCommunityCopy, defaultEventsCopy, parseCommunityCopy, parseEventsCopy, parseJsonArray } from "@/lib/siteCopy";
import {
  addSiteCommunitySpace,
  addSiteEvent,
  countMediaUrlRefs,
  deleteSiteCommunitySpace,
  deleteSiteEvent,
  getSiteCommunitySpaceById,
  getSiteCommunitySpaces,
  getSiteEventById,
  getSiteEvents,
  getSitePageCopy,
  updateSiteCommunitySpace,
  updateSiteEvent,
  upsertSitePageCopy,
} from "@/db/siteQueries";

function jsonTags(input: unknown): string {
  if (Array.isArray(input)) return JSON.stringify(input.map((t) => String(t).trim()).filter(Boolean));
  if (typeof input === "string") {
    return JSON.stringify(input.split(",").map((t) => t.trim()).filter(Boolean));
  }
  return "[]";
}

function jsonPhotos(input: unknown): string {
  if (Array.isArray(input)) {
    return JSON.stringify(input.map((t) => sanitizeSiteImageUrl(String(t).trim())).filter(Boolean));
  }
  if (typeof input === "string" && input) {
    const url = sanitizeSiteImageUrl(input);
    return url ? JSON.stringify([url]) : "[]";
  }
  return "[]";
}

function nextOrder(rows: { displayOrder: number }[]) {
  return rows.reduce((m, r) => Math.max(m, r.displayOrder), -1) + 1;
}

function sentRibbonImage(copy: unknown): boolean {
  const hero = copy && typeof copy === "object" && "hero" in copy ? (copy as { hero?: unknown }).hero : null;
  return Boolean(hero && typeof hero === "object" && "ribbonImage" in hero);
}

function sanitizedIncomingRibbon(copy: unknown): string {
  const hero = copy && typeof copy === "object" ? (copy as { hero?: { ribbonImage?: unknown } }).hero : undefined;
  return sanitizeSiteImageUrl(String(hero?.ribbonImage ?? ""));
}

async function safeDeleteMediaKeys(keys: string[]) {
  try {
    const drop: string[] = [];
    for (const key of keys) {
      if ((await countMediaUrlRefs(keyToMediaUrl(key))) === 0) drop.push(key);
    }
    if (drop.length) await deleteMediaKeys(drop);
  } catch (err) {
    console.error("Website media cleanup failed:", err);
  }
}

async function releaseHeroImage(prevUrl: string | undefined, nextUrl: string) {
  await safeDeleteMediaKeys(releasedMediaKeys([prevUrl || ""], [nextUrl]));
}

/** Keep in sync with iconMap in src/components/ui/Icon.tsx */
const SITE_ICONS = new Set([
  "bed", "lock", "shower", "wifi", "waves", "sofa", "utensils", "dice", "laptop", "book",
  "party", "palette", "globe", "flame", "handshake", "leaf", "umbrella", "rainbow", "heart",
  "building", "mapPin", "clipboard", "target",
]);

function safeIcon(raw: unknown): string {
  const s = String(raw || "sofa").trim();
  return SITE_ICONS.has(s) ? s : "sofa";
}

async function requireAdmin(password: unknown, username: unknown) {
  if (isPiRuntime()) {
    return { error: NextResponse.json({ error: "Website CMS is only available on the live site" }, { status: 403 }) };
  }
  const auth = await authenticateUser(String(password || ""), username ? String(username) : undefined);
  if (!auth) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (auth.role !== "admin") return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  return { auth };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, username, action, ...params } = body;
    const gate = await requireAdmin(password, username);
    if (gate.error) return gate.error;

    switch (action) {
      case "getAll": {
        const [events, spaces, eventsCopy, communityCopy] = await Promise.all([
          getSiteEvents(),
          getSiteCommunitySpaces(),
          getSitePageCopy("events"),
          getSitePageCopy("community"),
        ]);
        return NextResponse.json({
          events,
          spaces,
          eventsCopy: parseEventsCopy(eventsCopy?.content ?? null) ?? defaultEventsCopy,
          communityCopy: parseCommunityCopy(communityCopy?.content ?? null) ?? defaultCommunityCopy,
        });
      }

      case "saveEventsCopy": {
        if (params.copy == null) return NextResponse.json({ error: "Copy is required" }, { status: 400 });
        const copy = parseEventsCopy(JSON.stringify(params.copy));
        if (!copy) return NextResponse.json({ error: "Invalid page copy" }, { status: 400 });
        const prevRow = await getSitePageCopy("events");
        if (sentRibbonImage(params.copy)) {
          copy.hero.ribbonImage = sanitizedIncomingRibbon(params.copy);
        } else {
          const prev = parseEventsCopy(prevRow?.content ?? null);
          if (prev) copy.hero.ribbonImage = prev.hero.ribbonImage;
        }
        await upsertSitePageCopy("events", JSON.stringify(copy));
        if (sentRibbonImage(params.copy)) {
          const prevUrl = parseEventsCopy(prevRow?.content ?? null)?.hero.ribbonImage;
          await releaseHeroImage(prevUrl, copy.hero.ribbonImage);
        }
        return NextResponse.json({ ok: true });
      }

      case "saveCommunityCopy": {
        if (params.copy == null) return NextResponse.json({ error: "Copy is required" }, { status: 400 });
        const copy = parseCommunityCopy(JSON.stringify(params.copy));
        if (!copy) return NextResponse.json({ error: "Invalid page copy" }, { status: 400 });
        const prevRow = await getSitePageCopy("community");
        if (sentRibbonImage(params.copy)) {
          copy.hero.ribbonImage = sanitizedIncomingRibbon(params.copy);
        } else {
          const prev = parseCommunityCopy(prevRow?.content ?? null);
          if (prev) copy.hero.ribbonImage = prev.hero.ribbonImage;
        }
        await upsertSitePageCopy("community", JSON.stringify(copy));
        if (sentRibbonImage(params.copy)) {
          const prevUrl = parseCommunityCopy(prevRow?.content ?? null)?.hero.ribbonImage;
          await releaseHeroImage(prevUrl, copy.hero.ribbonImage);
        }
        return NextResponse.json({ ok: true });
      }

      case "addEvent": {
        if (!String(params.title || "").trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
        const existing = await getSiteEvents(params.isPast ? true : false);
        await addSiteEvent({
          date: String(params.date || "").trim(),
          title: String(params.title).trim(),
          description: String(params.description || "").trim(),
          tags: jsonTags(params.tags),
          isPast: params.isPast ? 1 : 0,
          coverUrl: sanitizeSiteImageUrl(String(params.coverUrl || "")),
          photos: jsonPhotos(params.photos),
          displayOrder: nextOrder(existing),
        });
        return NextResponse.json({ ok: true });
      }

      case "updateEvent": {
        const id = Number(params.id);
        if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });
        const prev = await getSiteEventById(id);
        if (!prev) return NextResponse.json({ error: "Event not found" }, { status: 404 });
        const coverUrl = params.coverUrl !== undefined ? sanitizeSiteImageUrl(String(params.coverUrl || "")) : prev.coverUrl;
        const photos = params.photos !== undefined ? jsonPhotos(params.photos) : prev.photos;
        const data: Parameters<typeof updateSiteEvent>[1] = { coverUrl, photos };
        if (params.date !== undefined) data.date = String(params.date);
        if (params.title !== undefined) {
          const title = String(params.title).trim();
          if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
          data.title = title;
        }
        if (params.description !== undefined) data.description = String(params.description);
        if (params.tags !== undefined) data.tags = jsonTags(params.tags);
        if (params.isPast !== undefined) {
          data.isPast = params.isPast ? 1 : 0;
          if (data.isPast !== prev.isPast) {
            data.displayOrder = nextOrder(await getSiteEvents(!!data.isPast));
          } else if (params.displayOrder !== undefined) {
            data.displayOrder = Number(params.displayOrder) || 0;
          }
        } else if (params.displayOrder !== undefined) {
          data.displayOrder = Number(params.displayOrder) || 0;
        }
        await updateSiteEvent(id, data);
        const prevPhotos = parseJsonArray(prev.photos);
        const nextPhotos = params.photos !== undefined ? parseJsonArray(photos) : prevPhotos;
        const released = releasedMediaKeys(
          [prev.coverUrl, ...prevPhotos],
          [coverUrl, ...nextPhotos],
        );
        await safeDeleteMediaKeys(released);
        return NextResponse.json({ ok: true });
      }

      case "deleteEvent": {
        const id = Number(params.id);
        if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });
        const prev = await getSiteEventById(id);
        if (!prev) return NextResponse.json({ error: "Event not found" }, { status: 404 });
        await deleteSiteEvent(id);
        await safeDeleteMediaKeys(collectMediaKeys([prev.coverUrl, ...parseJsonArray(prev.photos)]));
        return NextResponse.json({ ok: true });
      }

      case "addSpace": {
        if (!String(params.title || "").trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
        const existing = await getSiteCommunitySpaces();
        await addSiteCommunitySpace({
          title: String(params.title).trim(),
          icon: safeIcon(params.icon),
          description: String(params.description || "").trim(),
          imageUrl: sanitizeSiteImageUrl(String(params.imageUrl || "")),
          photos: jsonPhotos(params.photos),
          displayOrder: nextOrder(existing),
        });
        return NextResponse.json({ ok: true });
      }

      case "updateSpace": {
        const id = Number(params.id);
        if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });
        const prev = await getSiteCommunitySpaceById(id);
        if (!prev) return NextResponse.json({ error: "Space not found" }, { status: 404 });
        const imageUrl = params.imageUrl !== undefined ? sanitizeSiteImageUrl(String(params.imageUrl || "")) : prev.imageUrl;
        const photos = params.photos !== undefined ? jsonPhotos(params.photos) : prev.photos;
        const data: Parameters<typeof updateSiteCommunitySpace>[1] = { imageUrl, photos };
        if (params.title !== undefined) {
          const title = String(params.title).trim();
          if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
          data.title = title;
        }
        if (params.icon !== undefined) data.icon = safeIcon(params.icon);
        if (params.description !== undefined) data.description = String(params.description);
        if (params.displayOrder !== undefined) data.displayOrder = Number(params.displayOrder) || 0;
        await updateSiteCommunitySpace(id, data);
        const prevPhotos = parseJsonArray(prev.photos);
        const nextPhotos = params.photos !== undefined ? parseJsonArray(photos) : prevPhotos;
        const released = releasedMediaKeys(
          [prev.imageUrl, ...prevPhotos],
          [imageUrl, ...nextPhotos],
        );
        await safeDeleteMediaKeys(released);
        return NextResponse.json({ ok: true });
      }

      case "deleteSpace": {
        const id = Number(params.id);
        if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });
        const prev = await getSiteCommunitySpaceById(id);
        if (!prev) return NextResponse.json({ error: "Space not found" }, { status: 404 });
        await deleteSiteCommunitySpace(id);
        await safeDeleteMediaKeys(collectMediaKeys([prev.imageUrl, ...parseJsonArray(prev.photos)]));
        return NextResponse.json({ ok: true });
      }

      case "discardMedia": {
        const key = mediaUrlToKey(String(params.url || ""));
        if (key) await safeDeleteMediaKeys([key]);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Website CMS error:", message);
    if (/no such table/i.test(message)) {
      return NextResponse.json({ error: "Website tables missing — apply migration 0035" }, { status: 503 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
