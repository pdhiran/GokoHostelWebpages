/**
 * FRRO Form C Automation Server
 * 
 * Runs locally on the admin's machine. Opens a real browser window,
 * pre-fills FRRO login credentials, waits for admin to solve CAPTCHA,
 * then fills Form C and clicks "Temporary Save and Exit".
 * 
 * Setup:
 *   cd scripts && npm install playwright express cors
 * 
 * Run:
 *   npx tsx scripts/frro-server.ts
 */

import express from "express";
import cors from "cors";
import { chromium, type Browser, type Page } from "playwright";

const app = express();
app.use(cors());
app.use(express.json());

let browser: Browser | null = null;
let page: Page | null = null;
let loggedIn = false;
let lastResult: { success: boolean; applicationId?: string; error?: string } | null = null;

const FRRO_LOGIN_URL = "https://indianfrro.gov.in/frro/FormC/login.jsp";
const FRRO_FORM_URL = "https://indianfrro.gov.in/frro/FormC/formc.jsp";

app.get("/status", (_req, res) => {
  res.json({ running: true, loggedIn, hasBrowser: !!browser, lastResult });
});

app.post("/fill-form-c", async (req, res) => {
  const { apiUrl, frroUsername, frroPassword } = req.body;

  if (!apiUrl) {
    return res.json({ success: false, error: "Missing apiUrl" });
  }

  try {
    // Fetch Form C data from our API
    const dataRes = await fetch(apiUrl);
    if (!dataRes.ok) {
      return res.json({ success: false, error: `API returned ${dataRes.status}` });
    }
    const formData = await dataRes.json();

    // Launch browser if not open
    if (!browser) {
      browser = await chromium.launch({ headless: false });
      const context = await browser.newContext();
      page = await context.newPage();
    }

    if (!page || page.isClosed()) {
      const context = await browser.newContext();
      page = await context.newPage();
      loggedIn = false;
    }

    lastResult = null;

    // Login if needed
    if (!loggedIn) {
      await page.goto(FRRO_LOGIN_URL, { waitUntil: "domcontentloaded" });

      if (frroUsername) {
        const userInput = await page.$('input[name="userid"], input[name="userName"], input[type="text"]');
        if (userInput) await userInput.fill(frroUsername);
      }
      if (frroPassword) {
        const passInput = await page.$('input[name="password"], input[name="passwd"], input[type="password"]');
        if (passInput) await passInput.fill(frroPassword);
      }

      console.log("Waiting for admin to solve CAPTCHA and login...");
      res.json({ success: false, waitingForCaptcha: true, message: "Solve CAPTCHA in the browser window and click Sign In. Check /status for result." });

      try {
        await page.waitForURL((url) => !url.href.includes("login"), { timeout: 120000 });
        loggedIn = true;
        console.log("Login successful!");
      } catch {
        console.log("Login timeout or failed");
        lastResult = { success: false, error: "Login timed out" };
        return;
      }

      await page.goto(FRRO_FORM_URL, { waitUntil: "domcontentloaded" });
      await fillFormC(page, formData);
      await clickTemporarySave(page);
      lastResult = { success: true, applicationId: "Submitted - check FRRO site" };
      console.log("Form C submitted successfully!");
      return;
    }

    // Already logged in
    await page.goto(FRRO_FORM_URL, { waitUntil: "domcontentloaded" });
    await fillFormC(page, formData);
    await clickTemporarySave(page);

    lastResult = { success: true, applicationId: "Submitted - check FRRO site" };
    res.json({ success: true, applicationId: "Submitted - check FRRO site" });
  } catch (error: any) {
    console.error("Error:", error.message);
    res.json({ success: false, error: error.message });
  }
});

async function clickTemporarySave(page: Page) {
  try {
    const saveBtn = await page.$('input[value*="Temporary"], button:has-text("Temporary Save")');
    if (saveBtn) {
      await saveBtn.click();
      await page.waitForTimeout(3000);
      console.log("Clicked Temporary Save and Exit");
    } else {
      console.log("Could not find Temporary Save button");
    }
  } catch (e: any) {
    console.error("Save click failed:", e.message);
  }
}

async function fillFormC(page: Page, d: any) {
  const passport = d.extractedPassport || {};
  const visa = d.extractedVisa || {};

  const surname = passport.surname || d.guestName?.split(" ").pop() || "";
  const givenName = passport.givenName || d.guestName?.split(" ").slice(0, -1).join(" ") || "";

  // Helper: fill by label proximity (searches TDs for label text, fills adjacent input)
  async function fillByLabel(label: string, value: string) {
    if (!value) return;
    try {
      const td = await page.$(`td:has-text("${label}"), th:has-text("${label}")`);
      if (td) {
        const row = await td.$("xpath=ancestor::tr");
        if (row) {
          const input = await row.$("input:not([type=radio]):not([type=hidden]), select, textarea");
          if (input) {
            const tag = await input.evaluate((el) => el.tagName);
            if (tag === "SELECT") {
              await input.selectOption({ label: value }).catch(() => 
                input.selectOption({ value }).catch(() => {})
              );
            } else {
              await input.fill(value);
            }
          } else {
            const radios = await row.$$("input[type=radio]");
            for (const radio of radios) {
              const radioVal = await radio.getAttribute("value");
              const radioLabel = await radio.evaluate((el) => el.nextSibling?.textContent?.trim() || "");
              if (radioVal?.toLowerCase() === value.toLowerCase() || radioLabel.toLowerCase() === value.toLowerCase()) {
                await radio.check();
                break;
              }
            }
          }
        }
      }
    } catch {}
  }

  // Fill personal details
  await fillByLabel("Surname", surname);
  await fillByLabel("Given Name", givenName);
  await fillByLabel("Sex", passport.sex === "Male" ? "Male" : passport.sex === "Female" ? "Female" : "");
  await fillByLabel("Date of Birth", passport.dateOfBirth || "");
  await fillByLabel("Nationality", d.nationality || "");

  // Home address
  await fillByLabel("Address in country", d.homeAddress || "");

  // Passport
  await fillByLabel("Passport No", passport.passportNumber || "");
  await fillByLabel("Date of issue", passport.dateOfIssue || "");
  await fillByLabel("Valid till", passport.expiryDate || "");

  // Visa
  await fillByLabel("Visa No", visa.visaNumber || "");
  await fillByLabel("Type of visa", visa.type || "");

  // Arrival info
  await fillByLabel("Arrived from Country", d.arrivedFromCountry || "");
  await fillByLabel("Arrived from City", d.arrivedFromCity || "");
  await fillByLabel("Arrived from Place", d.arrivedFromPlace || "");
  await fillByLabel("Date of Arrival in India", d.dateOfArrivalInIndia || "");
  await fillByLabel("Date of Arrival in Hotel", d.arrivalDate || "");
  await fillByLabel("Time of Arrival in Hotel", d.arrivalTime || "");
  await fillByLabel("duration of stay", d.stayingDays || "");

  // Other
  await fillByLabel("Purpose of Visit", d.purposeOfVisit || "Tourism");
  await fillByLabel("Contact Phone No (In India", d.contact || "");
  await fillByLabel("Mobile No (In India", d.contact || "");
  await fillByLabel("Mobile No (Permanently", d.homeCountryPhone || "");

  console.log("Form C fields filled!");
}

app.post("/close", async (_req, res) => {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
    loggedIn = false;
  }
  res.json({ success: true });
});

const PORT = 3456;
app.listen(PORT, "0.0.0.0", () => {
  const nets = require("os").networkInterfaces();
  const lanIp = Object.values(nets).flat().find((n: any) => n?.family === "IPv4" && !n?.internal)?.address || "localhost";
  console.log(`\nFRRO Form C Server running on:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${lanIp}:${PORT}`);
  console.log(`\nWaiting for requests from admin panel...\n`);
});
