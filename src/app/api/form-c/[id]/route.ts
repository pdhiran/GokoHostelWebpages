import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { checkins } from "@/db/schema";
import { eq } from "drizzle-orm";

function generateToken(id: string, secret: string, expiryHours = 1): string {
  const expiry = Date.now() + expiryHours * 60 * 60 * 1000;
  const payload = `${id}:${expiry}`;
  const hash = btoa(payload + ":" + secret).replace(/=/g, "");
  return `${btoa(payload).replace(/=/g, "")}.${hash}`;
}

function verifyToken(token: string, id: string, secret: string): boolean {
  try {
    const [payloadB64, hashB64] = token.split(".");
    if (!payloadB64 || !hashB64) return false;

    const payload = atob(payloadB64 + "==".slice(0, (4 - payloadB64.length % 4) % 4));
    const [tokenId, expiryStr] = payload.split(":");
    if (tokenId !== id) return false;

    const expiry = parseInt(expiryStr);
    if (Date.now() > expiry) return false;

    const expectedHash = btoa(payload + ":" + secret).replace(/=/g, "");
    return hashB64 === expectedHash;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("token");

  const secret = process.env.ADMIN_PASSWORD || "goko-form-c-secret";

  if (!token || !verifyToken(token, id, secret)) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const db = getDb();
  const rows = await db.select().from(checkins).where(eq(checkins.id, parseInt(id)));
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  let formCData: Record<string, any> = {};
  if (row.formCData) {
    try { formCData = JSON.parse(row.formCData); } catch {}
  }

  const response = {
    guestName: row.name,
    nationality: row.nationality,
    contact: row.contact,
    arrivalDate: row.arrivalDate,
    arrivalTime: row.arrivalTime,
    stayingDays: row.stayingDays,
    comingFrom: row.comingFrom,
    ...formCData,
  };

  const res = NextResponse.json(response);
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export { generateToken };
