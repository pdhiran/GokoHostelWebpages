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

    // Check for validation errors (alert dialogs or error messages on page)
    const pageText = await page.textContent("body") || "";
    const hasError = pageText.includes("Please upload") || pageText.includes("mandatory") || 
                     pageText.includes("required field") || pageText.includes("Photo is required");
    
    // Check if we're still on the form page (save failed)
    const url = page.url();
    if (url.includes("formc.jsp") && hasError) {
      console.log("  ⚠ Save may have failed — validation error detected on page");
      return "FAILED - check browser for validation errors (photo/dates may be required)";
    }

    // Check the Filerfno field first (the Application ID input at top of form)
    const filerfno = await page.$('input[name="Filerfno"]');
    if (filerfno) {
      const val = await filerfno.inputValue();
      if (val && val.length > 3) {
        console.log(`  Captured Application ID (Filerfno): ${val}`);
        return val;
      }
    }

    // Look for Application ID in a pattern like "Application ID : XXXXX" (numeric/alphanumeric, 5+ chars)
    const idMatch = pageText.match(/Application\s*ID\s*[:\s]+([A-Z0-9\-]{5,})/i);
    if (idMatch) {
      console.log(`  Captured Application ID: ${idMatch[1]}`);
      return idMatch[1];
    }

    // Check URL for any ID parameter
    const urlIdMatch = url.match(/[?&](?:id|appId|applicationId)=([^&]+)/i);
    if (urlIdMatch) {
      console.log(`  Captured Application ID from URL: ${urlIdMatch[1]}`);
      return urlIdMatch[1];
    }

    // If still on formc.jsp, save likely failed
    if (url.includes("formc.jsp")) {
      console.log("  ⚠ Still on form page — save may have failed (missing required fields?)");
      return "FAILED - missing required fields (upload photo and fill dates manually, then save)";
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

  // Upload passport photo (resize to <50KB JPG, FRRO requirement)
  try {
    let photoBuffer: Buffer | null = null;

    // Prefer base64 from API (already downloaded server-side with OAuth)
    if (d.passportPhotoBase64) {
      photoBuffer = Buffer.from(d.passportPhotoBase64, "base64");
      console.log(`  Got passport photo from API (${(photoBuffer.length / 1024).toFixed(1)}KB raw)`);
    } else {
      // Fallback: try direct Drive download
      const idLink = d.idCardLink || "";
      const driveLink = idLink.split(" | ")[0];
      if (driveLink && driveLink.startsWith("http")) {
        const imgRes = await fetch(driveLink.replace("/view", "/uc?export=download&confirm=t"));
        if (imgRes.ok) {
          const contentType = imgRes.headers.get("content-type") || "";
          if (contentType.includes("image") || contentType.includes("octet")) {
            photoBuffer = Buffer.from(await imgRes.arrayBuffer());
          } else {
            console.log("  Photo download returned non-image content (likely login page)");
          }
        }
      }
    }

    if (photoBuffer) {
      const sharp = (await import("sharp")).default;
      const TARGET_MIN = 40000; // Aim for 40-48KB (good quality but under FRRO's 50KB limit)
      const TARGET_MAX = 48000;
      let finalPhoto: Buffer;

      // Start with high quality and reduce only if over 48KB
      const attempts = [
        { width: 400, height: 500, quality: 90 },
        { width: 350, height: 450, quality: 85 },
        { width: 300, height: 400, quality: 80 },
        { width: 300, height: 400, quality: 70 },
        { width: 280, height: 370, quality: 65 },
        { width: 250, height: 333, quality: 60 },
        { width: 230, height: 307, quality: 55 },
        { width: 200, height: 267, quality: 50 },
        { width: 180, height: 240, quality: 45 },
      ];

      finalPhoto = await sharp(photoBuffer)
        .resize(attempts[0].width, attempts[0].height, { fit: "cover" })
        .jpeg({ quality: attempts[0].quality })
        .toBuffer();

      for (let i = 1; i < attempts.length && finalPhoto.length > TARGET_MAX; i++) {
        finalPhoto = await sharp(photoBuffer)
          .resize(attempts[i].width, attempts[i].height, { fit: "cover" })
          .jpeg({ quality: attempts[i].quality })
          .toBuffer();
      }

      // If still too small (source image was tiny), try upscaling with high quality
      if (finalPhoto.length < TARGET_MIN) {
        const upscaled = await sharp(photoBuffer)
          .resize(400, 500, { fit: "cover", withoutEnlargement: false })
          .jpeg({ quality: 95 })
          .toBuffer();
        if (upscaled.length <= TARGET_MAX) {
          finalPhoto = upscaled;
        }
      }

      console.log(`  Photo compressed to ${(finalPhoto.length / 1024).toFixed(1)}KB`);

      const fallbackInput = await page.$('input[type="file"]');
      if (fallbackInput) {
        // Step 1: Set file on input (for UI display + to pass the plugin's value check)
        const photoPath = "/tmp/photo.jpg";
        fs.writeFileSync(photoPath, finalPhoto);
        await fallbackInput.setInputFiles(photoPath);
        await page.waitForTimeout(500);
        console.log(`  [DEBUG] File set on input`);

        // Step 2: Set up route interception to capture the real upload URL
        let capturedUploadUrl = "";
        const routeHandler = async (route: any) => {
          const req = route.request();
          if (req.method() === "POST") {
            capturedUploadUrl = req.url();
            console.log(`  [DEBUG] Intercepted POST to: ${capturedUploadUrl}`);
          }
          await route.continue();
        };
        await page.route("**/*", routeHandler);

        // Step 3: Dismiss any alerts and click Upload (iframe clone will send empty file — that's OK)
        page.on("dialog", async (dialog) => {
          console.log(`  [DEBUG] Alert: "${dialog.message().trim()}"`);
          await dialog.accept();
        });

        console.log(`  [DEBUG] Clicking Upload File to capture URL...`);
        await page.click('input[value="Upload File"]');
        await page.waitForTimeout(5000);

        // Step 4: Remove interception
        await page.unroute("**/*", routeHandler);
        console.log(`  [DEBUG] Captured URL: "${capturedUploadUrl}"`);

        // Step 5: Also try reading URL from ajaxfileupload.js source (fallback)
        if (!capturedUploadUrl) {
          const extractedUrl = await page.evaluate(() => {
            const fnStr = (window as any).ajaxFileUpload?.toString() || "";
            const urlMatch = fnStr.match(/url\s*:\s*['"]([^'"]+)/);
            const accoMatch = fnStr.match(/var\s+j\s*=\s*['"]([^'"]+)/);
            let url = urlMatch?.[1] || "";
            const accoCode = accoMatch?.[1] || "";
            if (url.includes("'+j+'")) url = url.replace("'+j+'", accoCode);
            if (url.includes("' + j + '")) url = url.replace("' + j + '", accoCode);
            if (url && !url.startsWith("http")) {
              url = window.location.href.replace(/\/[^/]*$/, "/") + url;
            }
            return url;
          });
          if (extractedUrl) capturedUploadUrl = extractedUrl;
          console.log(`  [DEBUG] URL from function source: "${capturedUploadUrl}"`);
        }

        // Step 6: Replay the upload with actual file data via fetch
        if (capturedUploadUrl) {
          console.log(`  [DEBUG] Replaying upload to: ${capturedUploadUrl}`);
          const uploadResult = await page.evaluate(async (args: { base64: string; url: string }) => {
            try {
              const bin = atob(args.base64);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              const file = new File([bytes], "photo.jpg", { type: "image/jpeg" });
              const fd = new FormData();
              fd.append("file1", file, "photo.jpg");
              const res = await fetch(args.url, { method: "POST", body: fd, credentials: "include" });
              const text = await res.text();
              const pict = document.getElementById("pict");
              if (pict && res.ok) {
                pict.innerHTML = text || '<img src="getPhoto.jsp" width="80" height="100" />';
              }
              return { ok: res.ok, status: res.status, response: text.slice(0, 300) };
            } catch (e: any) {
              return { ok: false, status: 0, response: e.message };
            }
          }, { base64: finalPhoto.toString("base64"), url: capturedUploadUrl });

          console.log(`  [DEBUG] Upload replay result: ${JSON.stringify(uploadResult)}`);
          if (uploadResult.ok) {
            console.log(`  ✓ Photo uploaded (${(finalPhoto.length / 1024).toFixed(1)}KB)`);
          } else {
            console.log(`  ⚠ Photo upload replay failed (status ${uploadResult.status})`);
          }
        } else {
          console.log(`  ⚠ Could not capture upload URL — photo must be uploaded manually`);
        }
      } else {
        console.log("  ✗ No file input found for photo upload");
      }
    } else {
      console.log("  ⚠ No passport photo available to upload");
    }
  } catch (e: any) {
    console.log(`  ✗ Photo upload failed: ${e.message}`);
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

  // Helper: fill date fields that use jQuery datepicker (readonly inputs)
  async function fillDateField(name: string, value: string) {
    if (!value) return;
    const formatted = formatDate(value);
    if (!formatted) return;

    const exists = await page.$(`input[name="${name}"]`);
    if (!exists) {
      console.log(`  ✗ ${name} not found`);
      return;
    }

    // Force-set via JS: remove readonly, set value, trigger all relevant events
    await page.evaluate(({ n, v }) => {
      const input = document.querySelector(`input[name="${n}"]`) as HTMLInputElement;
      if (!input) return;
      input.removeAttribute("readonly");
      input.removeAttribute("disabled");
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value"
      )?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, v);
      } else {
        input.value = v;
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new Event("blur", { bubbles: true }));
      // If jQuery datepicker is attached, update its internal state
      if ((window as any).jQuery && (window as any).jQuery(input).datepicker) {
        try {
          const parts = v.split("/");
          if (parts.length === 3) {
            const dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            (window as any).jQuery(input).datepicker("setDate", dateObj);
          }
        } catch {}
      }
    }, { n: name, v: formatted });
    console.log(`  ✓ ${name} = "${formatted}" (date)`);
  }

  // Helper: select dropdown option by text match (prefers exact match)
  async function fillSelect(name: string, value: string) {
    if (!value) return;
    const forceExact = value.startsWith("^") && value.endsWith("$");
    const searchValue = forceExact ? value.slice(1, -1) : value;

    const el = await page.$(`select[name="${name}"]`);
    if (el) {
      const options = await el.$$("option");
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
      if (searchValue.length > 3) {
        let bestMatch: { text: string; val: string } | null = null;
        for (const opt of options) {
          const text = (await opt.textContent() || "").trim();
          if (text.toUpperCase().includes(searchValue.toUpperCase())) {
            const val = await opt.getAttribute("value") || "";
            if (!bestMatch || text.length < bestMatch.text.length) {
              bestMatch = { text, val };
            }
          }
        }
        if (bestMatch) {
          await el.selectOption(bestMatch.val);
          await el.dispatchEvent("change");
          console.log(`  ✓ ${name} = "${bestMatch.text}" (contains-best)`);
          return;
        }
      }
      console.log(`  ⚠ ${name}: no option matching "${searchValue}"`);
    } else {
      console.log(`  ✗ ${name} not found`);
    }
  }

  // Helper: convert date from various formats to DD/MM/YYYY
  function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    // Already in DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY format
    if (/^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}$/.test(dateStr)) return dateStr.replace(/[.-]/g, "/");
    // YYYY-MM-DD → DD/MM/YYYY
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    // "01 JAN 2025" or "1 January 2025" formats
    const monthNames: Record<string, string> = {
      JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
      JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
      JANUARY: "01", FEBRUARY: "02", MARCH: "03", APRIL: "04",
      JUNE: "06", JULY: "07", AUGUST: "08", SEPTEMBER: "09",
      OCTOBER: "10", NOVEMBER: "11", DECEMBER: "12",
    };
    const textDateMatch = dateStr.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (textDateMatch) {
      const mm = monthNames[textDateMatch[2].toUpperCase()];
      if (mm) return `${textDateMatch[1].padStart(2, "0")}/${mm}/${textDateMatch[3]}`;
    }
    // "JAN 01 2025" format
    const textDateMatch2 = dateStr.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (textDateMatch2) {
      const mm = monthNames[textDateMatch2[1].toUpperCase()];
      if (mm) return `${textDateMatch2[2].padStart(2, "0")}/${mm}/${textDateMatch2[3]}`;
    }
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
  await fillDateField("applicant_dob", passport.dateOfBirth || "");
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
  await fillDateField("applicant_passpdoissue", passport.dateOfIssue || "");
  await fillDateField("applicant_passpvalidtill", passport.expiryDate || "");

  // Visa
  await fillInput("applicant_visano", visa.visaNumber || "");
  await fillInput("applicant_visaplcoissue", visa.placeOfIssue || "");
  await fillSelect("visa_issue_country", "^INDIA$");
  await fillDateField("applicant_visadoissue", visa.dateOfIssue || "");
  await fillDateField("applicant_visavalidtill", visa.validTill || "");
  await fillSelect("applicant_visatype", visa.type || "Tourist");
  await page.waitForTimeout(500);
  // Visa Sub Type — required on FRRO, options load dynamically after visa type is selected
  await page.waitForTimeout(1000);
  const subTypeFilled = await page.evaluate((visaType) => {
    const sel = document.querySelector('select[name="applicant_visasubtype"], select[name="visa_sub_type"]') as HTMLSelectElement;
    if (!sel || sel.options.length <= 1) return false;
    const opts = [...sel.options].filter(o => o.value && o.value !== "Select" && o.value !== "");
    if (opts.length === 0) return false;
    // Try to match e-TOURIST, e-VISA, or the visa type
    const searches = ["e-tourist", "etourist", "e-visa", "evisa", visaType?.toLowerCase() || "tourist"];
    for (const search of searches) {
      const match = opts.find(o => o.text.toLowerCase().includes(search) || o.value.toLowerCase().includes(search));
      if (match) { sel.value = match.value; sel.dispatchEvent(new Event("change", { bubbles: true })); return true; }
    }
    // Fallback: select first available option
    sel.value = opts[0].value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, visa.type || "Tourist");
  console.log(`  ${subTypeFilled ? "✓" : "⚠"} applicant_visasubtype ${subTypeFilled ? "filled" : "no options available"}`);

  // Arrival
  const arrCountry = d.arrivedFromCountry || "";
  if (arrCountry.toLowerCase() === "india") {
    await fillSelect("applicant_arrivedfromcountry", "INDIA");
  } else {
    await fillSelect("applicant_arrivedfromcountry", arrCountry);
  }
  await fillInput("applicant_arrivedfromcity", d.arrivedFromCity || "");
  await fillInput("applicant_arrivedfromplace", d.arrivedFromPlace || "");
  await fillDateField("applicant_doarrivalindia", d.dateOfArrivalInIndia || "");
  await fillDateField("applicant_doarrivalhotel", d.arrivalDate || "");
  await fillInput("applicant_timeoarrivalhotel", d.arrivalTime || "");
  await fillInput("applicant_intnddurhotel", d.stayingDays || "");

  // Other Details
  await fillRadio("employed", (d.employedInIndia || "No") === "Yes" ? "Y" : "N");
  await fillSelect("applicant_purpovisit", d.purposeOfVisit || "Tourism");
  await fillRadio("applicant_next_dest_country_flag_r", (d.nextDestination || "").includes("Outside") ? "O" : "I");
  await page.waitForTimeout(500);
  // Next destination inside India: State dropdown → District dropdown → Place text
  if (!(d.nextDestination || "").includes("Outside")) {
    if (d.nextDestState) {
      await fillSelect("applicant_next_destination_state_IN", d.nextDestState);
      await page.waitForTimeout(500);
    }
    if (d.nextDestCity) {
      await fillSelect("applicant_next_destination_district_IN", d.nextDestCity);
    }
    await fillInput("applicant_next_destination_place_IN", d.nextDestCity || d.nextDestState || "");
  } else {
    await fillInput("applicant_next_destination_place_IN", d.nextDestCity || d.nextDestState || "");
  }

  // Fill phone numbers + duration last (some FRRO JS may clear fields on dropdown change)
  await page.waitForTimeout(500);
  await fillInput("applicant_intnddurhotel", d.stayingDays || "");
  await fillInput("applicant_contactnoinindia", d.contact || "");
  await fillInput("applicant_mcontactnoinindia", d.contact || "");
  await fillInput("applicant_contactnoperm", d.homeCountryPhone || "");
  await fillInput("applicant_mcontactnoperm", d.homeCountryPhone || "");

  // Final pass: force-set ALL date fields via JS (FRRO datepickers tend to clear values)
  await page.waitForTimeout(500);
  const allDates: Record<string, string> = {
    applicant_dob: formatDate(passport.dateOfBirth || ""),
    applicant_passpdoissue: formatDate(passport.dateOfIssue || ""),
    applicant_passpvalidtill: formatDate(passport.expiryDate || ""),
    applicant_visadoissue: formatDate(visa.dateOfIssue || ""),
    applicant_visavalidtill: formatDate(visa.validTill || ""),
    applicant_doarrivalindia: formatDate(d.dateOfArrivalInIndia || ""),
    applicant_doarrivalhotel: formatDate(d.arrivalDate || ""),
  };

  await page.evaluate((dates) => {
    for (const [name, value] of Object.entries(dates)) {
      if (!value) continue;
      const el = document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
      if (el) {
        el.removeAttribute("readonly");
        el.removeAttribute("disabled");
        el.value = value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("input", { bubbles: true }));
        // Also try jQuery datepicker setDate
        if ((window as any).jQuery) {
          try {
            const parts = value.split("/");
            if (parts.length === 3) {
              const dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
              (window as any).jQuery(el).datepicker("setDate", dateObj);
            }
          } catch {}
        }
      }
    }
  }, allDates);

  // Also re-fill the duration field (plain text, no datepicker)
  await page.evaluate((val) => {
    if (!val) return;
    const el = document.querySelector('input[name="applicant_intnddurhotel"]') as HTMLInputElement;
    if (el && !el.value) { el.value = val; el.dispatchEvent(new Event("change", { bubbles: true })); }
  }, d.stayingDays || "");

  console.log("\n  Date fields force-set in final pass");
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
