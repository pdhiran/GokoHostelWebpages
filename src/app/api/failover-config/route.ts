import { NextResponse } from "next/server";
import { getSetting } from "@/db/queries";
import { getRuntimeName } from "@/lib/runtime";

/**
 * Public (no auth) endpoint for the service worker to discover failover config.
 * Returns whether failover is enabled and the Pi's local URL for client-side failover.
 * Cached for 30 seconds to avoid hammering the DB.
 */
export async function GET() {
  try {
    const failoverEnabled = (await getSetting("failover_enabled")) === "true";
    const piLocalUrl = (await getSetting("pi_local_url")) || null;
    const runtime = getRuntimeName();

    return NextResponse.json(
      { failoverEnabled, piLocalUrl, runtime },
      { headers: { "Cache-Control": "public, max-age=30" } },
    );
  } catch {
    return NextResponse.json(
      { failoverEnabled: false, piLocalUrl: null, runtime: "cloudflare" },
      { headers: { "Cache-Control": "public, max-age=30" } },
    );
  }
}
