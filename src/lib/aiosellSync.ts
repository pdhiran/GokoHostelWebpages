/**
 * Auto-sync helper: pushes inventory to Aiosell after bed status changes.
 * Called fire-and-forget from bed assign/checkout/booking creation flows.
 */

import { getChannelConfig, getRoomTypeMappings, getAvailableBedsForDorm, addChannelSyncLog, updateChannelSyncTime } from "@/db/queries";
import { pushInventory, type AiosellConfig, type InventoryUpdate } from "@/lib/aiosell";

export async function triggerInventoryPush(): Promise<void> {
  try {
    const config = await getChannelConfig();
    if (!config || !config.isActive) return;

    const mappings = await getRoomTypeMappings();
    const activeMappings = mappings.filter((m) => m.isActive);
    if (activeMappings.length === 0) return;

    const rooms: Array<{ roomCode: string; available: number }> = [];
    for (const mapping of activeMappings) {
      const available = await getAvailableBedsForDorm(mapping.dormId);
      rooms.push({ roomCode: mapping.channelRoomCode, available });
    }

    const today = new Date().toISOString().split("T")[0];
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
