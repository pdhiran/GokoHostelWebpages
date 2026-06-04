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
const FRRO_MENU_URL = "https://indianfrro.gov.in/frro/FormC/";

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

      await navigateToFormC(page);
      await page.waitForTimeout(2000);
      await fillFormC(page, formData);
      // await clickTemporarySave(page);
      lastResult = { success: true, applicationId: "Form filled - review and save manually" };
      console.log("Form C filled - review in browser and save manually");
      return;
    }

    // Already logged in
    await navigateToFormC(page);
    await page.waitForTimeout(2000);
    await fillFormC(page, formData);
    // await clickTemporarySave(page);

    lastResult = { success: true, applicationId: "Form filled - review and save manually" };
    res.json({ success: true, applicationId: "Form filled - review and save manually" });
  } catch (error: any) {
    console.error("Error:", error.message);
    res.json({ success: false, error: error.message });
  }
});

async function navigateToFormC(page: Page) {
  try {
    // Click "Form C (Add/Edit/Individual Print)" link on the menu page
    const formCLink = await page.$('a:has-text("Form C"), a[href*="formc"]');
    if (formCLink) {
      await formCLink.click();
      await page.waitForLoadState("domcontentloaded");
      console.log("Navigated to Form C page via menu link");
    } else {
      // Fallback: try direct navigation with current session
      const currentUrl = page.url();
      const sessionMatch = currentUrl.match(/[?&]t4g=([^&]+)/);
      if (sessionMatch) {
        await page.goto(`https://indianfrro.gov.in/frro/FormC/formc.jsp?t4g=${sessionMatch[1]}`, { waitUntil: "domcontentloaded" });
      } else {
        await page.goto("https://indianfrro.gov.in/frro/FormC/formc.jsp", { waitUntil: "domcontentloaded" });
      }
      console.log("Navigated to Form C page via direct URL");
    }
    await page.waitForTimeout(1000);
  } catch (e: any) {
    console.error("Navigation to Form C failed:", e.message);
  }
}

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
      // Strategy: find TR containing label text, get the actual form input (skip file inputs)
      const rows = await page.$$("tr");
      for (const row of rows) {
        const tds = await row.$$("td");
        // Check if any TD starts with or closely matches the label
        let labelFound = false;
        for (const td of tds) {
          const tdText = (await td.textContent().catch(() => "")) || "";
          const trimmed = tdText.trim();
          if (trimmed.toLowerCase().startsWith(label.toLowerCase()) || 
              (trimmed.length < label.length * 3 && trimmed.toLowerCase().includes(label.toLowerCase()))) {
            labelFound = true;
            break;
          }
        }
        if (!labelFound) continue;

        const input = await row.$("input:not([type=radio]):not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]), select, textarea");
        if (input) {
          const tag = await input.evaluate((el) => el.tagName);
          const type = await input.getAttribute("type");
            if (tag === "SELECT") {
              const options = await input.$$("option");
              for (const opt of options) {
                const optText = await opt.textContent() || "";
                if (optText.toUpperCase().includes(value.toUpperCase())) {
                  const optVal = await opt.getAttribute("value") || "";
                  await input.selectOption(optVal);
                  await input.dispatchEvent("change");
                  console.log(`  Filled SELECT "${label}" = "${optText.trim()}"`);
                  return;
                }
              }
              // Try by value directly
              await input.selectOption(value).catch(() => {});
              console.log(`  Filled SELECT "${label}" (by value)`);
            } else if (type === "radio") {
              // Handle radio buttons
              const radios = await row.$$("input[type=radio]");
              for (const radio of radios) {
                const radioVal = await radio.getAttribute("value") || "";
                const nextText = await radio.evaluate((el) => el.nextSibling?.textContent?.trim() || "");
                if (radioVal.toLowerCase() === value.toLowerCase() || nextText.toLowerCase().includes(value.toLowerCase())) {
                  await radio.check();
                  console.log(`  Filled RADIO "${label}" = "${value}"`);
                  return;
                }
              }
            } else {
              await input.fill(value);
              console.log(`  Filled INPUT "${label}" = "${value}"`);
            }
            return;
          }
        }
      }
      console.log(`  NOT FOUND: "${label}"`);
    } catch (e: any) {
      console.log(`  ERROR filling "${label}": ${e.message}`);
    }
  }

  // Upload passport photo (resize to <50KB JPG)
  try {
    const idLink = d.idCardLink || "";
    const driveIdMatch = idLink.split(" | ")[0]?.match(/\/d\/([^/]+)\//);
    if (driveIdMatch) {
      const { getOAuthTokenWithDb } = await import("../src/lib/googleApiFetch");
      const sharp = (await import("sharp")).default;
      const token = await getOAuthTokenWithDb();
      if (token) {
        const imgRes = await fetch(`https://www.googleapis.com/drive/v3/files/${driveIdMatch[1]}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (imgRes.ok) {
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          const resized = await sharp(buffer)
            .resize(300, 400, { fit: "cover" })
            .jpeg({ quality: 60 })
            .toBuffer();
          // Ensure under 50KB
          let finalPhoto = resized;
          if (resized.length > 50000) {
            finalPhoto = await sharp(buffer)
              .resize(200, 267, { fit: "cover" })
              .jpeg({ quality: 40 })
              .toBuffer();
          }
          const photoPath = "/tmp/frro_passport_photo.jpg";
          const fs = await import("fs");
          fs.writeFileSync(photoPath, finalPhoto);
          const fileInput = await page.$('input[type="file"]');
          if (fileInput) {
            await fileInput.setInputFiles(photoPath);
            // Click Upload File button if present
            const uploadBtn = await page.$('input[value*="Upload"], button:has-text("Upload File")');
            if (uploadBtn) {
              await uploadBtn.click();
              await page.waitForTimeout(2000);
            }
            console.log(`  Uploaded passport photo (${(finalPhoto.length / 1024).toFixed(1)}KB)`);
          }
        }
      }
    }
  } catch (e: any) {
    console.log(`  Photo upload skipped: ${e.message}`);
  }

  console.log("\nFilling Form C fields...\n");

  // Personal details
  await fillByLabel("Surname", surname);
  await fillByLabel("Given Name", givenName);
  await fillByLabel("Sex", passport.sex === "Male" ? "Male" : passport.sex === "Female" ? "Female" : "");
  await fillByLabel("Nationality", d.nationality || "");
  await fillByLabel("Special Category", "Others");

  // Home address
  await fillByLabel("Address in country where residing permanently", d.homeAddress || "");
  await fillByLabel("City", d.homeCity || "");

  // Passport
  await fillByLabel("Passport No", passport.passportNumber || "");

  // Visa
  await fillByLabel("Visa No", visa.visaNumber || "");
  await fillByLabel("Type of visa", visa.type || "Tourist");

  // Arrival info
  await fillByLabel("Arrived from Country", d.arrivedFromCountry || "");
  await fillByLabel("Arrived from City", d.arrivedFromCity || "");
  await fillByLabel("Arrived from Place", d.arrivedFromPlace || "");
  await fillByLabel("Date of Arrival in India", d.dateOfArrivalInIndia || "");
  await fillByLabel("Date of Arrival in Hotel", d.arrivalDate || "");
  await fillByLabel("Time of Arrival in Hotel", d.arrivalTime || "");
  await fillByLabel("Intended duration of stay", d.stayingDays || "");

  // Other
  await fillByLabel("Whether employed in India", d.employedInIndia || "No");
  await fillByLabel("Purpose of Visit", d.purposeOfVisit || "Tourism");
  await fillByLabel("Contact Phone No (In India", d.contact || "");
  await fillByLabel("Mobile No (In India", d.contact || "");
  await fillByLabel("Mobile No (Permanently", d.homeCountryPhone || "");
  await fillByLabel("Contact Phone No (Permanently", d.homeCountryPhone || "");

  // Try direct input filling as fallback (by input name attributes)
  console.log("\nTrying direct name-based filling as fallback...\n");
  await directFill(page, d, passport, visa);

  console.log("\nForm C filling complete!");
}

async function directFill(page: Page, d: any, passport: any, visa: any) {
  const surname = passport.surname || d.guestName?.split(" ").pop() || "";
  const givenName = passport.givenName || d.guestName?.split(" ").slice(0, -1).join(" ") || "";

  // Try common JSP form field names
  const fields: [string, string][] = [
    ["surname", surname],
    ["givenname", givenName],
    ["given_name", givenName],
    ["passno", passport.passportNumber || ""],
    ["passport_no", passport.passportNumber || ""],
    ["visano", visa.visaNumber || ""],
    ["visa_no", visa.visaNumber || ""],
    ["paddress", d.homeAddress || ""],
    ["pcity", d.homeCity || ""],
    ["arrcity", d.arrivedFromCity || ""],
    ["arrplace", d.arrivedFromPlace || ""],
    ["staydays", d.stayingDays || ""],
    ["stay_days", d.stayingDays || ""],
    ["hotarrtime", d.arrivalTime || ""],
    ["arr_time", d.arrivalTime || ""],
    ["mobile_india", d.contact || ""],
    ["phone_india", d.contact || ""],
    ["mobile_perm", d.homeCountryPhone || ""],
    ["phone_perm", d.homeCountryPhone || ""],
  ];

  for (const [name, value] of fields) {
    if (!value) continue;
    const el = await page.$(`input[name="${name}"], textarea[name="${name}"]`);
    if (el) {
      await el.fill(value);
      console.log(`  Direct fill [name="${name}"] = "${value}"`);
    }
  }

  // Try select dropdowns
  const selects: [string, string][] = [
    ["sex", passport.sex === "Male" ? "M" : passport.sex === "Female" ? "F" : ""],
    ["nationality", d.nationality || ""],
    ["arrcountry", d.arrivedFromCountry || ""],
    ["arr_country", d.arrivedFromCountry || ""],
    ["purpose", d.purposeOfVisit || "Tourism"],
    ["visatype", visa.type || "Tourist"],
    ["visa_type", visa.type || "Tourist"],
    ["specialcat", "Others"],
    ["special_category", "Others"],
  ];

  for (const [name, value] of selects) {
    if (!value) continue;
    const el = await page.$(`select[name="${name}"]`);
    if (el) {
      const options = await el.$$("option");
      for (const opt of options) {
        const text = await opt.textContent() || "";
        if (text.toUpperCase().includes(value.toUpperCase())) {
          const val = await opt.getAttribute("value") || "";
          await el.selectOption(val);
          console.log(`  Direct select [name="${name}"] = "${text.trim()}"`);
          break;
        }
      }
    }
  }
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
