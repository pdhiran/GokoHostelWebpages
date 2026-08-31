import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { getChannelConfig } from "@/db/queries";
import { fetchFromAiosell, type AiosellConfig } from "@/lib/aiosell";
import { ingestFetchedReservations } from "@/app/api/aiosell/reservations/route";

export async function POST(req: NextRequest) {
  try {
    const { password, username, type, startDate, endDate } = await req.json();
    const auth = await authenticateUser(password, username);
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!type || !startDate || !endDate) {
      return NextResponse.json({ error: "type, startDate, and endDate are required" }, { status: 400 });
    }

    if (!["inventory", "rates", "reservation"].includes(type)) {
      return NextResponse.json({ error: "type must be inventory, rates, or reservation" }, { status: 400 });
    }

    const config = await getChannelConfig();
    if (!config || !config.isActive) {
      return NextResponse.json({ error: "Channel manager not configured or inactive" }, { status: 400 });
    }

    const aiosellConfig: AiosellConfig = {
      hotelCode: config.hotelCode,
      pmsId: config.pmsId,
      apiBaseUrl: config.apiBaseUrl,
      apiUsername: config.apiUsername,
      apiPassword: config.apiPassword,
    };

    const result = await fetchFromAiosell(aiosellConfig, type, startDate, endDate);

    if (type === "reservation") {
      const ingested = await ingestFetchedReservations(result);
      if (Array.isArray(result)) {
        return NextResponse.json({ success: true, data: result, ingested });
      }
      return NextResponse.json({ ...result, ingested });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Fetch from Aiosell error:", error?.message);
    return NextResponse.json({ error: "Fetch failed: " + (error?.message || "Unknown") }, { status: 500 });
  }
}
