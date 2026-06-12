import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendPushToAll } from "@/lib/pushNotify";
import { isOfflineMode } from "@/lib/runtime";

async function authenticate(password: string): Promise<boolean> {
  if (!password) return false;
  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) return true;
  if (process.env.MANAGER_PASSWORD && password === process.env.MANAGER_PASSWORD) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (isOfflineMode()) {
    return NextResponse.json({ error: "Push notifications require internet" }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { action, password, ...rest } = body;

    switch (action) {
      case "subscribe": {
        if (!password || !await authenticate(password)) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { subscription, userLabel } = rest;
        if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
          return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
        }

        const db = getDb();
        const existing = await db.select({ id: pushSubscriptions.id })
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
          .limit(1);

        if (existing.length > 0) {
          await db.update(pushSubscriptions).set({
            keyP256dh: subscription.keys.p256dh,
            keyAuth: subscription.keys.auth,
            userLabel: userLabel || "",
          }).where(eq(pushSubscriptions.endpoint, subscription.endpoint));
        } else {
          await db.insert(pushSubscriptions).values({
            endpoint: subscription.endpoint,
            keyP256dh: subscription.keys.p256dh,
            keyAuth: subscription.keys.auth,
            userLabel: userLabel || "",
            createdAt: new Date().toISOString(),
          });
        }

        return NextResponse.json({ success: true });
      }

      case "unsubscribe": {
        const { endpoint } = rest;
        if (!endpoint) {
          return NextResponse.json({ error: "endpoint required" }, { status: 400 });
        }

        const db = getDb();
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
        return NextResponse.json({ success: true });
      }

      case "resubscribe": {
        const { oldEndpoint, subscription } = rest;
        if (!subscription?.endpoint) {
          return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
        }

        const db = getDb();
        if (oldEndpoint) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, oldEndpoint));
        }

        await db.insert(pushSubscriptions).values({
          endpoint: subscription.endpoint,
          keyP256dh: subscription.keys?.p256dh || "",
          keyAuth: subscription.keys?.auth || "",
          userLabel: "",
          createdAt: new Date().toISOString(),
        }).onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: {
            keyP256dh: subscription.keys?.p256dh || "",
            keyAuth: subscription.keys?.auth || "",
          },
        });

        return NextResponse.json({ success: true });
      }

      case "test": {
        if (!password || !await authenticate(password)) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await sendPushToAll({
          title: "Test Notification",
          body: "Push notifications are working!",
          tag: "test",
        });

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
