import { NextRequest, NextResponse } from "next/server";
import { getActiveCheckins, getAllBeds, getRecentlyCheckedOutGuests, getSetting } from "@/db/queries";
import { buildFoodLookupGuests } from "@/lib/foodLookup";
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

    const matches = buildFoodLookupGuests(normalized, activeCheckins, allBeds, checkedOutGuests);

    return NextResponse.json({
      found: matches.length > 0,
      guests: matches,
    });
  } catch (error: any) {
    console.error("Food lookup error:", error?.message || error);
    return NextResponse.json({ found: false, guests: [] });
  }
}
