import { NextRequest, NextResponse } from "next/server";
import { setSetting } from "@/db/queries";

const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID!;
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

export async function GET(req: NextRequest) {
  const password = req.nextUrl.searchParams.get("password");
  if (!password) {
    return NextResponse.json({ error: "Missing password" }, { status: 400 });
  }

  const adminPass = process.env.ADMIN_PASSWORD;
  if (password !== adminPass) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nonce = crypto.randomUUID();
  const expiry = Date.now() + 10 * 60 * 1000;
  await setSetting("oauth_state_nonce", JSON.stringify({ nonce, expiry }));

  const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`;
  const state = btoa(JSON.stringify({ nonce }));

  const params = new URLSearchParams({
    client_id: GOOGLE_WEB_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
