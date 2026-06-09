import { NextRequest, NextResponse } from "next/server";
import { getActiveCheckins, getAllBeds, getRecentlyCheckedOutGuests, getSetting } from "@/db/queries";
import { normalizePhone } from "@/lib/phoneUtils";

export async function GET(req: NextRequest) {
  const rawPhone = req.nextUrl.searchParams.get("phone") || "";
  const normalized = normalizePhone(rawPhone);

  if (!normalized) {
    return NextResponse.json({ found: false, guests: [] });
  }

  try {
    const graceDaysStr = await getSetting("food_checkout_grace_days");
    const graceDays = Number(graceDaysStr) || 10;

    const [activeCheckins, allBeds, checkedOutGuests] = await Promise.all([
      getActiveCheckins(),
      getAllBeds(),
      graceDays > 0 ? getRecentlyCheckedOutGuests(graceDays) : Promise.resolve([]),
    ]);

    const activeMatches = activeCheckins
      .filter((c) => normalizePhone(c.contact) === normalized)
      .map((c) => {
        const bed = allBeds.find(
          (b) => b.guestContact && normalizePhone(b.guestContact) === normalized
        );
        const roomInfo = bed ? `${bed.dormName} - Bed ${bed.bedId}` : "";
        return {
          checkinId: c.id,
          name: c.name,
          phone: normalizePhone(c.contact),
          roomInfo,
          checkedOut: false,
        };
      });

    const activeIds = new Set(activeMatches.map((m) => m.checkinId));

    const checkedOutMatches = checkedOutGuests
      .filter((c) => normalizePhone(c.contact) === normalized && !activeIds.has(c.id))
      .map((c) => ({
        checkinId: c.id,
        name: c.name,
        phone: normalizePhone(c.contact),
        roomInfo: "",
        checkedOut: true,
      }));

    const matches = [...activeMatches, ...checkedOutMatches];

    return NextResponse.json({
      found: matches.length > 0,
      guests: matches,
    });
  } catch (error: any) {
    console.error("Food lookup error:", error?.message || error);
    return NextResponse.json({ found: false, guests: [] });
  }
}
