/**
 * Auto-sync helper: pushes inventory to Aiosell after bed status changes.
 * Called fire-and-forget from bed assign/checkout/booking creation flows.
 */

import { getChannelConfig, getRoomTypeMappings, addChannelSyncLog, updateChannelSyncTime, getActiveAssignmentCountForDorm } from "@/db/queries";
import { getDb } from "@/db";
import { beds } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { pushInventory, type AiosellConfig, type InventoryUpdate } from "@/lib/aiosell";

export async function getDateAwareAvailability(dormId: number, date: string): Promise<number> {
  const db = getDb();
  const totalRows = await db.select({ count: sql<number>`COUNT(*)` })
    .from(beds)
    .where(and(eq(beds.dormId, dormId), eq(beds.isBlocked, 0)));
  const totalBeds = totalRows[0]?.count ?? 0;

  const assignedCount = await getActiveAssignmentCountForDorm(dormId, date);

  return Math.max(0, totalBeds - assignedCount);
}

export async function triggerInventoryPush(): Promise<void> {
  try {
    const config = await getChannelConfig();
    if (!config || !config.isActive) return;

    const mappings = await getRoomTypeMappings();
    const activeMappings = mappings.filter((m) => m.isActive);
    if (activeMappings.length === 0) return;

    const today = new Date().toISOString().split("T")[0];

    const rooms: Array<{ roomCode: string; available: number }> = [];
    for (const mapping of activeMappings) {
      const available = await getDateAwareAvailability(mapping.dormId, today);
      rooms.push({ roomCode: mapping.channelRoomCode, available });
    }

    const updates: InventoryUpdate[] = [{ startDate: today, endDate: today, rooms }];

    const aiosellConfig: AiosellConfig = {
      hotelCode: config.hotelCode,
      pmsId: config.pmsId,
      apiBaseUrl: config.apiBaseUrl,
      apiUsername: config.apiUsername,
      apiPassword: config.apiPassword,
    };

    const result = await pushInventory(aiosellConfig, updates);

    await addChannelSyncLog({
      direction: "push",
      type: "inventory",
      status: result.success ? "success" : "failed",
      requestPayload: JSON.stringify(updates),
      responsePayload: JSON.stringify(result),
      errorMessage: result.success ? "" : (result.message || ""),
      recordsAffected: rooms.length,
    });

    if (result.success) await updateChannelSyncTime();
  } catch (error: any) {
    console.error("Auto inventory push failed:", error?.message);
    await addChannelSyncLog({
      direction: "push",
      type: "inventory",
      status: "failed",
      errorMessage: `Auto-push error: ${error?.message || "Unknown"}`,
    }).catch(() => {});
  }
}
