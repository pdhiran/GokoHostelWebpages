import type { AiosellPropertyDetails } from "./aiosell";

export type MappingRoom = { id: number; dormId: number; dormName?: string | null; channelRoomCode: string; isActive: number | boolean | null };
export type MappingPlan = { id: number; roomMappingId: number; ratePlanCode: string; isActive: number | boolean | null };
export type MappingIssue = {
  kind: "missing-room" | "inactive-room" | "extra-room" | "missing-plan" | "extra-plan";
  roomCode: string; planCode?: string; remoteName?: string; dormName?: string;
  dormId?: number; roomMappingId?: number; planId?: number;
};
export type MappingReport = {
  identity: string; fingerprint: string; attemptedAt: string; checkedAt?: string;
  source: "daily" | "manual"; error?: string; issues: MappingIssue[];
  snapshot?: AiosellPropertyDetails;
};
export type MappingHealth = {
  status: "disabled" | "pending" | "changed" | "failed" | "stale" | "mismatch" | "match";
  report: MappingReport | null;
};

export function mappingFingerprint(rooms: MappingRoom[], plans: MappingPlan[]): string {
  const activeRooms = rooms.filter((r) => r.isActive);
  const ids = new Set(activeRooms.map((r) => r.id));
  return JSON.stringify([
    activeRooms.map((r) => [r.id, r.dormId, r.channelRoomCode]).sort(),
    plans.filter((p) => p.isActive && ids.has(p.roomMappingId)).map((p) => [p.id, p.roomMappingId, p.ratePlanCode]).sort(),
  ]);
}

export function compareMappings(details: AiosellPropertyDetails, rooms: MappingRoom[], plans: MappingPlan[]): MappingIssue[] {
  const issues: MappingIssue[] = [];
  const activeRooms = rooms.filter((r) => r.isActive);
  const remote = new Map(details.rooms.map((r) => [r.room_id, r]));
  for (const room of activeRooms) {
    const common = { roomCode: room.channelRoomCode, dormId: room.dormId, dormName: room.dormName ?? undefined, roomMappingId: room.id };
    const found = remote.get(room.channelRoomCode);
    if (!found || found.active === false) {
      issues.push({ ...common, kind: found ? "inactive-room" : "missing-room", remoteName: found?.room_name });
      continue; // Fix the parent room first; avoid repeating one issue for every child plan.
    }
    const localPlans = plans.filter((p) => p.isActive && p.roomMappingId === room.id);
    const remotePlans = new Set((found.rateplans ?? []).map((p) => p.rateplan_id));
    for (const plan of localPlans) if (!remotePlans.has(plan.ratePlanCode)) {
      issues.push({ ...common, kind: "missing-plan", planCode: plan.ratePlanCode, planId: plan.id });
    }
    for (const plan of found.rateplans ?? []) if (!localPlans.some((p) => p.ratePlanCode === plan.rateplan_id)) {
      issues.push({ ...common, kind: "extra-plan", planCode: plan.rateplan_id, remoteName: plan.rateplan_name });
    }
  }
  for (const room of details.rooms) if (room.active !== false && !activeRooms.some((r) => r.channelRoomCode === room.room_id)) {
    issues.push({ kind: "extra-room", roomCode: room.room_id, remoteName: room.room_name });
  }
  return issues;
}

export function mappingHealth(report: MappingReport | null, identity: string, fingerprint: string, now = Date.now()): MappingHealth {
  if (!report || report.identity !== identity) return { status: "pending", report: null };
  const status = report.fingerprint !== fingerprint ? "changed" : report.error ? "failed" : !report.checkedAt ? "pending"
    : now - Date.parse(report.checkedAt) > 48 * 3600000 ? "stale" : report.issues.length ? "mismatch" : "match";
  return { status, report };
}

export const MAPPING_HEALTH_LABELS: Record<MappingHealth["status"], string> = {
  disabled: "Aiosell is not enabled", pending: "Mapping check pending", changed: "Mappings changed — verification needed",
  failed: "Aiosell mapping check failed", stale: "Aiosell mapping check is overdue", mismatch: "Aiosell mappings differ", match: "Mappings match",
};
export const MAPPING_ISSUE_HELP: Record<MappingIssue["kind"], { title: string; steps: string[] }> = {
  "missing-room": { title: "Local room missing in Aiosell", steps: ["Confirm whether this room was renamed, replaced, or retired in Aiosell. Pushes using this code may fail.", "Open Room Mapping and edit the affected dorm to use its confirmed active Aiosell code. If retired, disable the mapping.", "Review its rate plans, then return to Sync & Logs and click Check again."] },
  "inactive-room": { title: "Room inactive in Aiosell", steps: ["Confirm whether the room should still be managed. Pushes using this inactive code may fail.", "Restore it in Aiosell if it should be active, or disable/correct its local Room Mapping.", "Return to Sync & Logs and click Check again."] },
  "extra-room": { title: "Aiosell room not mapped here", steps: ["Confirm which dorm, if any, this Aiosell room represents.", "If managed here, add the correct Room Mapping and its rate plans. If accidental or retired, correct it in Aiosell.", "An intentionally unmanaged active room remains a reported difference. Click Check again after corrections."] },
  "missing-plan": { title: "Local rate plan missing under this room", steps: ["Confirm the replacement rate-plan code under this exact Aiosell room. The same code under another room does not match.", "Open Rate Plans and edit the affected plan, or disable it if retired. Pushes using its old code may fail.", "Return to Sync & Logs and click Check again."] },
  "extra-plan": { title: "Aiosell rate plan not tracked here", steps: ["Confirm whether this rate plan should be managed here.", "Add it under the correct mapped room in Rate Plans, or correct its status in Aiosell if retired or accidental.", "An intentionally unmanaged active plan remains a reported difference. Click Check again after corrections."] },
};
