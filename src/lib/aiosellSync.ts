/**
 * Auto-sync helper: pushes inventory to Aiosell after bed status changes.
 * Called fire-and-forget from bed assign/checkout/booking creation flows.
 *
 * Golden Rule: Only push to Aiosell for Goko-originated changes.
 * Aiosell-originated events (OTA/Website bookings via webhook) must NOT push back.
 */

import { getChannelConfig, getRoomTypeMappings, getRatePlanMappings, getAllDailyRates, updateChannelSyncTime, getActiveAssignmentCountForDorm, getOnlineAssignmentCountForDorm, getBlockedBedIdsForDate, getInventoryOverrideForDormDate, markInventoryDirty, getDirtyInventory, clearDirtyInventory } from "@/db/queries";
import { logPmsCall } from "@/lib/pmsLog";
import { todayIST } from "@/lib/utils";
import { getDb } from "@/db";
import { beds } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { pushInventory, pushRates, pushRateRestrictions, type AiosellConfig, type InventoryUpdate, type RateUpdate, type RateRestrictionUpdate, type RestrictionFields, type RestrictionPatch } from "@/lib/aiosell";

export async function getDateAwareAvailability(dormId: number, date: string): Promise<number> {
  const db = getDb();
  const totalRows = await db.select({ count: sql<number>`COUNT(*)` })
    .from(beds)
    .where(eq(beds.dormId, dormId));
  const totalBeds = totalRows[0]?.count ?? 0;

  const blockedBedIds = await getBlockedBedIdsForDate(dormId, date);
  const assignedCount = await getActiveAssignmentCountForDorm(dormId, date);
  const onlineAssigned = await getOnlineAssignmentCountForDorm(dormId, date);

  const override = await getInventoryOverrideForDormDate(dormId, date);
  const ceiling = override?.onlineAvailable ?? totalBeds;
  const available = Math.max(0, totalBeds - blockedBedIds.length - assignedCount);
  return Math.min(available, Math.max(0, ceiling - onlineAssigned));
}

export async function otaFingerprint(dormIds: number[], dates: string[]): Promise<string> {
  const dorms = [...new Set(dormIds.filter((id) => id > 0))];
  const nights = [...new Set(dates.filter(Boolean))];
  const parts: string[] = [];
  for (const dormId of dorms) {
    for (const date of nights) {
      parts.push(`${dormId}:${date}:${await getDateAwareAvailability(dormId, date)}`);
    }
  }
  return parts.sort().join("|");
}

export async function pushIfOtaChanged(before: string, dormIds: number[], dates: string[]): Promise<void> {
  if (dates.length === 0 || dormIds.length === 0) return;
  const after = await otaFingerprint(dormIds, dates);
  if (before !== after) await triggerInventoryPush(dates);
}

export async function triggerInventoryPush(affectedDates?: string[], affectedDormId?: number): Promise<void> {
  try {
    if (affectedDates && affectedDates.length === 0) return;
    const dates = affectedDates && affectedDates.length > 0
      ? [...new Set(affectedDates)]
      : [todayIST()];

    const config = await getChannelConfig();
    const mappings = config ? (await getRoomTypeMappings()).filter((m) => m.isActive) : [];

    if (affectedDormId) {
      if (mappings.some((m) => m.dormId === affectedDormId)) {
        await markInventoryDirty(affectedDormId, dates).catch(() => {});
      }
    } else if (mappings.length > 0) {
      for (const m of mappings) {
        await markInventoryDirty(m.dormId, dates).catch(() => {});
      }
    }

    if (!config || !config.isActive) return;
    if (!config.autoPushInventory) return;
    if (mappings.length === 0) return;

    let activeMappings = mappings;
    if (affectedDormId) {
      activeMappings = activeMappings.filter((m) => m.dormId === affectedDormId);
      if (activeMappings.length === 0) return;
    }

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

    const result = await pushInventory(aiosellConfig, updates, undefined, "auto");

    if (result.success) {
      await updateChannelSyncTime();
      const dirty = await getDirtyInventory();
      const pushedDormIds = new Set(activeMappings.map((m) => m.dormId));
      const pushedDates = new Set(dates);
      const toClear = dirty.filter((d) => pushedDormIds.has(d.dormId) && pushedDates.has(d.date)).map((d) => d.id);
      if (toClear.length > 0) await clearDirtyInventory(toClear);
    }
  } catch (error: any) {
    console.error("Auto inventory push failed:", error?.message);
    await logPmsCall({
      direction: "push",
      type: "inventory",
      status: "failed",
      errorMessage: `Auto-push error: ${error?.message || "Unknown"}`,
    }).catch(() => {});
  }
}

function buildAiosellConfig(config: any): AiosellConfig {
  return { hotelCode: config.hotelCode, pmsId: config.pmsId, apiBaseUrl: config.apiBaseUrl, apiUsername: config.apiUsername, apiPassword: config.apiPassword };
}

export async function triggerRatePush(affectedDates: string[], affectedRatePlanIds?: number[]): Promise<void> {
  try {
    const config = await getChannelConfig();
    if (!config || !config.isActive || !config.autoPushRates) return;

    const dates = [...new Set(affectedDates)];
    if (dates.length === 0) return;
    const start = dates.sort()[0];
    const end = dates[dates.length - 1];

    const mappings = (await getRoomTypeMappings()).filter((m) => m.isActive);
    let ratePlans = (await getRatePlanMappings()).filter((rp) => rp.isActive);
    if (affectedRatePlanIds?.length) {
      ratePlans = ratePlans.filter((rp) => affectedRatePlanIds.includes(rp.id));
    }
    const dailyRatesData = await getAllDailyRates(start, end);

    const ratesByPlan = new Map<number, typeof dailyRatesData>();
    for (const dr of dailyRatesData) {
      const arr = ratesByPlan.get(dr.ratePlanId) || [];
      arr.push(dr);
      ratesByPlan.set(dr.ratePlanId, arr);
    }

    const updates: RateUpdate[] = [];
    for (const date of dates) {
      const rates: Array<{ roomCode: string; rateplanCode: string; rate: number }> = [];
      for (const rp of ratePlans) {
        const mapping = mappings.find((m) => m.id === rp.roomMappingId);
        if (!mapping) continue;
        const dr = (ratesByPlan.get(rp.id) || []).find((r) => r.date === date);
        if (!dr) continue;
        rates.push({ roomCode: mapping.channelRoomCode, rateplanCode: rp.ratePlanCode, rate: dr.adult1Rate ?? dr.rate });
      }
      if (rates.length > 0) updates.push({ startDate: date, endDate: date, rates });
    }

    if (updates.length === 0) return;
    const result = await pushRates(buildAiosellConfig(config), updates);
    if (result.success) await updateChannelSyncTime();
  } catch (error: any) {
    console.error("Auto rate push failed:", error?.message);
    await logPmsCall({ direction: "push", type: "rate", status: "failed", errorMessage: `Auto-push error: ${error?.message || "Unknown"}` }).catch(() => {});
  }
}

export async function triggerRestrictionPush(affectedDates: string[], affectedRatePlanIds?: number[], patch?: RestrictionPatch): Promise<void> {
  try {
    const config = await getChannelConfig();
    if (!config || !config.isActive || !config.autoPushRateRestrictions) return;

    const dates = [...new Set(affectedDates)].sort();
    if (dates.length === 0) return;
    const start = dates[0];
    const end = dates[dates.length - 1];

    const mappings = (await getRoomTypeMappings()).filter((m) => m.isActive);
    let ratePlans = (await getRatePlanMappings()).filter((rp) => rp.isActive);
    if (affectedRatePlanIds?.length) {
      ratePlans = ratePlans.filter((rp) => affectedRatePlanIds.includes(rp.id));
    }

    const mappedPlans = ratePlans.flatMap((rp) => {
      const mapping = mappings.find((m) => m.id === rp.roomMappingId);
      return mapping ? [{ rp, mapping }] : [];
    });
    if (mappedPlans.length === 0) return;

    const updates: RateRestrictionUpdate[] = [];
    const usePatch = patch && Object.keys(patch).length > 0;

    if (usePatch) {
      for (const date of dates) {
        updates.push({
          startDate: date,
          endDate: date,
          rates: mappedPlans.map(({ rp, mapping }) => ({
            roomCode: mapping.channelRoomCode,
            rateplanCode: rp.ratePlanCode,
            restrictions: patch,
          })),
        });
      }
    } else {
      const dailyRatesData = await getAllDailyRates(start, end);
      const ratesByPlan = new Map<number, typeof dailyRatesData>();
      for (const dr of dailyRatesData) {
        const arr = ratesByPlan.get(dr.ratePlanId) || [];
        arr.push(dr);
        ratesByPlan.set(dr.ratePlanId, arr);
      }
      for (const date of dates) {
        const rates: Array<{ roomCode: string; rateplanCode: string; restrictions: RestrictionFields }> = [];
        for (const { rp, mapping } of mappedPlans) {
          const dr = (ratesByPlan.get(rp.id) || []).find((r) => r.date === date);
          if (!dr) continue;
          rates.push({
            roomCode: mapping.channelRoomCode, rateplanCode: rp.ratePlanCode,
            restrictions: { stopSell: dr.stopSell === 1, minimumStay: dr.minimumStay ?? null, maximumStay: dr.maximumStay ?? null, closeOnArrival: dr.closeOnArrival === 1, closeOnDeparture: dr.closeOnDeparture === 1, minimumAdvanceReservation: dr.minimumAdvanceReservation ?? null, maximumAdvanceReservation: dr.maximumAdvanceReservation ?? null, minimumStayArrival: null, maximumStayArrival: null, exactStayArrival: null },
          });
        }
        if (rates.length > 0) updates.push({ startDate: date, endDate: date, rates });
      }
    }

    if (updates.length === 0) return;
    const result = await pushRateRestrictions(buildAiosellConfig(config), updates);
    if (result.success) await updateChannelSyncTime();
  } catch (error: any) {
    console.error("Auto restriction push failed:", error?.message);
    await logPmsCall({ direction: "push", type: "restriction", status: "failed", errorMessage: `Auto-push error: ${error?.message || "Unknown"}` }).catch(() => {});
  }
}
