import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { qrHistory } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

async function authenticate(password: string): Promise<boolean> {
  if (!password) return false;
  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) return true;
  if (process.env.MANAGER_PASSWORD && password === process.env.MANAGER_PASSWORD) return true;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, action } = body;

    if (!await authenticate(password)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();

    switch (action) {
      case "list": {
        const items = await db.select().from(qrHistory).orderBy(desc(qrHistory.createdAt)).limit(50);
        return NextResponse.json({ items });
      }

      case "save": {
        const { name, config, previewDataUrl } = body;
        if (!name || !config) {
          return NextResponse.json({ error: "Name and config required" }, { status: 400 });
        }
        const result = await db.insert(qrHistory).values({
          name,
          config,
          previewDataUrl: previewDataUrl || "",
          createdBy: body.username || "",
          createdAt: new Date().toISOString(),
        }).returning({ id: qrHistory.id });
        return NextResponse.json({ success: true, id: result[0]?.id });
      }

      case "delete": {
        const { id } = body;
        if (!id) {
          return NextResponse.json({ error: "ID required" }, { status: 400 });
        }
        await db.delete(qrHistory).where(eq(qrHistory.id, id));
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
