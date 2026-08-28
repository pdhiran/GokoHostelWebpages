import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { getChannelConfig, getRoomTypeMappings, getAvailableBedsForDorm, updateChannelSyncTime } from "@/db/queries";
import { pushInventory, type AiosellConfig, type InventoryUpdate } from "@/lib/aiosell";
import { todayIST } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { password, username } = await req.json();
    const auth = await authenticateUser(password, username);
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await getChannelConfig();
    if (!config || !config.isActive) {
      return NextResponse.json({ error: "Channel manager not configured or inactive" }, { status: 400 });
    }

    const mappings = await getRoomTypeMappings();
    const activeMappings = mappings.filter((m) => m.isActive);
    if (activeMappings.length === 0) {
      return NextResponse.json({ error: "No room type mappings configured" }, { status: 400 });
    }

    const rooms: Array<{ roomCode: string; available: number }> = [];
    for (const mapping of activeMappings) {
      const available = await getAvailableBedsForDorm(mapping.dormId);
      rooms.push({ roomCode: mapping.channelRoomCode, available });
    }

    const today = todayIST();
    const updates: InventoryUpdate[] = [{
      startDate: today,
      endDate: today,
      rooms,
    }];

    const aiosellConfig: AiosellConfig = {
      hotelCode: config.hotelCode,
      pmsId: config.pmsId,
      apiBaseUrl: config.apiBaseUrl,
      apiUsername: config.apiUsername,
      apiPassword: config.apiPassword,
    };

    const result = await pushInventory(aiosellConfig, updates);

    if (result.success) await updateChannelSyncTime();

    return NextResponse.json({
      success: result.success,
      message: result.message,
      warnings: result.warnings,
      pushed: rooms,
    });
  } catch (error: any) {
    console.error("Push inventory error:", error?.message);
    return NextResponse.json({ error: "Push failed: " + (error?.message || "Unknown") }, { status: 500 });
  }
}
