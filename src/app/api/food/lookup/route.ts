import { NextRequest, NextResponse } from "next/server";
import {
  getActiveCheckins,
  getAllBeds,
  getLatestCheckinByNormalizedPhone,
  getRecentlyCheckedOutGuests,
  getSetting,
} from "@/db/queries";
import { buildFoodLookupGuests, parseFoodCheckoutGraceDays } from "@/lib/foodLookup";
import { normalizePhone } from "@/lib/phoneUtils";

export async function GET(req: NextRequest) {
  const rawPhone = req.nextUrl.searchParams.get("phone") || "";
  const normalized = normalizePhone(rawPhone);

  if (!normalized) {
    return NextResponse.json({ found: false, guests: [] });
  }

  try {
    const graceDays = parseFoodCheckoutGraceDays(await getSetting("food_checkout_grace_days"));

    const [activeCheckins, allBeds, checkedOutGuests] = await Promise.all([
      getActiveCheckins(),
      getAllBeds(),
      graceDays > 0 ? getRecentlyCheckedOutGuests(graceDays) : Promise.resolve([]),
    ]);

    const matches = buildFoodLookupGuests(normalized, activeCheckins, allBeds, checkedOutGuests);

    let displayName: string | undefined;
    if (matches.length === 0) {
      const past = await getLatestCheckinByNormalizedPhone(normalized);
      const name = past?.name?.trim();
      if (name) displayName = name;
    }

    return NextResponse.json({
      found: matches.length > 0,
      guests: matches,
      ...(displayName ? { displayName } : {}),
    });
  } catch (error: any) {
    console.error("Food lookup error:", error?.message || error);
    return NextResponse.json({ found: false, guests: [] });
  }
}
