/**
 * Display-only PMS log operation lines. Safe for client components.
 * Do not import `@/lib/pmsLog` here — that module writes D1.
 */

import { addCalendarDays, inclusiveNights } from "@/lib/inventoryAvailability";

/** `inventory (auto)` → `inventory`. */
export function pmsLogKind(type?: string | null): string {
  return (type || "").replace(/\s*\(.*\)$/, "").trim().toLowerCase();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SUMMARY_MAX_LINES = 6;

function parseBody(raw?: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function fmtDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
}

function fmtRange(start: string, end: string): string {
  return start === end ? fmtDay(start) : `${fmtDay(start)}–${fmtDay(end)}`;
}

type DeltaCell = { key: string; date: string; from: string | null; to: string };

function groupDeltaLines(cells: DeltaCell[]): string[] {
  const sorted = [...cells].sort((a, b) => a.key.localeCompare(b.key) || a.date.localeCompare(b.date));
  type Run = { key: string; start: string; end: string; from: string | null; to: string };
  const runs: Run[] = [];
  for (const c of sorted) {
    const last = runs[runs.length - 1];
    const cont = last
      && last.key === c.key
      && last.from === c.from
      && last.to === c.to
      && addCalendarDays(last.end, 1) === c.date;
    if (cont) last.end = c.date;
    else runs.push({ key: c.key, start: c.date, end: c.date, from: c.from, to: c.to });
  }
  const changed = runs.filter((r) => r.from != null && r.from !== r.to);
  const fresh = runs.filter((r) => r.from == null);
  const same = runs.filter((r) => r.from != null && r.from === r.to);
  const ordered = changed.length || fresh.length ? [...changed, ...fresh] : same;
  const lines = ordered.map((r) => {
    const when = fmtRange(r.start, r.end);
    if (r.from == null) return `${r.key} ${when} → ${r.to}`;
    if (r.from === r.to) return `${r.key} ${when} ${r.to} (no change)`;
    return `${r.key} ${when} ${r.from} → ${r.to}`;
  });
  if (lines.length <= SUMMARY_MAX_LINES) return lines;
  return [...lines.slice(0, SUMMARY_MAX_LINES), `+${lines.length - SUMMARY_MAX_LINES} more`];
}

function flattenUpdates(
  body: Record<string, unknown> | null,
  itemKey: "rooms" | "rates",
  valueOf: (row: Record<string, unknown>) => { key: string; value: string } | null,
): Map<string, string> {
  const out = new Map<string, string>();
  const updates = body && Array.isArray(body.updates) ? body.updates : [];
  for (const raw of updates) {
    if (!raw || typeof raw !== "object") continue;
    const u = raw as Record<string, unknown>;
    const start = String(u.startDate || "");
    const end = String(u.endDate || start);
    const nights = start && end ? inclusiveNights(start, end < start ? start : end) : [];
    const rows = Array.isArray(u[itemKey]) ? u[itemKey] as unknown[] : [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const parsed = valueOf(row as Record<string, unknown>);
      if (!parsed) continue;
      for (const date of nights) out.set(`${parsed.key}\t${date}`, parsed.value);
    }
  }
  return out;
}

function deltaFromMaps(next: Map<string, string>, prev: Map<string, string> | null): string[] {
  const cells: DeltaCell[] = [];
  for (const [cell, to] of next) {
    const tab = cell.lastIndexOf("\t");
    const key = cell.slice(0, tab);
    const date = cell.slice(tab + 1);
    const from = prev?.has(cell) ? prev.get(cell)! : null;
    cells.push({ key, date, from, to });
  }
  return groupDeltaLines(cells);
}

function roomAvail(row: Record<string, unknown>): { key: string; value: string } | null {
  const room = String(row.roomCode || "").trim();
  const n = Number(row.available);
  if (!room || !Number.isFinite(n)) return null;
  return { key: room, value: String(n) };
}

function rateCell(row: Record<string, unknown>): { key: string; value: string } | null {
  const room = String(row.roomCode || "").trim();
  const plan = String(row.rateplanCode || "").trim();
  const n = Number(row.rate);
  if (!room || !plan || !Number.isFinite(n)) return null;
  return { key: `${room} ${plan}`, value: String(n) };
}

/** Bulk snapshot has the full RestrictionFields object; auto-push is a 1-key patch. */
function compactRestrictions(row: Record<string, unknown>): string | null {
  const r = row.restrictions;
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const patch = Object.keys(o).length <= 2;
  const bits: string[] = [];
  const flag = (on: unknown, label: string, off: string) => {
    if (on === true) bits.push(label);
    else if (patch && on === false) bits.push(off);
  };
  flag(o.stopSell, "stopSell", "stopSell off");
  flag(o.closeOnArrival, "CTA", "CTA off");
  flag(o.closeOnDeparture, "CTD", "CTD off");
  if (o.minimumStay != null && o.minimumStay !== "" && (patch || Number(o.minimumStay) !== 1)) {
    bits.push(`minStay ${o.minimumStay}`);
  }
  if (o.maximumStay != null && o.maximumStay !== "") bits.push(`maxStay ${o.maximumStay}`);
  if (o.minimumAdvanceReservation != null && o.minimumAdvanceReservation !== "") bits.push(`minAdv ${o.minimumAdvanceReservation}`);
  if (o.maximumAdvanceReservation != null && o.maximumAdvanceReservation !== "") bits.push(`maxAdv ${o.maximumAdvanceReservation}`);
  if (bits.length > 0) return bits.join(", ");
  return patch ? null : "open";
}

function restrictionCell(row: Record<string, unknown>): { key: string; value: string } | null {
  const room = String(row.roomCode || "").trim();
  if (!room) return null;
  const text = compactRestrictions(row);
  if (!text) return null;
  const plan = String(row.rateplanCode || "").trim();
  return { key: plan ? `${room} ${plan}` : room, value: text };
}

function restrictionItemKey(body: Record<string, unknown>): "rooms" | "rates" {
  const updates = Array.isArray(body.updates) ? body.updates : [];
  for (const raw of updates) {
    if (raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).rates)) return "rates";
  }
  return "rooms";
}

function summarizeReservation(body: Record<string, unknown>): string {
  const action = String(body.action || "book");
  const verb = action === "modify" ? "Modify" : action === "cancel" ? "Cancel" : "Book";
  const ref = String(body.bookingId || "").trim();
  const channel = String(body.channel || "").trim();
  const guest = body.guest && typeof body.guest === "object"
    ? `${(body.guest as { firstName?: string }).firstName || ""} ${(body.guest as { lastName?: string }).lastName || ""}`.trim()
    : "";
  const rooms = Array.isArray(body.rooms) ? body.rooms as Array<Record<string, unknown>> : [];
  const roomBits = rooms.map((r) => {
    const code = String(r.roomCode || "").trim() || "room";
    const occ = r.occupancy && typeof r.occupancy === "object"
      ? r.occupancy as { adults?: unknown; children?: unknown }
      : null;
    const n = (Number(occ?.adults) || 0) + (Number(occ?.children) || 0);
    return n > 1 ? `${n} ${code}` : code;
  }).filter(Boolean);
  const stay = body.checkin
    ? fmtRange(String(body.checkin), String(body.checkout || body.checkin))
    : "";
  return [verb, ref, guest, channel, roomBits.join(" + "), stay].filter(Boolean).join(" · ");
}

/**
 * Operation line(s) for the PMS log card.
 * Push inventory/rates/restrictions: from→to vs the previous successful payload of the same kind.
 * Pull reservation: book/modify/cancel. Inventory 10→9 is not knowable on pull.
 */
export function summarizePmsLog(args: {
  type?: string | null;
  requestPayload?: string | null;
  previousRequestPayload?: string | null;
}): string {
  const kind = pmsLogKind(args.type);
  const body = parseBody(args.requestPayload);
  if (!kind || !body) return "";
  const prev = parseBody(args.previousRequestPayload);

  if (kind === "reservation") return summarizeReservation(body);

  if (kind === "fetch") {
    const what = String(body.type || "data");
    const start = String(body.startDate || "");
    const end = String(body.endDate || start);
    return start ? `Fetch ${what} ${fmtRange(start, end)}` : `Fetch ${what}`;
  }

  if (kind === "noshow") {
    return ["No-show", String(body.bookingId || "").trim(), String(body.partner || "").trim()].filter(Boolean).join(" · ");
  }

  if (kind === "inventory") {
    return deltaFromMaps(flattenUpdates(body, "rooms", roomAvail), prev ? flattenUpdates(prev, "rooms", roomAvail) : null).join("\n");
  }

  if (kind === "rate") {
    return deltaFromMaps(flattenUpdates(body, "rates", rateCell), prev ? flattenUpdates(prev, "rates", rateCell) : null).join("\n");
  }

  if (kind === "restriction") {
    const itemKey = restrictionItemKey(body);
    return deltaFromMaps(
      flattenUpdates(body, itemKey, restrictionCell),
      prev ? flattenUpdates(prev, itemKey, restrictionCell) : null,
    ).join("\n");
  }

  return "";
}

export function previousPmsPayload<T extends { type?: string | null; status?: string | null; requestPayload?: string | null }>(
  logs: T[],
  index: number,
): string | null {
  const kind = pmsLogKind(logs[index]?.type);
  if (!kind) return null;
  for (let i = index + 1; i < logs.length; i++) {
    const row = logs[i];
    if (pmsLogKind(row.type) !== kind) continue;
    if (row.status && row.status !== "success") continue;
    if (row.requestPayload) return row.requestPayload;
  }
  return null;
}
