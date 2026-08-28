import { asc, eq, or, sql } from "drizzle-orm";
import { getDb } from "./index";
import { siteCommunitySpaces, siteEvents, sitePageCopy } from "./schema";

export type SiteEventRow = typeof siteEvents.$inferSelect;
export type SiteCommunitySpaceRow = typeof siteCommunitySpaces.$inferSelect;
export type SitePageCopyRow = typeof sitePageCopy.$inferSelect;

function nowIso() {
  return new Date().toISOString();
}

export async function getSiteEvents(isPast?: boolean) {
  const db = getDb();
  if (isPast === undefined) {
    return db.select().from(siteEvents).orderBy(asc(siteEvents.isPast), asc(siteEvents.displayOrder), asc(siteEvents.id));
  }
  return db
    .select()
    .from(siteEvents)
    .where(eq(siteEvents.isPast, isPast ? 1 : 0))
    .orderBy(asc(siteEvents.displayOrder), asc(siteEvents.id));
}

export async function getSiteEventById(id: number) {
  const db = getDb();
  const rows = await db.select().from(siteEvents).where(eq(siteEvents.id, id)).limit(1);
  return rows[0] || null;
}

export async function addSiteEvent(data: {
  date: string;
  title: string;
  description: string;
  tags: string;
  isPast: number;
  coverUrl: string;
  photos: string;
  displayOrder: number;
}) {
  const db = getDb();
  return db.insert(siteEvents).values({ ...data, updatedAt: nowIso() });
}

export async function updateSiteEvent(id: number, data: Partial<{
  date: string;
  title: string;
  description: string;
  tags: string;
  isPast: number;
  coverUrl: string;
  photos: string;
  displayOrder: number;
}>) {
  const db = getDb();
  return db.update(siteEvents).set({ ...data, updatedAt: nowIso() }).where(eq(siteEvents.id, id));
}

export async function deleteSiteEvent(id: number) {
  const db = getDb();
  return db.delete(siteEvents).where(eq(siteEvents.id, id));
}

export async function getSiteCommunitySpaces() {
  const db = getDb();
  return db.select().from(siteCommunitySpaces).orderBy(asc(siteCommunitySpaces.displayOrder), asc(siteCommunitySpaces.id));
}

export async function getSiteCommunitySpaceById(id: number) {
  const db = getDb();
  const rows = await db.select().from(siteCommunitySpaces).where(eq(siteCommunitySpaces.id, id)).limit(1);
  return rows[0] || null;
}

export async function addSiteCommunitySpace(data: {
  title: string;
  icon: string;
  description: string;
  imageUrl: string;
  photos: string;
  displayOrder: number;
}) {
  const db = getDb();
  return db.insert(siteCommunitySpaces).values({ ...data, updatedAt: nowIso() });
}

export async function updateSiteCommunitySpace(id: number, data: Partial<{
  title: string;
  icon: string;
  description: string;
  imageUrl: string;
  photos: string;
  displayOrder: number;
}>) {
  const db = getDb();
  return db.update(siteCommunitySpaces).set({ ...data, updatedAt: nowIso() }).where(eq(siteCommunitySpaces.id, id));
}

export async function deleteSiteCommunitySpace(id: number) {
  const db = getDb();
  return db.delete(siteCommunitySpaces).where(eq(siteCommunitySpaces.id, id));
}

export async function getSitePageCopy(page: string) {
  const db = getDb();
  const rows = await db.select().from(sitePageCopy).where(eq(sitePageCopy.page, page)).limit(1);
  return rows[0] || null;
}

export async function upsertSitePageCopy(page: string, content: string) {
  const db = getDb();
  const existing = await getSitePageCopy(page);
  if (existing) {
    return db.update(sitePageCopy).set({ content, updatedAt: nowIso() }).where(eq(sitePageCopy.page, page));
  }
  return db.insert(sitePageCopy).values({ page, content, updatedAt: nowIso() });
}

/** True if any CMS row still points at this public media URL. */
export async function countMediaUrlRefs(url: string): Promise<number> {
  if (!url) return 0;
  const db = getDb();
  const [events] = await db
    .select({ n: sql<number>`count(*)` })
    .from(siteEvents)
    .where(or(eq(siteEvents.coverUrl, url), sql`instr(${siteEvents.photos}, ${url}) > 0`));
  const [spaces] = await db
    .select({ n: sql<number>`count(*)` })
    .from(siteCommunitySpaces)
    .where(or(eq(siteCommunitySpaces.imageUrl, url), sql`instr(${siteCommunitySpaces.photos}, ${url}) > 0`));
  const [copy] = await db
    .select({ n: sql<number>`count(*)` })
    .from(sitePageCopy)
    .where(sql`instr(${sitePageCopy.content}, ${url}) > 0`);
  return Number(events?.n ?? 0) + Number(spaces?.n ?? 0) + Number(copy?.n ?? 0);
}
