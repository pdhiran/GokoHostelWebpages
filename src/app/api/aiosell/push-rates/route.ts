import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { getChannelConfig, getRoomTypeMappings, getRatePlanMappings, getAllDailyRates, addChannelSyncLog, updateChannelSyncTime } from "@/db/queries";
import { pushRates, pushRateRestrictions, type AiosellConfig, type RateUpdate, type RateRestrictionUpdate, type RestrictionFields } from "@/lib/aiosell";

export async function POST(req: NextRequest) {
  try {
    const { password, username, startDate, endDate, includeRestrictions } = await req.json();
    const auth = await authenticateUser(password, username);
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await getChannelConfig();
    if (!config || !config.isActive) {
      return NextResponse.json({ error: "Channel manager not configured or inactive" }, { status: 400 });
    }

    const start = startDate || new Date().toISOString().split("T")[0];
    const end = endDate || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

    const roomMappings = await getRoomTypeMappings();
    const activeMappings = roomMappings.filter((m) => m.isActive);
    if (activeMappings.length === 0) {
      return NextResponse.json({ error: "No room type mappings configured" }, { status: 400 });
    }

    const allRatePlans = await getRatePlanMappings();
    const activeRatePlans = allRatePlans.filter((rp) => rp.isActive);
    if (activeRatePlans.length === 0) {
      return NextResponse.json({ error: "No rate plans configured" }, { status: 400 });
    }

    const dailyRatesData = await getAllDailyRates(start, end);

    const ratesByPlan = new Map<number, typeof dailyRatesData>();
    for (const dr of dailyRatesData) {
      const existing = ratesByPlan.get(dr.ratePlanId) || [];
      existing.push(dr);
      ratesByPlan.set(dr.ratePlanId, existing);
    }

    const rateUpdatesByDate = new Map<string, Array<{ roomCode: string; rateplanCode: string; rate: number }>>();
    const restrictionUpdatesByDate = new Map<string, Array<{ roomCode: string; rateplanCode: string; restrictions: RestrictionFields }>>();

    for (const rp of activeRatePlans) {
      const mapping = activeMappings.find((m) => m.id === rp.roomMappingId);
      if (!mapping) continue;

      const planRates = ratesByPlan.get(rp.id) || [];
      for (const dr of planRates) {
        const dateRates = rateUpdatesByDate.get(dr.date) || [];
        dateRates.push({
          roomCode: mapping.channelRoomCode,
          rateplanCode: rp.ratePlanCode,
          rate: dr.rate,
        });
        rateUpdatesByDate.set(dr.date, dateRates);

        if (includeRestrictions) {
          const dateRestrictions = restrictionUpdatesByDate.get(dr.date) || [];
          dateRestrictions.push({
            roomCode: mapping.channelRoomCode,
            rateplanCode: rp.ratePlanCode,
            restrictions: {
              stopSell: dr.stopSell === 1,
              minimumStay: dr.minimumStay || null,
              maximumStay: dr.maximumStay || null,
              closeOnArrival: dr.closeOnArrival === 1,
              closeOnDeparture: dr.closeOnDeparture === 1,
              minimumAdvanceReservation: dr.minimumAdvanceReservation || null,
              maximumAdvanceReservation: dr.maximumAdvanceReservation || null,
              minimumStayArrival: null,
              maximumStayArrival: null,
              exactStayArrival: null,
            },
          });
          restrictionUpdatesByDate.set(dr.date, dateRestrictions);
        }
      }
    }

    if (rateUpdatesByDate.size === 0) {
      return NextResponse.json({ error: "No rates configured for the selected date range" }, { status: 400 });
    }

    const aiosellConfig: AiosellConfig = {
      hotelCode: config.hotelCode,
      pmsId: config.pmsId,
      apiBaseUrl: config.apiBaseUrl,
      apiUsername: config.apiUsername,
      apiPassword: config.apiPassword,
    };

    const rateUpdates: RateUpdate[] = Array.from(rateUpdatesByDate.entries()).map(([date, rates]) => ({
      startDate: date,
      endDate: date,
      rates,
    }));
    const totalRates = rateUpdates.reduce((sum, u) => sum + u.rates.length, 0);
    const rateResult = await pushRates(aiosellConfig, rateUpdates);

    await addChannelSyncLog({
      direction: "push",
      type: "rate",
      status: rateResult.success ? "success" : "failed",
      requestPayload: JSON.stringify({ startDate: start, endDate: end, rateCount: totalRates }),
      responsePayload: JSON.stringify(rateResult),
      errorMessage: rateResult.success ? "" : (rateResult.message || ""),
      recordsAffected: totalRates,
    });

    let restrictionResult = null;
    let totalRestrictions = 0;
    if (includeRestrictions && restrictionUpdatesByDate.size > 0) {
      const restrictionUpdates: RateRestrictionUpdate[] = Array.from(restrictionUpdatesByDate.entries()).map(([date, rates]) => ({
        startDate: date,
        endDate: date,
        rates,
      }));
      totalRestrictions = restrictionUpdates.reduce((sum, u) => sum + u.rates.length, 0);
      restrictionResult = await pushRateRestrictions(aiosellConfig, restrictionUpdates);

      await addChannelSyncLog({
        direction: "push",
        type: "restriction",
        status: restrictionResult.success ? "success" : "failed",
        requestPayload: JSON.stringify({ startDate: start, endDate: end, count: totalRestrictions }),
        responsePayload: JSON.stringify(restrictionResult),
        errorMessage: restrictionResult.success ? "" : (restrictionResult.message || ""),
        recordsAffected: totalRestrictions,
      });
    }

    const overallSuccess = rateResult.success && (!restrictionResult || restrictionResult.success);
    if (overallSuccess) await updateChannelSyncTime();

    return NextResponse.json({
      success: overallSuccess,
      message: rateResult.message,
      warnings: rateResult.warnings,
      ratesPushed: totalRates,
      restrictionsPushed: totalRestrictions,
      restrictionResult: restrictionResult ? { success: restrictionResult.success, message: restrictionResult.message } : null,
    });
  } catch (error: any) {
    console.error("Push rates error:", error?.message);
    return NextResponse.json({ error: "Push failed: " + (error?.message || "Unknown") }, { status: 500 });
  }
}
