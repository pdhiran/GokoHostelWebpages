import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { getChannelConfig } from "@/db/queries";
import { pushNoShow, type AiosellConfig } from "@/lib/aiosell";

export async function POST(req: NextRequest) {
  try {
    const { password, username, bookingId } = await req.json();
    const auth = await authenticateUser(password, username);
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
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

    const result = await pushNoShow(aiosellConfig, bookingId);

    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (error: any) {
    console.error("Push no-show error:", error?.message);
    return NextResponse.json({ error: "Push failed: " + (error?.message || "Unknown") }, { status: 500 });
  }
}
