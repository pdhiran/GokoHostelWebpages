import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { triggerInventoryPush, triggerRatePush, triggerRestrictionPush } from "@/lib/aiosellSync";
import {
  getInventoryGridData, getChannels, upsertChannel, deleteChannel,
  getBedTypeConfigs, upsertBedTypeConfig,
  getActiveBedBlocks, createBedBlock, deactivateBedBlock, deactivateBedBlocksByBedIds,
  upsertInventoryOverride,
  getChannelRatesForRange, upsertChannelRate,
  getDailyRates, upsertDailyRate,
} from "@/db/queries";

const ACTION_PERMISSIONS: Record<string, string> = {
  getInventoryGrid: "canManageInventory",
  getChannels: "canManageInventory",
  upsertChannel: "canManageInventory",
  deleteChannel: "canManageInventory",
  getBedTypeConfigs: "canManageInventory",
  upsertBedTypeConfig: "canManageInventory",
  getActiveBlocks: "canManageInventory",
  blockBeds: "canManageInventory",
  unblockBeds: "canManageInventory",
  updateInventoryOverride: "canManageInventory",
  getChannelRates: "canManageInventory",
  updateChannelRate: "canManageInventory",
  updateRate: "canManageInventory",
  bulkSetRates: "canManageInventory",
  bulkAdjustRates: "canManageInventory",
  bulkSetRestrictions: "canManageInventory",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, username, action, ...params } = body;

    const auth = await authenticateUser(password, username);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { role, permissions } = auth;

    const requiredPerm = ACTION_PERMISSIONS[action];
    if (!requiredPerm) return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    if (role !== "admin" && !permissions[requiredPerm]) {
      return NextResponse.json({ error: "You don't have permission to perform this action" }, { status: 403 });
    }

    const actingUser = username || role;

    if (action === "getInventoryGrid") {
      const { startDate, endDate } = params;
      if (!startDate || !endDate) return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
      const data = await getInventoryGridData(startDate, endDate);
      const bedConfigs = await getBedTypeConfigs();
      return NextResponse.json({ ...data, bedConfigs });
    }

    if (action === "getChannels") {
      const data = await getChannels();
      return NextResponse.json({ channels: data });
    }

    if (action === "upsertChannel") {
      const { id, name, code, isActive } = params;
      if (!name || !code) return NextResponse.json({ error: "name and code required" }, { status: 400 });
      await upsertChannel({ id, name, code, isActive });
      const data = await getChannels();
      return NextResponse.json({ success: true, channels: data });
    }

    if (action === "deleteChannel") {
      const { id } = params;
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      await deleteChannel(id);
      return NextResponse.json({ success: true });
    }

    if (action === "getBedTypeConfigs") {
      const { dormId } = params;
      const data = await getBedTypeConfigs(dormId);
      return NextResponse.json({ configs: data });
    }

    if (action === "upsertBedTypeConfig") {
      const { id, dormId, bedType, maxOccupancy, extraPersonAllowed } = params;
      if (!dormId || !bedType) return NextResponse.json({ error: "dormId and bedType required" }, { status: 400 });
      await upsertBedTypeConfig({ id, dormId, bedType, maxOccupancy: maxOccupancy ?? 1, extraPersonAllowed: extraPersonAllowed ?? 0 });
      const data = await getBedTypeConfigs();
      return NextResponse.json({ success: true, configs: data });
    }

    if (action === "getActiveBlocks") {
      const { dormId, startDate, endDate } = params;
      const data = await getActiveBedBlocks(dormId, startDate, endDate);
      return NextResponse.json({ blocks: data });
    }

    if (action === "blockBeds") {
      const { bedIds, dormId, startDate, endDate, reason } = params;
      if (!bedIds?.length || !dormId || !startDate || !endDate) return NextResponse.json({ error: "bedIds, dormId, startDate, endDate required" }, { status: 400 });
      if (startDate >= endDate) return NextResponse.json({ error: "startDate must be before endDate" }, { status: 400 });
      for (const bedId of bedIds) {
        await createBedBlock({ bedId, dormId, startDate, endDate, reason: reason || "", blockedBy: actingUser });
      }
      const dates = generateDateRange(startDate, endDate);
      await triggerInventoryPush(dates, dormId).catch(() => {});
      return NextResponse.json({ success: true, blocked: bedIds.length });
    }

    if (action === "unblockBeds") {
      const { blockIds, bedIds, startDate, endDate } = params;
      let pushDates: string[] | undefined;
      let pushDormId: number | undefined;
      if (blockIds?.length) {
        const blocks = await getActiveBedBlocks();
        const targeted = blocks.filter((b: any) => blockIds.includes(b.id));
        if (targeted.length > 0) {
          const allDates = new Set<string>();
          const dormIds = new Set<number>();
          for (const b of targeted) {
            generateDateRange(b.startDate, b.endDate).forEach((d) => allDates.add(d));
            dormIds.add(b.dormId);
          }
          pushDates = [...allDates];
          if (dormIds.size === 1) pushDormId = [...dormIds][0];
        }
        for (const blockId of blockIds) {
          await deactivateBedBlock(blockId, actingUser);
        }
      } else if (bedIds?.length && startDate && endDate) {
        await deactivateBedBlocksByBedIds(bedIds, startDate, endDate, actingUser);
        pushDates = generateDateRange(startDate, endDate);
      } else {
        return NextResponse.json({ error: "blockIds or (bedIds + dates) required" }, { status: 400 });
      }
      await triggerInventoryPush(pushDates, pushDormId).catch(() => {});
      return NextResponse.json({ success: true });
    }

    if (action === "updateInventoryOverride") {
      const { dormId, channelId, date, onlineAvailable, offlineAvailable } = params;
      if (!dormId || !date) return NextResponse.json({ error: "dormId and date required" }, { status: 400 });
      await upsertInventoryOverride({ dormId, channelId: channelId || null, date, onlineAvailable, offlineAvailable, overriddenBy: actingUser });
      await triggerInventoryPush([date], dormId).catch(() => {});
      return NextResponse.json({ success: true });
    }

    if (action === "getChannelRates") {
      const { ratePlanId, channelId, startDate, endDate } = params;
      if (!ratePlanId || !channelId || !startDate || !endDate) return NextResponse.json({ error: "ratePlanId, channelId, startDate, endDate required" }, { status: 400 });
      const data = await getChannelRatesForRange(ratePlanId, channelId, startDate, endDate);
      return NextResponse.json({ rates: data });
    }

    if (action === "updateChannelRate") {
      const { ratePlanId, channelId, date, adult1Rate, adult2Rate, childRate, infantRate, extraPersonRate } = params;
      if (!ratePlanId || !channelId || !date) return NextResponse.json({ error: "ratePlanId, channelId, date required" }, { status: 400 });
      await upsertChannelRate({ ratePlanId, channelId, date, adult1Rate, adult2Rate, childRate, infantRate, extraPersonRate, updatedBy: actingUser });
      return NextResponse.json({ success: true });
    }

    if (action === "updateRate") {
      const { ratePlanId, date, rate, adult1Rate, adult2Rate, childRate, infantRate, extraPersonRate, stopSell, minimumStay, maximumStay, closeOnArrival, closeOnDeparture } = params;
      if (!ratePlanId || !date) return NextResponse.json({ error: "ratePlanId and date required" }, { status: 400 });
      const existing = (await getDailyRates(ratePlanId, date, date))[0];
      await upsertDailyRate({
        ratePlanId, date,
        rate: rate ?? existing?.rate ?? 0,
        adult1Rate: adult1Rate !== undefined ? adult1Rate : (existing?.adult1Rate ?? null),
        adult2Rate: adult2Rate !== undefined ? adult2Rate : (existing?.adult2Rate ?? null),
        childRate: childRate !== undefined ? childRate : (existing?.childRate ?? null),
        infantRate: infantRate !== undefined ? infantRate : (existing?.infantRate ?? null),
        extraPersonRate: extraPersonRate !== undefined ? extraPersonRate : (existing?.extraPersonRate ?? null),
        stopSell: stopSell !== undefined ? stopSell : (existing?.stopSell ?? 0),
        minimumStay: minimumStay !== undefined ? minimumStay : (existing?.minimumStay ?? 1),
        maximumStay: maximumStay !== undefined ? maximumStay : (existing?.maximumStay ?? null),
        closeOnArrival: closeOnArrival !== undefined ? closeOnArrival : (existing?.closeOnArrival ?? 0),
        closeOnDeparture: closeOnDeparture !== undefined ? closeOnDeparture : (existing?.closeOnDeparture ?? 0),
        updatedBy: actingUser,
      });
      await triggerRatePush([date], [ratePlanId]).catch(() => {});
      return NextResponse.json({ success: true });
    }

    if (action === "bulkSetRates") {
      const { ratePlanId, dates, dayFilter, channelId, adult1Rate, adult2Rate, childRate, infantRate, extraPersonRate, rate } = params;
      if (!ratePlanId || !dates?.length) return NextResponse.json({ error: "ratePlanId and dates required" }, { status: 400 });
      const filteredDates = filterByDays(dates, dayFilter);
      const existingRates = !channelId && filteredDates.length > 0 ? await getDailyRates(ratePlanId, filteredDates[0], filteredDates[filteredDates.length - 1]) : [];
      const existingByDate = new Map(existingRates.map((r: any) => [r.date, r]));
      let count = 0;
      for (const date of filteredDates) {
        if (channelId) {
          await upsertChannelRate({ ratePlanId, channelId, date, adult1Rate, adult2Rate, childRate, infantRate, extraPersonRate, updatedBy: actingUser });
        } else {
          const existing = existingByDate.get(date);
          await upsertDailyRate({
            ratePlanId, date,
            rate: rate ?? adult1Rate ?? 0,
            adult1Rate: adult1Rate ?? existing?.adult1Rate ?? null,
            adult2Rate: adult2Rate ?? existing?.adult2Rate ?? null,
            childRate: childRate ?? existing?.childRate ?? null,
            infantRate: infantRate ?? existing?.infantRate ?? null,
            extraPersonRate: extraPersonRate ?? existing?.extraPersonRate ?? null,
            stopSell: existing?.stopSell ?? 0,
            minimumStay: existing?.minimumStay ?? 1,
            maximumStay: existing?.maximumStay ?? null,
            closeOnArrival: existing?.closeOnArrival ?? 0,
            closeOnDeparture: existing?.closeOnDeparture ?? 0,
            minimumAdvanceReservation: existing?.minimumAdvanceReservation ?? null,
            maximumAdvanceReservation: existing?.maximumAdvanceReservation ?? null,
            updatedBy: actingUser,
          });
        }
        count++;
      }
      await triggerRatePush(filteredDates, [ratePlanId]).catch(() => {});
      return NextResponse.json({ success: true, updated: count });
    }

    if (action === "bulkAdjustRates") {
      const { ratePlanIds, startDate, endDate, dayFilter, channelId, direction, value, type } = params;
      if (!ratePlanIds?.length || !startDate || !endDate || value == null) return NextResponse.json({ error: "ratePlanIds, dates, value required" }, { status: 400 });
      const allDates = generateDateRange(startDate, endDate);
      const filteredDates = filterByDays(allDates, dayFilter);
      let count = 0;
      for (const rpId of ratePlanIds) {
        const existingRates = await getDailyRates(rpId, startDate, endDate);
        for (const date of filteredDates) {
          const existing = existingRates.find((r) => r.date === date);
          if (!existing) continue;
          const currentRate = existing.rate;
          let newRate: number;
          if (type === "percentage") {
            const delta = Math.round(currentRate * (value / 100));
            newRate = direction === "increase" ? currentRate + delta : currentRate - delta;
          } else {
            newRate = direction === "increase" ? currentRate + value : currentRate - value;
          }
          newRate = Math.max(0, newRate);
          const adjustAmount = (val: number | null): number | null => {
            if (val == null) return null;
            if (type === "percentage") {
              const delta = Math.round(val * (value / 100));
              return Math.max(0, direction === "increase" ? val + delta : val - delta);
            }
            return Math.max(0, direction === "increase" ? val + value : val - value);
          };
          await upsertDailyRate({
            ratePlanId: rpId, date, rate: newRate, updatedBy: actingUser,
            stopSell: existing.stopSell,
            minimumStay: existing.minimumStay,
            maximumStay: existing.maximumStay,
            closeOnArrival: existing.closeOnArrival,
            closeOnDeparture: existing.closeOnDeparture,
            minimumAdvanceReservation: existing.minimumAdvanceReservation,
            maximumAdvanceReservation: existing.maximumAdvanceReservation,
            adult1Rate: adjustAmount(existing.adult1Rate),
            adult2Rate: adjustAmount(existing.adult2Rate),
            childRate: existing.childRate,
            infantRate: existing.infantRate,
            extraPersonRate: existing.extraPersonRate,
          });
          count++;
        }
      }
      await triggerRatePush(filteredDates, ratePlanIds).catch(() => {});
      return NextResponse.json({ success: true, updated: count });
    }

    if (action === "bulkSetRestrictions") {
      const { ratePlanIds, startDate, endDate, dayFilter, restrictionType, value } = params;
      if (!ratePlanIds?.length || !startDate || !endDate || !restrictionType) return NextResponse.json({ error: "ratePlanIds, dates, restrictionType required" }, { status: 400 });
      const allDates = generateDateRange(startDate, endDate);
      const filteredDates = filterByDays(allDates, dayFilter);
      let count = 0;
      for (const rpId of ratePlanIds) {
        const existingRates = await getDailyRates(rpId, startDate, endDate);
        const ratesByDate = new Map(existingRates.map((r: any) => [r.date, r]));
        for (const date of filteredDates) {
          const existing = ratesByDate.get(date);
          if (!existing) continue;
          const updateData: any = {
            ratePlanId: rpId, date, updatedBy: actingUser,
            rate: existing?.rate ?? 0,
            stopSell: existing?.stopSell ?? 0,
            minimumStay: existing?.minimumStay ?? 1,
            maximumStay: existing?.maximumStay ?? null,
            closeOnArrival: existing?.closeOnArrival ?? 0,
            closeOnDeparture: existing?.closeOnDeparture ?? 0,
            minimumAdvanceReservation: existing?.minimumAdvanceReservation ?? null,
            maximumAdvanceReservation: existing?.maximumAdvanceReservation ?? null,
            adult1Rate: existing?.adult1Rate ?? null,
            adult2Rate: existing?.adult2Rate ?? null,
            childRate: existing?.childRate ?? null,
            infantRate: existing?.infantRate ?? null,
            extraPersonRate: existing?.extraPersonRate ?? null,
          };

          switch (restrictionType) {
            case "stopSell": updateData.stopSell = value ? 1 : 0; break;
            case "closeOnArrival": updateData.closeOnArrival = value ? 1 : 0; break;
            case "closeOnDeparture": updateData.closeOnDeparture = value ? 1 : 0; break;
            case "minimumStay": updateData.minimumStay = value; break;
            case "maximumStay": updateData.maximumStay = value; break;
            case "minimumAdvanceReservation": updateData.minimumAdvanceReservation = value; break;
            case "maximumAdvanceReservation": updateData.maximumAdvanceReservation = value; break;
            default: return NextResponse.json({ error: `Unknown restrictionType: ${restrictionType}` }, { status: 400 });
          }
          await upsertDailyRate(updateData);
          count++;
        }
      }
      await triggerRestrictionPush(filteredDates, ratePlanIds).catch(() => {});
      return NextResponse.json({ success: true, updated: count });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error("Inventory API error:", error?.message);
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}

function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  while (current <= end) {
    dates.push(current.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function filterByDays(dates: string[], dayFilter?: number[]): string[] {
  if (!dayFilter || dayFilter.length === 0 || dayFilter.length === 7) return dates;
  return dates.filter((d) => {
    const day = new Date(d + "T00:00:00").getDay();
    return dayFilter.includes(day);
  });
}
