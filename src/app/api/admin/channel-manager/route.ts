import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import {
  getChannelConfig, upsertChannelConfig,
  getRoomTypeMappings, upsertRoomTypeMapping, deleteRoomTypeMapping,
  getRatePlanMappings, upsertRatePlanMapping, deleteRatePlanMapping,
  getDailyRates, bulkUpsertDailyRates, getChannelSyncLogs,
} from "@/db/queries";

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
        if (cfg) {
          return NextResponse.json({ config: { ...cfg, apiPassword: cfg.apiPassword ? "••••••••" : "" } });
        }
        return NextResponse.json({ config: null });
      }

      case "saveConfig": {
        const configData = { ...body.config };
        if (configData.apiPassword === "••••••••") {
          const existing = await getChannelConfig();
          configData.apiPassword = existing?.apiPassword || "";
        }
        if (configData.isActive && !configData.webhookSecret) {
          return NextResponse.json({ error: "Webhook secret is required to enable the channel manager" }, { status: 400 });
        }
        await upsertChannelConfig(configData);
        return NextResponse.json({ success: true });
      }

      case "getRoomMappings":
        return NextResponse.json({ mappings: await getRoomTypeMappings() });

      case "saveRoomMapping":
        await upsertRoomTypeMapping(body.mapping);
        return NextResponse.json({ success: true });

      case "deleteRoomMapping":
        await deleteRoomTypeMapping(body.id);
        return NextResponse.json({ success: true });

      case "getRatePlans": {
        const plans = await getRatePlanMappings(body.roomMappingId);
        return NextResponse.json({ plans });
      }

      case "saveRatePlan":
        await upsertRatePlanMapping(body.plan);
        return NextResponse.json({ success: true });

      case "deleteRatePlan":
        await deleteRatePlanMapping(body.id);
        return NextResponse.json({ success: true });

      case "getDailyRates": {
        const rates = await getDailyRates(body.ratePlanId, body.startDate, body.endDate);
        return NextResponse.json({ rates });
      }

      case "saveDailyRates": {
        const count = await bulkUpsertDailyRates(body.rates);
        return NextResponse.json({ success: true, count });
      }

      case "getSyncLogs": {
        const logs = await getChannelSyncLogs(body.limit || 50, {
          direction: body.direction || undefined,
          type: body.type || undefined,
          status: body.status || undefined,
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
