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

function extractDriveId(url: string): string | null {
  const match = url.match(/\/d\/([^/]+)\//);
  return match ? match[1] : null;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    chunks.push(String.fromCharCode(...bytes.slice(i, i + 8192)));
  }
  return btoa(chunks.join(""));
}

async function downloadDriveFileAsBase64(fileId: string): Promise<string | null> {
  try {
    const { getOAuthTokenWithDb } = await import("@/lib/googleApiFetch");
    const token = await getOAuthTokenWithDb();
    if (!token) return null;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return arrayBufferToBase64(buffer);
  } catch {
    return null;
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

  // Download ID photo as base64 for FRRO upload (works with any ID type that has an image)
  let passportPhotoBase64: string | null = null;
  if (row.idCardLink) {
    const links = row.idCardLink.split(" | ").filter((l) => l.startsWith("http"));
    if (links.length > 0) {
      const fileId = extractDriveId(links[0]);
      if (fileId) {
        passportPhotoBase64 = await downloadDriveFileAsBase64(fileId);
      }
    }
  }

  const response = {
    guestName: row.name,
    nationality: row.nationality,
    contact: row.contact,
    arrivalDate: row.arrivalDate,
    arrivalTime: row.arrivalTime,
    stayingDays: row.stayingDays,
    comingFrom: row.comingFrom,
    idCardLink: row.idCardLink || "",
    visaLink: row.visaLink || "",
    idType: row.idType || "",
    ...(passportPhotoBase64 && { passportPhotoBase64 }),
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

