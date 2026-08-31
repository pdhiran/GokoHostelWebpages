import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import {
  getChannelConfig, upsertChannelConfig,
  getRoomTypeMappings, upsertRoomTypeMapping, deleteRoomTypeMapping,
  getRatePlanMappings, upsertRatePlanMapping, deleteRatePlanMapping,
  getDailyRates, bulkUpsertDailyRates, getChannelSyncLogs,
  getAllDorms, getAllBeds, getSetting, setSetting,
} from "@/db/queries";
import { BOOKING_TAX_SETTING, bookingTaxPercent } from "@/lib/bookingPricing";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, username, action } = body;

    const auth = await authenticateUser(password, username);
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    switch (action) {
      case "getConfig": {
        const cfg = await getChannelConfig();
        const bookingTaxRate = bookingTaxPercent(await getSetting(BOOKING_TAX_SETTING));
        return NextResponse.json({ config: cfg ?? null, bookingTaxRate });
      }

      case "saveConfig": {
        const configData = { ...body.config };
        if (configData.isActive && !configData.webhookSecret) {
          return NextResponse.json({ error: "Webhook secret is required to enable the channel manager" }, { status: 400 });
        }
        await upsertChannelConfig(configData);
        if (body.bookingTaxRate != null && body.bookingTaxRate !== "") {
          await setSetting(BOOKING_TAX_SETTING, String(bookingTaxPercent(body.bookingTaxRate)));
        }
        return NextResponse.json({ success: true });
      }

      case "getRoomMappings": {
        const mappings = await getRoomTypeMappings();
        const allDorms = await getAllDorms();
        const allBeds = await getAllBeds();
        const nameById = new Map(allDorms.map((d) => [d.id, d.name]));
        const dormsWithCounts = [...allDorms]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((d) => ({
            id: d.id,
            name: d.name,
            bedCount: allBeds.filter((b) => b.dormId === d.id).length,
          }));
        return NextResponse.json({
          mappings: mappings.map((m) => ({ ...m, dormName: nameById.get(m.dormId) ?? m.dormName })),
          dorms: dormsWithCounts,
        });
      }

      case "saveRoomMapping": {
        const mapping = body.mapping;
        const code = String(mapping?.channelRoomCode || "").trim();
        const dormId = Number(mapping?.dormId);
        if (!Number.isInteger(dormId) || dormId < 1 || !code) {
          return NextResponse.json({ error: "Dorm and Aiosell room code are required" }, { status: 400 });
        }
        const mappingId = Number(mapping?.id);
        await upsertRoomTypeMapping({
          id: Number.isInteger(mappingId) && mappingId > 0 ? mappingId : undefined,
          dormId,
          channelRoomCode: code,
          totalInventory: mapping?.totalInventory,
          isActive: mapping?.isActive,
        });
        return NextResponse.json({ success: true });
      }

      case "deleteRoomMapping": {
        const id = Number(body.id);
        if (!Number.isInteger(id) || id < 1) {
          return NextResponse.json({ error: "Mapping id is required" }, { status: 400 });
        }
        await deleteRoomTypeMapping(id);
        return NextResponse.json({ success: true });
      }

      case "getRatePlans": {
        const plans = await getRatePlanMappings(body.roomMappingId);
        return NextResponse.json({ plans });
      }

      case "saveRatePlan": {
        const plan = body.plan;
        const ratePlanCode = String(plan?.ratePlanCode || "").trim();
        const ratePlanName = String(plan?.ratePlanName || "").trim();
        const roomMappingId = Number(plan?.roomMappingId);
        if (!Number.isInteger(roomMappingId) || roomMappingId < 1 || !ratePlanCode || !ratePlanName) {
          return NextResponse.json({ error: "Room, rate plan code, and name are required" }, { status: 400 });
        }
        const planId = Number(plan?.id);
        await upsertRatePlanMapping({
          id: Number.isInteger(planId) && planId > 0 ? planId : undefined,
          roomMappingId,
          ratePlanCode,
          ratePlanName,
          isActive: plan?.isActive,
        });
        return NextResponse.json({ success: true });
      }

      case "deleteRatePlan": {
        const id = Number(body.id);
        if (!Number.isInteger(id) || id < 1) {
          return NextResponse.json({ error: "Rate plan id is required" }, { status: 400 });
        }
        await deleteRatePlanMapping(id);
        return NextResponse.json({ success: true });
      }

      case "getDailyRates": {
        const rates = await getDailyRates(body.ratePlanId, body.startDate, body.endDate);
        return NextResponse.json({ rates });
      }

      case "saveDailyRates": {
        const count = await bulkUpsertDailyRates(body.rates);
        return NextResponse.json({ success: true, count });
      }

      case "getSyncLogs": {
        const logs = await getChannelSyncLogs(body.limit, {
          direction: body.direction || undefined,
          type: body.type || undefined,
          status: body.status || undefined,
          since: body.since || undefined,
        });
        return NextResponse.json({ logs });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Channel manager admin error:", error?.message);
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}
