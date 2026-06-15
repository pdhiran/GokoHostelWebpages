import { buildPushHTTPRequest } from "@pushforge/builder";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isOfflineMode } from "@/lib/runtime";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function sendPushToAll(payload: PushPayload) {
  if (isOfflineMode()) return;

  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPrivateKey) return;

  let privateJWK: object;
  try {
    privateJWK = JSON.parse(vapidPrivateKey);
  } catch {
    return;
  }

  const db = getDb();
  const subs = await db.select().from(pushSubscriptions);
  if (subs.length === 0) return;

  const pushPayload = {
    title: payload.title,
    body: payload.body,
    icon: "/icons/icon-192.png",
    url: payload.url || "/admin",
    tag: payload.tag || "goko-notification",
  };

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        const subscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keyP256dh, auth: sub.keyAuth },
        };

        const { endpoint, headers, body } = await buildPushHTTPRequest({
          privateJWK,
          subscription,
          message: {
            payload: pushPayload,
            adminContact: "mailto:admin@gokohostel.com",
            options: { urgency: "high" },
          },
        });

        const res = await fetch(endpoint, { method: "POST", headers, body });

        if (res.status === 410 || res.status === 404) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
        }

        if (!res.ok && res.status !== 201) {
          console.error(`Push delivery failed: ${res.status} ${res.statusText} for ${sub.endpoint.slice(0, 60)}...`);
        }
      } catch (err) {
        console.error("Push send error:", err instanceof Error ? err.message : err);
      }
    })
  );

  return results;
}
