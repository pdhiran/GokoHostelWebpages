import { normalizePhone } from "@/lib/phoneUtils";

export const DEFAULT_FOOD_TAX_PERCENT = 5;

/** `food_tax_rate` percent. 0 is 0% — do not `Number(x) || 5`. */
export function foodTaxPercent(raw: unknown): number {
  if (raw == null || raw === "") return DEFAULT_FOOD_TAX_PERCENT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_FOOD_TAX_PERCENT;
  return Math.min(100, n);
}

export function foodTaxRateFromAmounts(subtotal: number, tax: number): number {
  if (!(subtotal > 0)) return 0;
  return Math.round((Number(tax) * 100) / subtotal);
}

export function parseFoodCheckoutGraceDays(setting: string | null | undefined): number {
  if (setting == null || setting === "") return 10;
  const parsed = Number(setting);
  return Number.isFinite(parsed) ? parsed : 10;
}

export type FoodLookupGuest = {
  checkinId: number;
  name: string;
  phone: string;
  roomInfo: string;
  checkedOut: boolean;
};

export function buildFoodLookupGuests(
  normalized: string,
  activeCheckins: { id: number; name: string; contact: string | null }[],
  allBeds: { guestContact: string | null; dormName: string; bedId: string }[],
  checkedOutGuests: { id: number; name: string; contact: string | null }[]
): FoodLookupGuest[] {
  const activeMatches = activeCheckins
    .filter((c) => normalizePhone(c.contact || "") === normalized)
    .map((c) => {
      const bed = allBeds.find(
        (b) => b.guestContact && normalizePhone(b.guestContact) === normalized
      );
      const roomInfo = bed ? `${bed.dormName} - Bed ${bed.bedId}` : "";
      return {
        checkinId: c.id,
        name: c.name,
        phone: normalizePhone(c.contact || ""),
        roomInfo,
        checkedOut: false,
      };
    });

  const activeIds = new Set(activeMatches.map((m) => m.checkinId));

  const checkedOutMatches = checkedOutGuests
    .filter((c) => normalizePhone(c.contact || "") === normalized && !activeIds.has(c.id))
    .map((c) => ({
      checkinId: c.id,
      name: c.name,
      phone: normalizePhone(c.contact || ""),
      roomInfo: "",
      checkedOut: true,
    }));

  return [...activeMatches, ...checkedOutMatches];
}
