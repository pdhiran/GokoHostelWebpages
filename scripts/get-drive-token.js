/**
 * One-time script to get a Google OAuth2 refresh token for Drive + Gmail access.
 *
 * Prerequisites:
 *   1. Create OAuth 2.0 "Desktop app" credentials in Google Cloud Console
 *   2. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env.local
 *   3. Enable Gmail API + Drive API in Google Cloud Console
 *
 * Usage:
 *   node scripts/get-drive-token.js
 *
 * It will print a URL -- open it in your browser, sign in with thegokosocial@gmail.com,
 * grant permission for Drive + Gmail, then paste the code back here.
 * The script will output a refresh token to add to .env.local.
 */

const { google } = require("googleapis");
const readline = require("readline");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
let envContent = "";
try {
  envContent = fs.readFileSync(envPath, "utf-8");
} catch {}

function getEnvVar(name) {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, "m"));
  return match ? match[1].trim() : process.env[name];
}

const CLIENT_ID = getEnvVar("GOOGLE_OAUTH_CLIENT_ID");
const CLIENT_SECRET = getEnvVar("GOOGLE_OAUTH_CLIENT_SECRET");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("\nERROR: Add these to .env.local first:");
  console.error("  GOOGLE_OAUTH_CLIENT_ID=your_client_id");
  console.error("  GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret\n");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  "http://localhost:3333"
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/gmail.readonly",
  ],
  prompt: "consent",
});

console.log("\n=== Google OAuth Setup (Drive + Gmail) ===\n");
console.log("1. Opening browser for authorization...\n");
console.log("If the browser doesn't open, visit this URL:\n");
console.log(authUrl);
console.log("\n2. Sign in with: thegokosocial@gmail.com");
console.log("3. Grant permission for Drive AND Gmail access");
console.log("4. You'll be redirected back automatically.\n");

// Start a local server to catch the OAuth redirect
const http = require("http");
const url = require("url");

const server = http.createServer(async (req, res) => {
  const query = url.parse(req.url, true).query;
  if (query.code) {
    try {
      const { tokens } = await oauth2Client.getToken(query.code);
      console.log("\n✓ Success! Add this to your .env.local:\n");
      console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`);
      console.log("Then update the same in Cloudflare env vars.\n");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h2>Success! Token generated.</h2><p>You can close this tab and go back to the terminal.</p>");
    } catch (err) {
      console.error("\nERROR:", err.message);
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`<h2>Error</h2><p>${err.message}</p>`);
    }
    setTimeout(() => { server.close(); process.exit(0); }, 1000);
  } else if (query.error) {
    console.error("\nOAuth error:", query.error);
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(`<h2>Error</h2><p>${query.error}</p>`);
    setTimeout(() => { server.close(); process.exit(1); }, 1000);
  }
});

server.listen(3333, () => {
  console.log("Waiting for OAuth redirect on http://localhost:3333 ...\n");
  // Try to open browser
  const { exec } = require("child_process");
  exec(`open "${authUrl}"`, () => {});
});
