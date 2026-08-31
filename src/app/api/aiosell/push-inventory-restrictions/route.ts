import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { getChannelConfig, getRoomTypeMappings, getRatePlanMappings, getAllDailyRates, updateChannelSyncTime } from "@/db/queries";
import { pushInventoryRestrictions, type AiosellConfig, type InventoryRestrictionUpdate, type RestrictionFields } from "@/lib/aiosell";
import { todayIST } from "@/lib/utils";
import { inclusiveNights } from "@/lib/inventoryAvailability";

export async function POST(req: NextRequest) {
  try {
    const { password, username, startDate, endDate } = await req.json();
    const auth = await authenticateUser(password, username);
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await getChannelConfig();
    if (!config || !config.isActive) {
      return NextResponse.json({ error: "Channel manager not configured or inactive" }, { status: 400 });
    }

    const start = startDate || todayIST();
    const end = endDate || (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); })();

    const roomMappings = await getRoomTypeMappings();
    const activeMappings = roomMappings.filter((m) => m.isActive);
    if (activeMappings.length === 0) {
      return NextResponse.json({ error: "No room type mappings configured" }, { status: 400 });
    }

    const allRatePlans = await getRatePlanMappings();
    const activeRatePlans = allRatePlans.filter((rp) => rp.isActive);
    const dailyRatesData = await getAllDailyRates(start, end);

    const ratesByPlanAndDate = new Map<string, typeof dailyRatesData[0]>();
    for (const dr of dailyRatesData) {
      ratesByPlanAndDate.set(`${dr.ratePlanId}:${dr.date}`, dr);
    }

    const dates = inclusiveNights(start, end);

    const updatesByDate = new Map<string, Array<{ roomCode: string; restrictions: RestrictionFields }>>();

    for (const mapping of activeMappings) {
      const mappingPlans = activeRatePlans.filter((rp) => rp.roomMappingId === mapping.id);
      if (mappingPlans.length === 0) continue;

      for (const date of dates) {
        const planRates = mappingPlans.map((rp) => ratesByPlanAndDate.get(`${rp.id}:${date}`)).filter(Boolean);
        if (planRates.length === 0) continue;

        // Room is stop-sold / COA / COD only if ALL rate plans agree; min/max across plans
        const restrictions: RestrictionFields = {
          stopSell: planRates.every((r) => r!.stopSell === 1),
          minimumStay: Math.min(...planRates.map((r) => r!.minimumStay ?? 1)),
          maximumStay: (() => { const vals = planRates.filter((r) => r!.maximumStay != null).map((r) => r!.maximumStay!); return vals.length ? Math.max(...vals) : null; })(),
          closeOnArrival: planRates.every((r) => r!.closeOnArrival === 1),
          closeOnDeparture: planRates.every((r) => r!.closeOnDeparture === 1),
          minimumAdvanceReservation: (() => { const vals = planRates.filter((r) => r!.minimumAdvanceReservation != null).map((r) => r!.minimumAdvanceReservation!); return vals.length ? Math.min(...vals) : null; })(),
          maximumAdvanceReservation: (() => { const vals = planRates.filter((r) => r!.maximumAdvanceReservation != null).map((r) => r!.maximumAdvanceReservation!); return vals.length ? Math.max(...vals) : null; })(),
          minimumStayArrival: null,
          maximumStayArrival: null,
          exactStayArrival: null,
        };

        const dateRooms = updatesByDate.get(date) || [];
        dateRooms.push({ roomCode: mapping.channelRoomCode, restrictions });
        updatesByDate.set(date, dateRooms);
      }
    }

    if (updatesByDate.size === 0) {
      return NextResponse.json({ error: "No restriction data found for the date range" }, { status: 400 });
    }

    const aiosellConfig: AiosellConfig = {
      hotelCode: config.hotelCode,
      pmsId: config.pmsId,
      apiBaseUrl: config.apiBaseUrl,
      apiUsername: config.apiUsername,
      apiPassword: config.apiPassword,
    };

    const updates: InventoryRestrictionUpdate[] = Array.from(updatesByDate.entries()).map(([date, rooms]) => ({
      startDate: date,
      endDate: date,
      rooms,
    }));

    const totalRestrictions = updates.reduce((sum, u) => sum + u.rooms.length, 0);
    const result = await pushInventoryRestrictions(aiosellConfig, updates);

    if (result.success) await updateChannelSyncTime();

    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.message,
        warnings: result.warnings,
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      warnings: result.warnings,
      restrictionsPushed: totalRestrictions,
    });
  } catch (error: any) {
    console.error("Push inventory restrictions error:", error?.message);
    return NextResponse.json({ error: "Push failed: " + (error?.message || "Unknown") }, { status: 500 });
  }
}
