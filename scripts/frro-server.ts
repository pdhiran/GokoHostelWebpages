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
import fs from "fs";
import os from "os";
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
      await clickTemporarySave(page);
      const appId2 = await captureApplicationId(page);
      lastResult = { success: true, applicationId: appId2 };
      console.log(`Form C submitted! Application ID: ${appId2}`);
      return;
    }

    // Already logged in
    await navigateToFormC(page);
    await page.waitForTimeout(2000);
    await fillFormC(page, formData);
    await clickTemporarySave(page);
    const appId = await captureApplicationId(page);

    lastResult = { success: true, applicationId: appId };
    res.json({ success: true, applicationId: appId });
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

async function captureApplicationId(page: Page): Promise<string> {
  try {
    await page.waitForTimeout(2000);
    const pageText = await page.textContent("body") || "";
    
    // Look for Application ID pattern in the page
    const idMatch = pageText.match(/Application\s*ID\s*[:\s]*([A-Z0-9\-]+)/i);
    if (idMatch) {
      console.log(`  Captured Application ID: ${idMatch[1]}`);
      return idMatch[1];
    }

    // Try finding it in an input field
    const idInput = await page.$('input[name*="appli"], input[name*="Filer"], input[id*="appli"]');
    if (idInput) {
      const val = await idInput.inputValue();
      if (val) {
        console.log(`  Captured Application ID from input: ${val}`);
        return val;
      }
    }

    // Check the Filerfno field (seen in form fields earlier)
    const filerfno = await page.$('input[name="Filerfno"]');
    if (filerfno) {
      const val = await filerfno.inputValue();
      if (val) {
        console.log(`  Captured Application ID (Filerfno): ${val}`);
        return val;
      }
    }

    // Check URL for any ID parameter
    const url = page.url();
    const urlIdMatch = url.match(/[?&](?:id|appId|applicationId)=([^&]+)/i);
    if (urlIdMatch) {
      console.log(`  Captured Application ID from URL: ${urlIdMatch[1]}`);
      return urlIdMatch[1];
    }

    console.log("  Could not capture Application ID from page");
    return "Saved - check FRRO site for ID";
  } catch (e: any) {
    console.log(`  Error capturing Application ID: ${e.message}`);
    return "Saved - check FRRO site for ID";
  }
}

async function fillFormC(page: Page, d: any) {
  const passport = d.extractedPassport || {};
  const visa = d.extractedVisa || {};

  const surname = passport.surname || d.guestName?.split(" ").pop() || "";
  const givenName = passport.givenName || d.guestName?.split(" ").slice(0, -1).join(" ") || "";


  // Upload passport photo (resize to <50KB JPG)
  try {
    const idLink = d.idCardLink || "";
    const driveLink = idLink.split(" | ")[0];
    if (driveLink && driveLink.startsWith("http")) {
      const sharp = (await import("sharp")).default;
      const fs = await import("fs");
      // Try direct download (public link)
      const imgRes = await fetch(driveLink.replace("/view", "/uc?export=download&confirm=t"));
      if (imgRes.ok) {
        const contentType = imgRes.headers.get("content-type") || "";
        if (contentType.includes("image") || contentType.includes("octet")) {
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          let finalPhoto = await sharp(buffer)
            .resize(300, 400, { fit: "cover" })
            .jpeg({ quality: 60 })
            .toBuffer();
          if (finalPhoto.length > 50000) {
            finalPhoto = await sharp(buffer)
              .resize(200, 267, { fit: "cover" })
              .jpeg({ quality: 40 })
              .toBuffer();
          }
          const photoPath = "/tmp/frro_passport_photo.jpg";
          fs.writeFileSync(photoPath, finalPhoto);
          const fileInput = await page.$('input[type="file"]');
          if (fileInput) {
            await fileInput.setInputFiles(photoPath);
            const uploadBtn = await page.$('input[value*="Upload"], button:has-text("Upload")');
            if (uploadBtn) {
              await uploadBtn.click();
              await page.waitForTimeout(2000);
            }
            console.log(`  Uploaded passport photo (${(finalPhoto.length / 1024).toFixed(1)}KB)`);
          }
        } else {
          console.log("  Photo download returned non-image content (likely login page)");
        }
      }
    }
  } catch (e: any) {
    console.log(`  Photo upload skipped: ${e.message}`);
  }


  console.log("\nFilling Form C fields by exact FRRO field names...\n");

  // Helper: fill text input by name (uses evaluate for stubborn fields)
  async function fillInput(name: string, value: string) {
    if (!value) return;
    const el = await page.$(`input[name="${name}"], textarea[name="${name}"]`);
    if (el) {
      try {
        await el.fill(value);
      } catch {
        // Fallback: force set via JavaScript (for readonly/date-picker fields)
        await page.evaluate(({ n, v }) => {
          const input = document.querySelector(`input[name="${n}"], textarea[name="${n}"]`) as HTMLInputElement;
          if (input) {
            input.removeAttribute("readonly");
            input.value = v;
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }, { n: name, v: value });
      }
      console.log(`  ✓ ${name} = "${value}"`);
    } else {
      console.log(`  ✗ ${name} not found`);
    }
  }

  // Helper: select dropdown option by text match (prefers exact match)
  async function fillSelect(name: string, value: string) {
    if (!value) return;
    // ^VALUE$ syntax forces exact-only matching
    const forceExact = value.startsWith("^") && value.endsWith("$");
    const searchValue = forceExact ? value.slice(1, -1) : value;

    const el = await page.$(`select[name="${name}"]`);
    if (el) {
      const options = await el.$$("option");
      // First try exact match
      for (const opt of options) {
        const text = (await opt.textContent() || "").trim();
        if (text.toUpperCase() === searchValue.toUpperCase()) {
          const val = await opt.getAttribute("value") || "";
          await el.selectOption(val);
          await el.dispatchEvent("change");
          console.log(`  ✓ ${name} = "${text}" (exact)`);
          return;
        }
      }
      if (forceExact) { console.log(`  ⚠ ${name}: no exact option matching "${searchValue}"`); return; }
      // Then try starts-with match
      for (const opt of options) {
        const text = (await opt.textContent() || "").trim();
        if (text.toUpperCase().startsWith(searchValue.toUpperCase())) {
          const val = await opt.getAttribute("value") || "";
          await el.selectOption(val);
          await el.dispatchEvent("change");
          console.log(`  ✓ ${name} = "${text}" (starts-with)`);
          return;
        }
      }
      // Finally try contains (but skip if value is too short/common)
      if (searchValue.length > 3) {
        for (const opt of options) {
          const text = (await opt.textContent() || "").trim();
          if (text.toUpperCase().includes(searchValue.toUpperCase())) {
            const val = await opt.getAttribute("value") || "";
            await el.selectOption(val);
            await el.dispatchEvent("change");
            console.log(`  ✓ ${name} = "${text}" (contains)`);
            return;
          }
        }
      }
      console.log(`  ⚠ ${name}: no option matching "${searchValue}"`);
    } else {
      console.log(`  ✗ ${name} not found`);
    }
  }

  // Helper: convert date from YYYY-MM-DD to DD/MM/YYYY
  function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    // Already in DD/MM/YYYY or DD.MM.YYYY format
    if (/^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}$/.test(dateStr)) return dateStr.replace(/[.-]/g, "/");
    // Convert from YYYY-MM-DD
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return dateStr;
  }

  // Helper: check radio by name + value
  async function fillRadio(name: string, value: string) {
    if (!value) return;
    const radio = await page.$(`input[name="${name}"][value="${value}"]`);
    if (radio) {
      await radio.check();
      console.log(`  ✓ ${name} = "${value}"`);
    } else {
      console.log(`  ✗ ${name}[value="${value}"] not found`);
    }
  }

  // Personal Details
  await fillInput("applicant_surname", surname);
  await fillInput("applicant_givenname", givenName);
  await fillSelect("applicant_sex", passport.sex === "Male" ? "Male" : passport.sex === "Female" ? "Female" : "");
  await fillSelect("dobformat", "DD/MM/YYYY");
  await fillInput("applicant_dob", passport.dateOfBirth || "");
  await fillSelect("applicant_special_category", "Others");
  await fillSelect("applicant_nationality", d.nationality || "");

  // Home Address
  await fillInput("applicant_permaddr", [d.homeAddress, d.homeCity].filter(Boolean).join(", ") || "");
  await fillInput("applicant_permcity", d.homeCity || "");
  await fillSelect("applicant_permcountry", d.nationality || "");

  // India Address (hotel)
  await fillInput("applicant_refaddr", "Near Hema Shree, Gokarna Main Beach");
  await fillSelect("applicant_refstate", "KARNATAKA");
  await page.waitForTimeout(500);
  await fillSelect("applicant_refstatedistr", "UTTARA KANNADA");
  await fillInput("applicant_refpincode", "581421");

  // Passport
  await fillInput("applicant_passpno", passport.passportNumber || "");
  await fillInput("applicant_passplcofissue", passport.placeOfIssue || "");
  await fillSelect("passport_issue_country", d.nationality || "");
  await fillInput("applicant_passpdoissue", formatDate(passport.dateOfIssue || ""));
  await fillInput("applicant_passpvalidtill", formatDate(passport.expiryDate || ""));

  // Visa
  await fillInput("applicant_visano", visa.visaNumber || "");
  await fillInput("applicant_visaplcoissue", visa.placeOfIssue || "");
  await fillSelect("visa_issue_country", "^INDIA$");
  await fillInput("applicant_visadoissue", formatDate(visa.dateOfIssue || ""));
  await fillInput("applicant_visavalidtill", formatDate(visa.validTill || ""));
  await fillSelect("applicant_visatype", visa.type || "Tourist");

  // Arrival (arrivedFromCountry — use starts-with for "INDIA" since exact may have trailing space)
  const arrCountry = d.arrivedFromCountry || "";
  if (arrCountry.toLowerCase() === "india") {
    await fillSelect("applicant_arrivedfromcountry", "INDIA");
  } else {
    await fillSelect("applicant_arrivedfromcountry", arrCountry);
  }
  await fillInput("applicant_arrivedfromcity", d.arrivedFromCity || "");
  await fillInput("applicant_arrivedfromplace", d.arrivedFromPlace || "");
  await fillInput("applicant_doarrivalindia", formatDate(d.dateOfArrivalInIndia || ""));
  await fillInput("applicant_doarrivalhotel", formatDate(d.arrivalDate || ""));
  await fillInput("applicant_timeoarrivalhotel", d.arrivalTime || "");
  await fillInput("applicant_intnddurhotel", d.stayingDays || "");

  // Other Details
  await fillRadio("employed", (d.employedInIndia || "No") === "Yes" ? "Y" : "N");
  await fillSelect("applicant_purpovisit", d.purposeOfVisit || "Tourism");
  await fillRadio("applicant_next_dest_country_flag_r", (d.nextDestination || "").includes("Outside") ? "O" : "I");
  await page.waitForTimeout(500);
  await fillInput("applicant_next_destination_place_IN", d.nextDestCity || d.nextDestState || "");

  // Fill phone numbers + duration last (some FRRO JS may clear fields on dropdown change)
  await page.waitForTimeout(500);
  await fillInput("applicant_intnddurhotel", d.stayingDays || "");
  await fillInput("applicant_contactnoinindia", d.contact || "");
  await fillInput("applicant_mcontactnoinindia", d.contact || "");
  await fillInput("applicant_contactnoperm", d.homeCountryPhone || "");
  await fillInput("applicant_mcontactnoperm", d.homeCountryPhone || "");

  // Re-fill date fields at the end (FRRO date pickers may clear them)
  await page.waitForTimeout(300);
  await page.evaluate((dates) => {
    for (const [name, value] of Object.entries(dates)) {
      if (!value) continue;
      const el = document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
      if (el && !el.value) {
        el.removeAttribute("readonly");
        el.value = value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }, {
    applicant_doarrivalindia: formatDate(d.dateOfArrivalInIndia || ""),
    applicant_doarrivalhotel: formatDate(d.arrivalDate || ""),
    applicant_intnddurhotel: d.stayingDays || "",
  });

  console.log("\nForm C filling complete!");
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
const server = app.listen(PORT, "0.0.0.0", () => {
  const nets = os.networkInterfaces();
  const lanIp = Object.values(nets).flat().find((n: any) => n?.family === "IPv4" && !n?.internal)?.address || "localhost";
  console.log(`\nFRRO Form C Server running on:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${lanIp}:${PORT}`);
  console.log(`\nWaiting for requests from admin panel...\n`);
});

server.on("error", (e: any) => {
  if (e.code === "EADDRINUSE") {
    console.error(`Port ${PORT} already in use. Kill existing process or use a different port.`);
  } else {
    console.error("Server error:", e.message);
  }
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  if (browser) browser.close();
  server.close();
  process.exit(0);
});
