/**
 * Auto-sync helper: pushes inventory to Aiosell after bed status changes.
 * Called fire-and-forget from bed assign/checkout/booking creation flows.
 *
 * Golden Rule: Only push to Aiosell for Goko-originated changes.
 * Aiosell-originated events (OTA/Website bookings via webhook) must NOT push back.
 */

import { getChannelConfig, getRoomTypeMappings, addChannelSyncLog, updateChannelSyncTime, getActiveAssignmentCountForDorm, getBlockedBedIdsForDate } from "@/db/queries";
import { todayIST } from "@/lib/utils";
import { getDb } from "@/db";
import { beds } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { pushInventory, type AiosellConfig, type InventoryUpdate } from "@/lib/aiosell";

export async function getDateAwareAvailability(dormId: number, date: string): Promise<number> {
  const db = getDb();
  const totalRows = await db.select({ count: sql<number>`COUNT(*)` })
    .from(beds)
    .where(eq(beds.dormId, dormId));
  const totalBeds = totalRows[0]?.count ?? 0;

  const blockedBedIds = await getBlockedBedIdsForDate(dormId, date);
  const assignedCount = await getActiveAssignmentCountForDorm(dormId, date);

  return Math.max(0, totalBeds - blockedBedIds.length - assignedCount);
}

export async function triggerInventoryPush(affectedDates?: string[]): Promise<void> {
  try {
    const config = await getChannelConfig();
    if (!config || !config.isActive) return;

    const mappings = await getRoomTypeMappings();
    const activeMappings = mappings.filter((m) => m.isActive);
    if (activeMappings.length === 0) return;

    const dates = affectedDates && affectedDates.length > 0
      ? affectedDates
      : [todayIST()];

    const updates: InventoryUpdate[] = [];
    for (const date of dates) {
      const rooms: Array<{ roomCode: string; available: number }> = [];
      for (const mapping of activeMappings) {
        const available = await getDateAwareAvailability(mapping.dormId, date);
        rooms.push({ roomCode: mapping.channelRoomCode, available });
      }
      updates.push({ startDate: date, endDate: date, rooms });
    }

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
      recordsAffected: updates.reduce((sum, u) => sum + u.rooms.length, 0),
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
