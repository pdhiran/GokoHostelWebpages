import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { checkins, foodOrders } from "@/db/schema";
import { normalizePhone } from "@/lib/phoneUtils";

export type PendingFoodTab = {
  checkinId: number | null;
  pendingTab: number;
  pendingOrders: number;
  orderIds: number[];
};

export const EMPTY_FOOD_TAB: PendingFoodTab = {
  checkinId: null,
  pendingTab: 0,
  pendingOrders: 0,
  orderIds: [],
};

export function contactToCheckinIdMap(
  rows: { id: number; contact: string | null }[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const n = normalizePhone(row.contact || "");
    if (n) map.set(n, row.id);
  }
  return map;
}

export function checkinIdsMatchingContact(
  rows: { id: number; contact: string | null }[],
  contact: string,
): number[] {
  const n = normalizePhone(contact);
  if (!n) return [];
  return rows.filter((row) => normalizePhone(row.contact || "") === n).map((row) => row.id);
}

export function unpaidFoodCheckoutMessage(
  guestName: string,
  pendingTab: number,
  pendingOrders: number,
): string {
  const rupees = Math.round(pendingTab / 100);
  const orderLabel = pendingOrders === 1 ? "1 unpaid order" : `${pendingOrders} unpaid orders`;
  return `${guestName} has an unpaid food tab of ₹${rupees} (${orderLabel}). Check out anyway?`;
}

export function foodTabUncheckedMessage(reason: "no-phone" | "lookup-failed"): string {
  if (reason === "no-phone") {
    return "No phone on this guest, so the food tab could not be checked. Check out anyway?";
  }
  return "Could not check the food tab. Check out anyway?";
}

export async function activeCheckinIdsForContact(contact: string): Promise<number[]> {
  const n = normalizePhone(contact);
  if (!n) return [];
  const db = getDb();
  const active = await db.select({ id: checkins.id, contact: checkins.contact })
    .from(checkins)
    .where(eq(checkins.status, "active"));
  return checkinIdsMatchingContact(active, contact);
}

/** Hostel food tabs live on self-check-in rows (`food_orders.checkin_id`), matched by phone. */
export async function getPendingFoodTab(opts: {
  checkinId?: number | null;
  contact?: string | null;
}): Promise<PendingFoodTab> {
  const ids = new Set<number>();
  if (typeof opts.checkinId === "number" && opts.checkinId > 0) ids.add(opts.checkinId);

  const contact = opts.contact || "";
  if (contact) {
    for (const id of await activeCheckinIdsForContact(contact)) ids.add(id);
  }

  if (ids.size === 0) return { ...EMPTY_FOOD_TAB };

  const idList = [...ids];
  const db = getDb();
  const rows = await db.select({
    id: foodOrders.id,
    checkinId: foodOrders.checkinId,
    total: foodOrders.total,
  }).from(foodOrders)
    .where(and(
      inArray(foodOrders.checkinId, idList),
      inArray(foodOrders.paymentStatus, ["on_tab", "pending"]),
      sql`${foodOrders.status} != 'cancelled'`,
    ));

  let pendingTab = 0;
  const orderIds: number[] = [];
  let checkinId: number | null = idList[0];
  for (const row of rows) {
    pendingTab += Number(row.total) || 0;
    if (row.id) orderIds.push(row.id);
    if (row.checkinId) checkinId = row.checkinId;
  }
  return { checkinId, pendingTab, pendingOrders: orderIds.length, orderIds };
}
