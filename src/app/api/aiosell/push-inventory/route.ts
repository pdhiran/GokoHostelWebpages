import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { getChannelConfig, getRoomTypeMappings, updateChannelSyncTime, getDirtyInventory, clearDirtyInventory, clearAllDirtyInventory } from "@/db/queries";
import { getDateAwareAvailability } from "@/lib/aiosellSync";
import { pushInventory, type AiosellConfig, type InventoryUpdate } from "@/lib/aiosell";
import { todayIST } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { password, username, startDate, endDate, fullSync } = await req.json();
    const auth = await authenticateUser(password, username);
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await getChannelConfig();
    if (!config || !config.isActive) {
      return NextResponse.json({ error: "Channel manager not configured or inactive" }, { status: 400 });
    }

    const roomMappings = await getRoomTypeMappings();
    const activeMappings = roomMappings.filter((m) => m.isActive);
    if (activeMappings.length === 0) {
      return NextResponse.json({ error: "No room type mappings configured" }, { status: 400 });
    }

    const aiosellConfig: AiosellConfig = {
      hotelCode: config.hotelCode,
      pmsId: config.pmsId,
      apiBaseUrl: config.apiBaseUrl,
      apiUsername: config.apiUsername,
      apiPassword: config.apiPassword,
    };

    const dirtyEntries = await getDirtyInventory();
    const useDirty = !fullSync && !startDate && !endDate && dirtyEntries.length > 0;

    let updates: InventoryUpdate[];
    let mode: string;

    if (useDirty) {
      mode = "incremental";
      const dormDatePairs = new Map<string, { dormId: number; date: string }>();
      for (const d of dirtyEntries) {
        dormDatePairs.set(`${d.dormId}:${d.date}`, { dormId: d.dormId, date: d.date });
      }

      updates = [];
      for (const { dormId, date } of dormDatePairs.values()) {
        const mapping = activeMappings.find((m) => m.dormId === dormId);
        if (!mapping) continue;
        const available = await getDateAwareAvailability(dormId, date);
        updates.push({ startDate: date, endDate: date, rooms: [{ roomCode: mapping.channelRoomCode, available }] });
      }
    } else {
      mode = "full";
      const start = startDate || todayIST();
      const end = endDate || (() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      })();

      const dates: string[] = [];
      const current = new Date(start + "T00:00:00");
      const endD = new Date(end + "T00:00:00");
      while (current <= endD) {
        dates.push(current.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
        current.setDate(current.getDate() + 1);
      }

      updates = [];
      for (const date of dates) {
        const rooms: Array<{ roomCode: string; available: number }> = [];
        for (const mapping of activeMappings) {
          const available = await getDateAwareAvailability(mapping.dormId, date);
          rooms.push({ roomCode: mapping.channelRoomCode, available });
        }
        updates.push({ startDate: date, endDate: date, rooms });
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: true, message: "Nothing to push", inventoryPushed: 0, mode });
    }

    const result = await pushInventory(aiosellConfig, updates);

    if (result.success) {
      await updateChannelSyncTime();
      if (useDirty) {
        await clearDirtyInventory(dirtyEntries.map((d) => d.id));
      } else {
        await clearAllDirtyInventory();
      }
    }

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message, warnings: result.warnings }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      warnings: result.warnings,
      inventoryPushed: updates.reduce((sum, u) => sum + u.rooms.length, 0),
      mode,
    });
  } catch (error: any) {
    console.error("Push inventory error:", error?.message);
    return NextResponse.json({ error: "Push failed: " + (error?.message || "Unknown") }, { status: 500 });
  }
}
