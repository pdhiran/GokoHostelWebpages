import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { getChannelConfig, addChannelSyncLog } from "@/db/queries";
import { pushNoShow, type AiosellConfig } from "@/lib/aiosell";

export async function POST(req: NextRequest) {
  try {
    const { password, username, bookingId, partner } = await req.json();
    const auth = await authenticateUser(password, username);
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!bookingId || !partner) {
      return NextResponse.json({ error: "bookingId and partner are required" }, { status: 400 });
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

    const result = await pushNoShow(aiosellConfig, bookingId, partner);

    await addChannelSyncLog({
      direction: "push",
      type: "noshow",
      status: result.success ? "success" : "failed",
      requestPayload: JSON.stringify({ bookingId, partner }),
      responsePayload: JSON.stringify(result),
      errorMessage: result.success ? "" : (result.message || ""),
      recordsAffected: 1,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Push no-show error:", error?.message);
    return NextResponse.json({ error: "Push failed: " + (error?.message || "Unknown") }, { status: 500 });
  }
}
