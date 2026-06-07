import { NextRequest, NextResponse } from "next/server";
import { getActiveCheckins, getAllBeds } from "@/db/queries";
import { normalizePhone } from "@/lib/phoneUtils";

export async function GET(req: NextRequest) {
  const rawPhone = req.nextUrl.searchParams.get("phone") || "";
  const normalized = normalizePhone(rawPhone);

  if (!normalized) {
    return NextResponse.json({ found: false, guests: [] });
  }

  try {
    const [checkins, allBeds] = await Promise.all([
      getActiveCheckins(),
      getAllBeds(),
    ]);

    const matches = checkins
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
        };
      });

    return NextResponse.json({
      found: matches.length > 0,
      guests: matches,
    });
  } catch (error: any) {
    console.error("Food lookup error:", error?.message || error);
    return NextResponse.json({ found: false, guests: [] });
  }
}
