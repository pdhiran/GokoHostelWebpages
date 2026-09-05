import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkMappings } from "@/lib/aiosellMappingCheck";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const received = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await checkMappings("daily");
    return NextResponse.json(result, { status: result.health.report?.error ? 502 : 200 });
  } catch {
    return NextResponse.json({ error: "Mapping check could not be completed" }, { status: 500 });
  }
}
