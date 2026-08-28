import { normalizePhone } from "@/lib/phoneUtils";

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
