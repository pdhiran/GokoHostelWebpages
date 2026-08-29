import { localDateStr } from "@/lib/utils";

/** Occupied nights for a stay: [checkin, checkout). IST calendar dates. */
export function stayNights(checkinDate: string, checkoutDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(checkinDate + "T00:00:00");
  const end = new Date(checkoutDate + "T00:00:00");
  while (current < end) {
    dates.push(localDateStr(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function pickInventoryOverride<T extends { dormId: number; date: string; channelId?: number | null }>(
  overrides: T[],
  dormId: number,
  date: string,
): T | null {
  const matches = overrides.filter((o) => o.dormId === dormId && o.date === date);
  return matches.find((o) => o.channelId == null) ?? matches[0] ?? null;
}

/** Same formula as InventoryRatePlan.computeAvailability.available */
export function inventoryAvailableForNight(
  dormId: number,
  date: string,
  beds: { dormId: number }[],
  blocks: { bedId: number; dormId: number; startDate: string; endDate: string }[],
  assignments: { dormId: number; checkinDate: string; checkoutDate: string; status?: string }[],
  overrides: { dormId: number; date: string; onlineAvailable: number | null; channelId?: number | null }[],
): number {
  const total = beds.filter((b) => b.dormId === dormId).length;
  const blocked = new Set(
    blocks.filter((bl) => bl.dormId === dormId && bl.startDate <= date && bl.endDate > date).map((bl) => bl.bedId),
  ).size;
  const assigned = assignments.filter(
    (a) => a.dormId === dormId && (a.status ?? "assigned") === "assigned" && a.checkinDate <= date && a.checkoutDate > date,
  ).length;
  const override = pickInventoryOverride(overrides, dormId, date);
  const ceiling = override?.onlineAvailable ?? total;
  return Math.max(0, ceiling - blocked - assigned);
}

export function inventoryCapForStay(
  dormId: number,
  nights: string[],
  beds: { dormId: number }[],
  blocks: { bedId: number; dormId: number; startDate: string; endDate: string }[],
  assignments: { dormId: number; checkinDate: string; checkoutDate: string; status?: string }[],
  overrides: { dormId: number; date: string; onlineAvailable: number | null; channelId?: number | null }[],
): number {
  if (nights.length === 0) return beds.filter((b) => b.dormId === dormId).length;
  let cap = Infinity;
  for (const night of nights) {
    cap = Math.min(cap, inventoryAvailableForNight(dormId, night, beds, blocks, assignments, overrides));
  }
  return cap === Infinity ? 0 : cap;
}

export function capPhysicalBedsToInventory<T extends { id: number; dormId: number; bedId: string }>(
  physicalBeds: T[],
  allBeds: { dormId: number }[],
  nights: string[],
  blocks: { bedId: number; dormId: number; startDate: string; endDate: string }[],
  assignments: { dormId: number; checkinDate: string; checkoutDate: string; status?: string }[],
  overrides: { dormId: number; date: string; onlineAvailable: number | null; channelId?: number | null }[],
): T[] {
  const byDorm = new Map<number, T[]>();
  for (const bed of physicalBeds) {
    const list = byDorm.get(bed.dormId) ?? [];
    list.push(bed);
    byDorm.set(bed.dormId, list);
  }
  const out: T[] = [];
  for (const [dormId, dormBeds] of byDorm) {
    const cap = inventoryCapForStay(dormId, nights, allBeds, blocks, assignments, overrides);
    dormBeds.sort((a, b) => a.bedId.localeCompare(b.bedId, undefined, { numeric: true }));
    out.push(...dormBeds.slice(0, cap));
  }
  return out;
}

export function bedsFitInventoryCap(
  requested: { id: number; dormId: number }[],
  physicalFreeIds: Set<number>,
  nights: string[],
  allBeds: { dormId: number }[],
  blocks: { bedId: number; dormId: number; startDate: string; endDate: string }[],
  assignments: { dormId: number; checkinDate: string; checkoutDate: string; status?: string }[],
  overrides: { dormId: number; date: string; onlineAvailable: number | null; channelId?: number | null }[],
): string | null {
  if (requested.some((b) => !physicalFreeIds.has(b.id))) {
    return "One or more beds are not available for these dates";
  }
  const counts = new Map<number, number>();
  for (const bed of requested) {
    counts.set(bed.dormId, (counts.get(bed.dormId) ?? 0) + 1);
  }
  for (const [dormId, count] of counts) {
    const cap = inventoryCapForStay(dormId, nights, allBeds, blocks, assignments, overrides);
    if (count > cap) {
      return "Not enough inventory for one or more dorms on these dates";
    }
  }
  return null;
}
