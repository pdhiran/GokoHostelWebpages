import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { getChannelConfig, getRoomTypeMappings, getRatePlanMappings, getSetting, setSetting } from "@/db/queries";
import { getAiosellPropertyDetails, type AiosellConfig } from "./aiosell";
import { compareMappings, mappingFingerprint, mappingHealth, type MappingReport, type MappingHealth } from "./aiosellMappingHealth";
import { logPmsCall } from "./pmsLog";
import { todayIST } from "./utils";

const REPORT_KEY = "aiosell_mapping_report";
const LOCK_KEY = "aiosell_mapping_check_lock";
const DAILY_KEY = "aiosell_mapping_check_day";
const identityOf = (config: AiosellConfig) => JSON.stringify([config.apiBaseUrl.replace(/\/$/, ""), config.hotelCode, config.pmsId]);

async function context() {
  const [config, rooms, plans, raw] = await Promise.all([getChannelConfig(), getRoomTypeMappings(), getRatePlanMappings(), getSetting(REPORT_KEY)]);
  let report: MappingReport | null = null;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed.identity === "string" && typeof parsed.fingerprint === "string" && Array.isArray(parsed.issues)) report = parsed;
  } catch { /* An invalid saved report needs a new check. */ }
  return { config, rooms, plans, report };
}

export async function getMappingHealth(): Promise<MappingHealth> {
  const { config, rooms, plans, report } = await context();
  if (!config?.isActive) return { status: "disabled", report: null };
  return mappingHealth(report, identityOf(config), mappingFingerprint(rooms, plans));
}

export async function checkMappings(source: "daily" | "manual"): Promise<{ health: MappingHealth; skipped?: string }> {
  const state = await context();
  const { config, rooms, plans } = state;
  if (!config?.isActive) return { health: { status: "disabled", report: null }, skipped: "disabled" };
  const identity = identityOf(config);
  const fingerprint = mappingFingerprint(rooms, plans);
  const current = mappingHealth(state.report, identity, fingerprint);
  const db = getDb();
  // A short database lease serializes checks across Worker instances and manual clicks.
  const lease = String(Date.now() + 60000);
  const locked = await db.insert(settings).values({ key: LOCK_KEY, value: lease }).onConflictDoUpdate({
    target: settings.key, set: { value: lease }, setWhere: sql`CAST(${settings.value} AS INTEGER) < ${Date.now()}`,
  }).returning({ key: settings.key });
  if (!locked.length) return { health: current, skipped: "busy" };
  try {
    if (source === "daily") {
      const stamp = `${todayIST()}:${identity}`;
      const claimed = await db.insert(settings).values({ key: DAILY_KEY, value: stamp }).onConflictDoUpdate({
        target: settings.key, set: { value: stamp }, setWhere: sql`${settings.value} != ${stamp}`,
      }).returning({ key: settings.key });
      if (!claimed.length) return { health: current, skipped: "already-checked" };
    }
    const attemptedAt = new Date().toISOString();
    const previous = current.report;
    let report: MappingReport;
    try {
      const property = await getAiosellPropertyDetails(config, source);
      if (!property.success) throw new Error(property.message);
      report = { identity, fingerprint, attemptedAt, checkedAt: attemptedAt, source,
        snapshot: property.details, issues: compareMappings(property.details, rooms, plans) };
    } catch {
      // Keep the last successful snapshot and differences, without exposing connection secrets/errors.
      report = { identity, fingerprint: previous?.fingerprint ?? fingerprint, attemptedAt, source,
        checkedAt: previous?.checkedAt, snapshot: previous?.snapshot, issues: previous?.issues ?? [],
        error: "Could not verify Aiosell mappings. Check Configuration and PMS logs, then try Check again." };
    }
    await setSetting(REPORT_KEY, JSON.stringify(report));
    await logPmsCall({ direction: "pull", type: `mapping check (${source})`, status: report.error || report.issues.length ? "failed" : "success",
      recordsAffected: report.issues.length, response: { checkedAt: report.checkedAt, issues: report.issues },
      errorMessage: report.error || (report.issues.length ? "Mappings differ; pushes continue using saved mappings" : "") });
    // If configuration or mappings changed during the request, do not present a stale match.
    return { health: await getMappingHealth() };
  } finally {
    await db.delete(settings).where(and(eq(settings.key, LOCK_KEY), eq(settings.value, lease)));
  }
}
