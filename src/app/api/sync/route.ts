import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  preparePullResponse,
  applyPullRecords,
  preparePushPayload,
  applyPushRecords,
  resolveConflict,
  getHeartbeatData,
  getSyncStatus,
  backfillSyncIds,
  getUnresolvedConflictsCount,
  type SyncBundle,
} from "@/lib/syncEngine";
import { getRuntimeName } from "@/lib/runtime";
import { eq, and } from "drizzle-orm";
import * as schema from "@/db/schema";

function authenticateSync(password: string, syncSecret?: string): boolean {
  const adminPw = process.env.ADMIN_PASSWORD;
  const secret = process.env.SYNC_SECRET;

  if (adminPw && password === adminPw) return true;
  if (secret && syncSecret === secret) return true;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, password, syncSecret } = body;

    if (action === "heartbeat") {
      const db = getDb();
      const data = await getHeartbeatData(db);
      return NextResponse.json(data);
    }

    if (!authenticateSync(password, syncSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();

    switch (action) {
      case "status": {
        const status = await getSyncStatus(db);
        const heartbeat = await getHeartbeatData(db);
        return NextResponse.json({ ...status, heartbeat });
      }

      case "pull": {
        const { since, tables, limit } = body;
        if (!since) {
          return NextResponse.json({ error: "Missing 'since' timestamp" }, { status: 400 });
        }
        const payloads = await preparePullResponse(db, since, tables, limit || 200);
        return NextResponse.json({ payloads });
      }

      case "push": {
        const { bundles, source: pushSource } = body as { bundles: SyncBundle[]; source: string };
        if (!bundles || !pushSource) {
          return NextResponse.json({ error: "Missing 'bundles' or 'source'" }, { status: 400 });
        }
        const validSource = pushSource === "pi" ? "pi" : "cloudflare";
        const result = await applyPushRecords(db, bundles, validSource as "cloudflare" | "pi");
        return NextResponse.json(result);
      }

      case "syncNow": {
        const { since, source } = body;
        const currentSource = source || getRuntimeName();
        const otherSource = currentSource === "pi" ? "cloudflare" : "pi";
        const sinceTs = since || "1970-01-01T00:00:00Z";

        const pullPayloads = await preparePullResponse(db, sinceTs);
        const pushPayload = await preparePushPayload(db, sinceTs, currentSource);

        return NextResponse.json({
          pullPayloads,
          pushPayload,
          source: currentSource,
        });
      }

      case "getConflicts": {
        const rows = await db
          .select()
          .from(schema.syncConflicts)
          .where(eq(schema.syncConflicts.resolved, 0))
          .orderBy(schema.syncConflicts.id);
        return NextResponse.json({ conflicts: rows });
      }

      case "resolveConflict": {
        const { conflictId, resolution, resolvedBy } = body;
        if (!conflictId || !resolution) {
          return NextResponse.json({ error: "Missing conflictId or resolution" }, { status: 400 });
        }
        await resolveConflict(db, conflictId, resolution, resolvedBy);
        return NextResponse.json({ ok: true });
      }

      case "resolveAll": {
        const { resolution, resolvedBy } = body;
        if (!resolution) {
          return NextResponse.json({ error: "Missing resolution" }, { status: 400 });
        }
        const unresolved = await db
          .select()
          .from(schema.syncConflicts)
          .where(eq(schema.syncConflicts.resolved, 0));

        for (const conflict of unresolved) {
          await resolveConflict(db, conflict.id, resolution, resolvedBy);
        }
        return NextResponse.json({ ok: true, resolved: unresolved.length });
      }

      case "getSyncLog": {
        const { limit: logLimit = 20, offset = 0 } = body;
        const rows = await db
          .select()
          .from(schema.syncLog)
          .orderBy(schema.syncLog.id)
          .limit(logLimit)
          .offset(offset);
        return NextResponse.json({ logs: rows });
      }

      case "setPrimary": {
        const { server } = body;
        if (server !== "cloudflare" && server !== "pi") {
          return NextResponse.json({ error: "Invalid server value" }, { status: 400 });
        }
        await db
          .insert(schema.settings)
          .values({ key: "primary_server", value: server })
          .onConflictDoUpdate({
            target: schema.settings.key,
            set: { value: server },
          });
        return NextResponse.json({ ok: true, primaryServer: server });
      }

      case "toggleAutoSync": {
        const { enabled } = body;
        await db
          .insert(schema.settings)
          .values({ key: "auto_sync_enabled", value: enabled ? "true" : "false" })
          .onConflictDoUpdate({
            target: schema.settings.key,
            set: { value: enabled ? "true" : "false" },
          });
        return NextResponse.json({ ok: true, autoSync: enabled });
      }

      case "backfillSyncIds": {
        const source = body.source || getRuntimeName();
        const result = await backfillSyncIds(db, source);
        return NextResponse.json({ ok: true, backfilled: result });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[sync] Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal sync error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const db = getDb();
    const data = await getHeartbeatData(db);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Heartbeat failed" },
      { status: 500 }
    );
  }
}
