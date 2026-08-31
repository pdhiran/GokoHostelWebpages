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

export function canLookupFoodTab(opts: {
  contact?: string | null;
  checkinId?: number | null;
}): boolean {
  if (typeof opts.checkinId === "number" && opts.checkinId > 0) return true;
  return Boolean(normalizePhone(opts.contact || ""));
}

export function foodTabUncheckedMessage(reason: "no-phone" | "lookup-failed"): string {
  if (reason === "no-phone") {
    return "No phone on this guest, so the food tab could not be checked. Check out anyway?";
  }
  return "Could not check the food tab. Check out anyway?";
}
