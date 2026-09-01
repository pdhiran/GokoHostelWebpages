import type { AiosellPropertyDetails } from "@/lib/aiosell";
import { addCalendarDays } from "@/lib/inventoryAvailability";

export function validDateRange(start: string, end: string): boolean {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(start) || !iso.test(end) || start > end) return false;
  const d = new Date(`${start}T00:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === start;
}

export function thirtyDayRange(today: string) {
  return { start: today, end: addCalendarDays(today, 29) };
}

export function invalidRoomCodes(details: AiosellPropertyDetails, codes: Iterable<string>): string[] {
  const remote = new Set(details.rooms.filter((r) => r.active !== false).map((r) => r.room_id));
  return [...new Set(codes)].filter((code) => !remote.has(code));
}

export function invalidRatePlans(details: AiosellPropertyDetails, pairs: Iterable<{ roomCode: string; rateplanCode: string }>) {
  const rooms = new Map(details.rooms.filter((r) => r.active !== false).map((r) => [r.room_id, new Set((r.rateplans || []).map((p) => p.rateplan_id))]));
  return [...pairs].filter((p) => !rooms.get(p.roomCode)?.has(p.rateplanCode));
}

export function warningRoomCodes(warnings: string[] = []): string[] {
  return warnings.map((w) => w.match(/INVALID_ROOM_CODE\s*:\s*(.+)$/i)?.[1]?.trim()).filter((v): v is string => Boolean(v));
}
