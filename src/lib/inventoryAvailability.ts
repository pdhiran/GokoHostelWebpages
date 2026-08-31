export type InventoryPool = "online" | "offline" | "block";

export type NightAvailability = {
  total: number;
  blocked: number;
  assigned: number;
  onlineAssigned: number;
  available: number;
  online: number;
  offline: number;
  overridden: boolean;
};

type BedRef = { dormId: number };
type BlockRef = { bedId: number; dormId: number; startDate: string; endDate: string };
type AssignmentRef = {
  dormId: number;
  checkinDate: string;
  checkoutDate: string;
  status?: string;
  inventoryPool?: string | null;
};
type OverrideRef = { dormId: number; date: string; onlineAvailable: number | null; channelId?: number | null };

/** Occupied nights for a stay: [checkin, checkout). IST calendar dates. */
export function stayNights(checkinDate: string, checkoutDate: string): string[] {
  const dates: string[] = [];
  let current = checkinDate;
  while (current < checkoutDate) {
    dates.push(current);
    current = addCalendarDays(current, 1);
  }
  return dates;
}

/** Occupied nights, treating missing/equal checkout as a single night. */
export function occupiedNights(checkinDate: string, checkoutDate?: string | null): string[] {
  if (!checkinDate) return [];
  if (checkoutDate && checkoutDate > checkinDate) return stayNights(checkinDate, checkoutDate);
  return stayNights(checkinDate, addCalendarDays(checkinDate, 1));
}

/** Exclusive end date for a stay/block. Missing or equal end → one night (start + 1). */
export function exclusiveEndDate(startDate: string, endDate?: string | null): string | null {
  if (!startDate) return null;
  if (endDate && endDate < startDate) return null;
  if (endDate && endDate > startDate) return endDate;
  return addCalendarDays(startDate, 1);
}

export function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && endA > startB;
}

export function addCalendarDays(date: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days);
  return new Date(utc).toISOString().slice(0, 10);
}

/** Inclusive bulk nights (Set Rates / Restrictions). 1 Sep–2 Sep → both nights. */
export function inclusiveNights(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate || endDate < startDate) return [];
  const dates: string[] = [];
  let current = startDate;
  while (current <= endDate) {
    dates.push(current);
    current = addCalendarDays(current, 1);
  }
  return dates;
}

/** Weekday of a YYYY-MM-DD civil date (0=Sun). Timezone-independent. */
export function civilWeekday(date: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return 0;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
}

/**
 * Bulk inventory start/end are inclusive nights (same as Set Rates).
 * Convert last included night → exclusive end used by blocks and stayNights.
 * 1 Sep–2 Sep → exclusive end 3 Sep → nights [1 Sep, 2 Sep].
 */
export function exclusiveEndFromInclusive(startDate: string, inclusiveEnd?: string | null): string | null {
  if (!startDate || !inclusiveEnd || inclusiveEnd < startDate) return null;
  return addCalendarDays(inclusiveEnd, 1);
}

/**
 * Beds that can take a new calendar block for [startDate, endDate).
 * Occupied (assigned) and already-blocked beds are excluded — unlike New Booking,
 * which also offers blocked beds so a guest can take one.
 */
export function bedsFreeToBlock<T extends { id: number }>(
  beds: T[],
  startDate: string,
  endDate: string,
  assignments: { bedId: number; checkinDate: string; checkoutDate: string; status?: string }[],
  blocks: { bedId: number; startDate: string; endDate: string }[],
): T[] {
  if (!startDate || !endDate || startDate >= endDate) return [];
  const occupied = new Set(
    assignments
      .filter((a) => (a.status ?? "assigned") === "assigned" && rangesOverlap(a.checkinDate, a.checkoutDate, startDate, endDate))
      .map((a) => a.bedId),
  );
  const blocked = new Set(
    blocks.filter((b) => rangesOverlap(b.startDate, b.endDate, startDate, endDate)).map((b) => b.bedId),
  );
  return beds.filter((b) => !occupied.has(b.id) && !blocked.has(b.id));
}

/** Remaining OTA vs walk-in given physical leftover, OTA ceiling, and beds already counted as online. */
export function remainingSplit(available: number, ceiling: number, onlineAssigned: number): { online: number; offline: number } {
  const online = Math.min(available, Math.max(0, ceiling - onlineAssigned));
  return { online, offline: Math.max(0, available - online) };
}

/**
 * Split currently available beds (booked + blocked already excluded).
 * `onlineRemaining` is what staff type: how many of the leftover beds go to OTA.
 */
export function splitAvailable(available: number, onlineRemaining: number): { online: number; offline: number } {
  const online = Math.min(available, Math.max(0, onlineRemaining));
  return { online, offline: Math.max(0, available - online) };
}

/** Persist remaining-among-available as a ceiling so PMS still subtracts later OTA assignments. */
export function ceilingFromRemaining(onlineRemaining: number, onlineAssigned: number): number {
  return Math.max(0, onlineRemaining) + Math.max(0, onlineAssigned);
}

export function pickInventoryOverride<T extends { dormId: number; date: string; channelId?: number | null }>(
  overrides: T[],
  dormId: number,
  date: string,
): T | null {
  const matches = overrides.filter((o) => o.dormId === dormId && o.date === date);
  return matches.find((o) => o.channelId == null) ?? matches[0] ?? null;
}

export function assignmentPool(pool?: string | null): InventoryPool {
  if (pool === "offline" || pool === "block") return pool;
  return "online";
}

export function computeNightAvailability(
  dormId: number,
  date: string,
  beds: BedRef[],
  blocks: BlockRef[],
  assignments: AssignmentRef[],
  overrides: OverrideRef[],
): NightAvailability {
  const total = beds.filter((b) => b.dormId === dormId).length;
  const blocked = new Set(
    blocks.filter((bl) => bl.dormId === dormId && bl.startDate <= date && bl.endDate > date).map((bl) => bl.bedId),
  ).size;
  const nightAssigns = assignments.filter(
    (a) => a.dormId === dormId && (a.status ?? "assigned") === "assigned" && a.checkinDate <= date && a.checkoutDate > date,
  );
  const assigned = nightAssigns.length;
  const onlineAssigned = nightAssigns.filter((a) => assignmentPool(a.inventoryPool) === "online").length;
  const available = Math.max(0, total - blocked - assigned);
  const override = pickInventoryOverride(overrides, dormId, date);
  const ceiling = override?.onlineAvailable ?? total;
  const { online, offline } = remainingSplit(available, ceiling, onlineAssigned);
  return {
    total,
    blocked,
    assigned,
    onlineAssigned,
    available,
    online,
    offline,
    overridden: override?.onlineAvailable != null,
  };
}

/** Remaining OTA/PMS slots for a night (what we push to Aiosell). */
export function inventoryAvailableForNight(
  dormId: number,
  date: string,
  beds: BedRef[],
  blocks: BlockRef[],
  assignments: AssignmentRef[],
  overrides: OverrideRef[],
): number {
  return computeNightAvailability(dormId, date, beds, blocks, assignments, overrides).online;
}

export function minPoolForStay(
  dormId: number,
  nights: string[],
  beds: BedRef[],
  blocks: BlockRef[],
  assignments: AssignmentRef[],
  overrides: OverrideRef[],
): { online: number; offline: number } {
  if (nights.length === 0) {
    const n = computeNightAvailability(dormId, "", beds, [], [], []);
    return { online: n.online, offline: n.offline };
  }
  let online = Infinity;
  let offline = Infinity;
  for (const night of nights) {
    const s = computeNightAvailability(dormId, night, beds, blocks, assignments, overrides);
    online = Math.min(online, s.online);
    offline = Math.min(offline, s.offline);
  }
  return { online: online === Infinity ? 0 : online, offline: offline === Infinity ? 0 : offline };
}

export function tagBedsForPicker<T extends { id: number; dormId: number; bedId: string }>(
  physicalBeds: T[],
  blockedBeds: T[],
  allBeds: BedRef[],
  nights: string[],
  blocks: BlockRef[],
  assignments: AssignmentRef[],
  overrides: OverrideRef[],
): Array<T & { pool: InventoryPool }> {
  const freeByDorm = new Map<number, T[]>();
  for (const bed of physicalBeds) {
    const list = freeByDorm.get(bed.dormId) ?? [];
    list.push(bed);
    freeByDorm.set(bed.dormId, list);
  }
  const blockedByDorm = new Map<number, T[]>();
  for (const bed of blockedBeds) {
    const list = blockedByDorm.get(bed.dormId) ?? [];
    list.push(bed);
    blockedByDorm.set(bed.dormId, list);
  }
  const dormIds = new Set([...freeByDorm.keys(), ...blockedByDorm.keys()]);
  const out: Array<T & { pool: InventoryPool }> = [];
  for (const dormId of dormIds) {
    const slots = minPoolForStay(dormId, nights, allBeds, blocks, assignments, overrides);
    const free = (freeByDorm.get(dormId) ?? []).slice().sort((a, b) => a.bedId.localeCompare(b.bedId, undefined, { numeric: true }));
    const blocked = (blockedByDorm.get(dormId) ?? []).slice().sort((a, b) => a.bedId.localeCompare(b.bedId, undefined, { numeric: true }));
    // Tightest night: only min(online)+min(offline) chips; extra physical leftover would squeeze OTA.
    free.forEach((bed, i) => {
      if (i < slots.online) out.push({ ...bed, pool: "online" });
      else if (i < slots.online + slots.offline) out.push({ ...bed, pool: "offline" });
    });
    for (const bed of blocked) {
      out.push({ ...bed, pool: "block" });
    }
  }
  return out;
}

export function bedsFitInventoryCap(
  requested: { id: number }[],
  taggedIds: Set<number>,
): string | null {
  if (requested.some((b) => !taggedIds.has(b.id))) {
    return "One or more beds are not available for these dates";
  }
  return null;
}

export function shouldPushPms(
  pools: InventoryPool[],
  before?: Pick<NightAvailability, "online">,
  after?: Pick<NightAvailability, "online">,
): boolean {
  if (pools.some((p) => p === "online")) return true;
  if (before && after && before.online !== after.online) return true;
  return false;
}

/** Simulate booking N beds from a pool and return the next night snapshot. */
export function applyBookingToNight(
  snap: NightAvailability,
  pool: InventoryPool,
  count = 1,
): NightAvailability {
  if (pool === "block") {
    return {
      ...snap,
      blocked: Math.max(0, snap.blocked - count),
      assigned: snap.assigned + count,
    };
  }
  const assigned = snap.assigned + count;
  const available = Math.max(0, snap.available - count);
  const onlineAssigned = snap.onlineAssigned + (pool === "online" ? count : 0);
  const online = Math.min(available, pool === "online" ? Math.max(0, snap.online - count) : snap.online);
  const offline = Math.max(0, available - online);
  return { ...snap, assigned, onlineAssigned, available, online, offline };
}
