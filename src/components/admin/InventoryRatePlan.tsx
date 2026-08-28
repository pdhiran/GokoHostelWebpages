"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn, localDateStr } from "@/lib/utils";
import {
  RefreshCwIcon, Loader2Icon, ChevronLeftIcon, ChevronRightIcon,
  PackageIcon, BanIcon, EditIcon,
} from "lucide-react";
import type { Role } from "./types";

type Props = { password: string; username?: string; role: Role; permissions: Record<string, boolean> };

type DormData = { id: number; name: string };
type BedData = { id: number; dormId: number; bedId: string };
type BlockData = { id: number; bedId: number; dormId: number; startDate: string; endDate: string; reason: string };
type AssignmentData = { bedId: number; dormId: number; checkinDate: string; checkoutDate: string; status: string };
type RatePlanData = { id: number; roomMappingId: number; ratePlanCode: string; ratePlanName: string };
type RoomMappingData = { id: number; dormId: number; dormName: string; channelRoomCode: string; totalInventory: number };
type DailyRateData = { id: number; ratePlanId: number; date: string; rate: number; stopSell: number; minimumStay: number; maximumStay: number | null; closeOnArrival: number; closeOnDeparture: number; minimumAdvanceReservation: number | null; maximumAdvanceReservation: number | null; adult1Rate: number | null; adult2Rate: number | null; childRate: number | null; infantRate: number | null; extraPersonRate: number | null };

type GridData = {
  dorms: DormData[];
  beds: BedData[];
  blocks: BlockData[];
  assignments: AssignmentData[];
  roomMappings: RoomMappingData[];
  ratePlans: RatePlanData[];
  rates: DailyRateData[];
  bedConfigs: Array<{ id: number; dormId: number; bedType: string; maxOccupancy: number; extraPersonAllowed: number }>;
  channels: Array<{ id: number; name: string; code: string; isActive: number }>;
};

function generateDates(start: string, days: number): string[] {
  const dates: string[] = [];
  const d = new Date(start + "T00:00:00");
  for (let i = 0; i < days; i++) {
    dates.push(localDateStr(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function formatDateShort(dateStr: string): { day: string; weekday: string; isToday: boolean } {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    day: d.getDate().toString(),
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
    isToday: d.getTime() === today.getTime(),
  };
}

export function InventoryRatePlan({ password, username, role, permissions }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GridData | null>(null);
  const [rangeStart, setRangeStart] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return localDateStr(d);
  });
  const [rangeDays, setRangeDays] = useState(14);
  const [editingCell, setEditingCell] = useState<{ dormId: number; date: string } | null>(null);
  const [editingRate, setEditingRate] = useState<{ ratePlanId: number; date: string } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const dates = useMemo(() => generateDates(rangeStart, rangeDays), [rangeStart, rangeDays]);
  const endDate = useMemo(() => {
    const d = new Date(rangeStart + "T00:00:00");
    d.setDate(d.getDate() + rangeDays);
    return localDateStr(d);
  }, [rangeStart, rangeDays]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, username, action: "getInventoryGrid", startDate: rangeStart, endDate }),
      });
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [password, username, rangeStart, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const computeAvailability = useCallback((dormId: number, date: string): { total: number; blocked: number; assigned: number; available: number } => {
    if (!data) return { total: 0, blocked: 0, assigned: 0, available: 0 };
    const dormBeds = data.beds.filter((b) => b.dormId === dormId);
    const total = dormBeds.length;
    const blockedBedIds = new Set(
      data.blocks.filter((bl) => bl.dormId === dormId && bl.startDate <= date && bl.endDate > date).map((bl) => bl.bedId)
    );
    const blocked = blockedBedIds.size;
    const assigned = data.assignments.filter(
      (a) => a.dormId === dormId && a.status === "assigned" && a.checkinDate <= date && a.checkoutDate > date
    ).length;
    const available = Math.max(0, total - blocked - assigned);
    return { total, blocked, assigned, available };
  }, [data]);

  const computeHeaderStats = useCallback((date: string) => {
    if (!data) return { occupancy: 0, available: 0, sold: 0 };
    let totalBeds = 0, totalBlocked = 0, totalAssigned = 0;
    for (const dorm of data.dorms) {
      const s = computeAvailability(dorm.id, date);
      totalBeds += s.total;
      totalBlocked += s.blocked;
      totalAssigned += s.assigned;
    }
    const sellable = totalBeds - totalBlocked;
    const occupancy = sellable > 0 ? Math.round((totalAssigned / sellable) * 100) : 0;
    return { occupancy, available: sellable - totalAssigned, sold: totalAssigned };
  }, [data, computeAvailability]);

  const getRateForCell = useCallback((ratePlanId: number, date: string): number | null => {
    if (!data) return null;
    const r = data.rates.find((rt) => rt.ratePlanId === ratePlanId && rt.date === date);
    if (!r) return null;
    return r.adult2Rate ?? r.adult1Rate ?? r.rate;
  }, [data]);

  const getRatePlansForDorm = useCallback((dormId: number): RatePlanData[] => {
    if (!data) return [];
    const roomMapping = data.roomMappings.find((rm) => rm.dormId === dormId);
    if (!roomMapping) return [];
    return data.ratePlans.filter((rp) => rp.roomMappingId === roomMapping.id);
  }, [data]);

  const getRatePlanLabel = useCallback((rp: RatePlanData): string => {
    if (!data) return rp.ratePlanName || rp.ratePlanCode;
    const rm = data.roomMappings.find((m) => m.id === rp.roomMappingId);
    const dormName = rm?.dormName ?? "Unknown";
    return `${dormName} — ${rp.ratePlanName || rp.ratePlanCode}`;
  }, [data]);

  const shiftRange = (days: number) => {
    const d = new Date(rangeStart + "T00:00:00");
    d.setDate(d.getDate() + days);
    setRangeStart(localDateStr(d));
  };

  const colWidth = rangeDays <= 7 ? 80 : rangeDays <= 14 ? 60 : 48;

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2Icon className="h-6 w-6 animate-spin text-brand-green" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => shiftRange(-rangeDays)}>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-brand-green-dark dark:text-zinc-200 min-w-[140px] text-center">
            {new Date(rangeStart + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            {" — "}
            {new Date(dates[dates.length - 1] + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => shiftRange(rangeDays)}>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-1">
          {[7, 14, 30].map((d) => (
            <Button key={d} variant={rangeDays === d ? "default" : "outline"} size="sm" onClick={() => setRangeDays(d)}>
              {d}d
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBulkOpen(true)}>
          <PackageIcon className="h-3.5 w-3.5" /> Bulk Update
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={fetchData} disabled={loading}>
          <RefreshCwIcon className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-brand-mist bg-white dark:bg-card shadow-card dark:shadow-none">
        <div className="min-w-max">
          {/* Date header */}
          <div className="flex border-b border-brand-mist sticky top-0 z-10 bg-white dark:bg-card">
            <div className="w-[160px] shrink-0 border-r border-brand-mist px-3 py-2 text-xs font-semibold text-brand-green-dark/60 dark:text-zinc-400">
              Dorm / Rate Plan
            </div>
            {dates.map((date) => {
              const { day, weekday, isToday } = formatDateShort(date);
              return (
                <div
                  key={date}
                  className={cn(
                    "shrink-0 border-r border-brand-mist px-1 py-1.5 text-center",
                    isToday && "bg-brand-green/[0.04]"
                  )}
                  style={{ width: colWidth }}
                >
                  <div className="text-[10px] text-brand-green-dark/50 dark:text-zinc-500">{weekday}</div>
                  <div className={cn("text-xs font-semibold", isToday ? "text-brand-green" : "text-brand-green-dark dark:text-zinc-200")}>{day}</div>
                </div>
              );
            })}
          </div>

          {/* Header stats rows */}
          {["occupancy", "available", "sold"].map((stat) => (
            <div key={stat} className="flex border-b border-brand-mist/50">
              <div className="w-[160px] shrink-0 border-r border-brand-mist px-3 py-1.5 text-[11px] font-medium text-brand-green-dark/50 dark:text-zinc-500 capitalize">
                {stat === "occupancy" ? "Occupancy %" : stat === "available" ? "Available" : "Sold"}
              </div>
              {dates.map((date) => {
                const stats = computeHeaderStats(date);
                const val = stat === "occupancy" ? `${stats.occupancy}%` : stat === "available" ? stats.available : stats.sold;
                return (
                  <div
                    key={date}
                    className={cn(
                      "shrink-0 border-r border-brand-mist/50 px-1 py-1.5 text-center text-[11px] font-medium",
                      stat === "occupancy" && stats.occupancy >= 90 && "text-red-600",
                      stat === "occupancy" && stats.occupancy >= 70 && stats.occupancy < 90 && "text-amber-600",
                      stat === "available" && stats.available === 0 && "text-red-600 font-bold",
                    )}
                    style={{ width: colWidth }}
                  >
                    {val}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Dorm rows */}
          {data?.dorms.map((dorm) => {
            const ratePlans = getRatePlansForDorm(dorm.id);
            return (
              <div key={dorm.id}>
                {/* Availability row */}
                <div className="flex border-b border-brand-mist">
                  <div className="w-[160px] shrink-0 border-r border-brand-mist px-3 py-2 flex items-center gap-2">
                    <span className="text-xs font-semibold text-brand-green-dark dark:text-zinc-200 truncate">{dorm.name}</span>
                  </div>
                  {dates.map((date) => {
                    const { available, blocked } = computeAvailability(dorm.id, date);
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => setEditingCell({ dormId: dorm.id, date })}
                        className={cn(
                          "shrink-0 border-r border-brand-mist/50 px-1 py-2 text-center text-xs font-medium cursor-pointer transition-colors hover:bg-brand-green/[0.04]",
                          available === 0 && "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
                          available > 0 && "text-brand-green-dark dark:text-zinc-200",
                        )}
                        style={{ width: colWidth }}
                      >
                        {available}
                        {blocked > 0 && <BanIcon className="inline ml-0.5 h-2.5 w-2.5 text-orange-400" />}
                      </button>
                    );
                  })}
                </div>

                {/* Rate plan rows */}
                {ratePlans.length > 0 ? ratePlans.map((rp) => (
                  <div key={rp.id} className="flex border-b border-brand-mist/30">
                    <div className="w-[160px] shrink-0 border-r border-brand-mist px-3 py-1.5 pl-5 flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-green/60 shrink-0" />
                      <span className="text-[11px] font-medium text-brand-green-dark/70 dark:text-zinc-400 truncate">{rp.ratePlanName || rp.ratePlanCode}</span>
                    </div>
                    {dates.map((date) => {
                      const rateVal = getRateForCell(rp.id, date);
                      const rateRow = data?.rates.find((r) => r.ratePlanId === rp.id && r.date === date);
                      const isStopped = rateRow?.stopSell === 1;
                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => setEditingRate({ ratePlanId: rp.id, date })}
                          className={cn(
                            "shrink-0 border-r border-brand-mist/30 px-1 py-1.5 text-center text-[11px] cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/10",
                            isStopped && "bg-gray-100 text-gray-400 line-through dark:bg-gray-800/30",
                            !isStopped && rateVal && "text-brand-green-dark dark:text-zinc-300",
                          )}
                          style={{ width: colWidth }}
                        >
                          {rateVal ? `₹${rateVal}` : "—"}
                        </button>
                      );
                    })}
                  </div>
                )) : (
                  <div className="flex border-b border-brand-mist/30">
                    <div className="w-[160px] shrink-0 border-r border-brand-mist px-3 py-1.5 pl-5">
                      <span className="text-[10px] italic text-brand-green-dark/40 dark:text-zinc-600">No rate plans</span>
                    </div>
                    {dates.map((date) => (
                      <div key={date} className="shrink-0 border-r border-brand-mist/30 px-1 py-1.5 text-center text-[10px] text-brand-green-dark/30" style={{ width: colWidth }}>—</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Inventory Detail Popup */}
      {editingCell && data && (
        <InventoryDetailModal
          dormId={editingCell.dormId}
          date={editingCell.date}
          data={data}
          computeAvailability={computeAvailability}
          password={password}
          username={username}
          onClose={() => setEditingCell(null)}
          onSaved={fetchData}
        />
      )}

      {/* Rate Edit Popup */}
      {editingRate && data && (
        <RateEditModal
          ratePlanId={editingRate.ratePlanId}
          date={editingRate.date}
          data={data}
          password={password}
          username={username}
          onClose={() => setEditingRate(null)}
          onSaved={fetchData}
        />
      )}

      {/* Bulk Update */}
      {bulkOpen && (
        <BulkUpdateModal
          data={data}
          password={password}
          username={username}
          onClose={() => setBulkOpen(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}

// --- Inventory Detail Modal ---
function InventoryDetailModal({ dormId, date, data, computeAvailability, password, username, onClose, onSaved }: {
  dormId: number; date: string; data: GridData;
  computeAvailability: (dormId: number, date: string) => { total: number; blocked: number; assigned: number; available: number };
  password: string; username?: string; onClose: () => void; onSaved: () => void;
}) {
  const stats = computeAvailability(dormId, date);
  const dorm = data.dorms.find((d) => d.id === dormId);
  const [saving, setSaving] = useState(false);
  const [onlineOverride, setOnlineOverride] = useState<string>("");
  const [offlineOverride, setOfflineOverride] = useState<string>("");

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password, username, action: "updateInventoryOverride",
          dormId, channelId: null, date,
          onlineAvailable: onlineOverride ? parseInt(onlineOverride) : null,
          offlineAvailable: offlineOverride ? parseInt(offlineOverride) : null,
        }),
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-brand-mist bg-white dark:bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-base font-bold text-brand-green-dark dark:text-zinc-100">
          {dorm?.name} — {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </h3>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-brand-green-dark/60">Total Beds</span><span className="font-medium">{stats.total}</span></div>
          <div className="flex justify-between"><span className="text-brand-green-dark/60">Booked</span><span className="font-medium">{stats.assigned}</span></div>
          <div className="flex justify-between"><span className="text-brand-green-dark/60">Blocked</span><span className="font-medium text-orange-600">{stats.blocked}</span></div>
          <div className="flex justify-between"><span className="text-brand-green-dark/60">Available</span><span className="font-bold text-brand-green">{stats.available}</span></div>
          <hr className="border-brand-mist" />
          <div>
            <label className="text-xs text-brand-green-dark/60">Online Available Override</label>
            <input type="number" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={onlineOverride} onChange={(e) => setOnlineOverride(e.target.value)} placeholder={String(stats.available)} />
          </div>
          <div>
            <label className="text-xs text-brand-green-dark/60">Offline Available Override</label>
            <input type="number" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={offlineOverride} onChange={(e) => setOfflineOverride(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Override"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Rate Edit Modal ---
function RateEditModal({ ratePlanId, date, data, password, username, onClose, onSaved }: {
  ratePlanId: number; date: string; data: GridData;
  password: string; username?: string; onClose: () => void; onSaved: () => void;
}) {
  const existing = data.rates.find((r) => r.ratePlanId === ratePlanId && r.date === date);
  const ratePlan = data.ratePlans.find((rp) => rp.id === ratePlanId);
  const roomMapping = ratePlan ? data.roomMappings.find((rm) => rm.id === ratePlan.roomMappingId) : null;
  const bedConfig = roomMapping ? data.bedConfigs.find((bc) => bc.dormId === roomMapping.dormId) : null;
  const maxOcc = bedConfig?.maxOccupancy ?? 1;
  const extraAllowed = bedConfig?.extraPersonAllowed ?? 0;

  const [rate, setRate] = useState(String(existing?.rate ?? ""));
  const [adult1, setAdult1] = useState(String(existing?.adult1Rate ?? ""));
  const [adult2, setAdult2] = useState(String(existing?.adult2Rate ?? ""));
  const [child, setChild] = useState(String(existing?.childRate ?? ""));
  const [infant, setInfant] = useState(String(existing?.infantRate ?? ""));
  const [extra, setExtra] = useState(String(existing?.extraPersonRate ?? ""));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password, username, action: "updateRate",
          ratePlanId, date,
          rate: parseInt(rate) || parseInt(adult1) || 0,
          adult1Rate: adult1 ? parseInt(adult1) : null,
          adult2Rate: adult2 ? parseInt(adult2) : null,
          childRate: child ? parseInt(child) : null,
          infantRate: infant ? parseInt(infant) : null,
          extraPersonRate: extra ? parseInt(extra) : null,
        }),
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-brand-mist bg-white dark:bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-base font-bold text-brand-green-dark dark:text-zinc-100">
          {ratePlan?.ratePlanName || ratePlan?.ratePlanCode} — {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </h3>
        <div className="mt-3 space-y-2">
          <div>
            <label className="text-xs text-brand-green-dark/60">Adult 1 Rate (₹)</label>
            <input type="number" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={adult1} onChange={(e) => setAdult1(e.target.value)} />
          </div>
          {maxOcc >= 2 && (
            <div>
              <label className="text-xs text-brand-green-dark/60">Adult 2 Rate (₹)</label>
              <input type="number" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={adult2} onChange={(e) => setAdult2(e.target.value)} />
            </div>
          )}
          <div>
            <label className="text-xs text-brand-green-dark/60">Child Rate (₹)</label>
            <input type="number" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={child} onChange={(e) => setChild(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-brand-green-dark/60">Infant Rate (₹)</label>
            <input type="number" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={infant} onChange={(e) => setInfant(e.target.value)} />
          </div>
          {extraAllowed === 1 && (
            <div>
              <label className="text-xs text-brand-green-dark/60">Extra Person Rate (₹)</label>
              <input type="number" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={extra} onChange={(e) => setExtra(e.target.value)} />
            </div>
          )}
          <div>
            <label className="text-xs text-brand-green-dark/60">Display Rate (₹)</label>
            <input type="number" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Auto from Adult 1" />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Rate"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Bulk Update Modal ---
function BulkUpdateModal({ data, password, username, onClose, onSaved }: {
  data: GridData | null; password: string; username?: string; onClose: () => void; onSaved: () => void;
}) {
  const [tab, setTab] = useState<"blockBeds" | "unblockBeds" | "setRates" | "adjustRates" | "restrictions">("blockBeds");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string>("");

  const getRatePlanLabel = (rp: RatePlanData): string => {
    const rm = data?.roomMappings.find((m) => m.id === rp.roomMappingId);
    return `${rm?.dormName ?? "Unknown"} — ${rp.ratePlanName || rp.ratePlanCode}`;
  };

  // Block beds state
  const [blockBedIds, setBlockBedIds] = useState<number[]>([]);
  const [blockDormId, setBlockDormId] = useState<number>(0);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");

  // Unblock state
  const [unblockIds, setUnblockIds] = useState<number[]>([]);

  // Set rates state
  const [rateRpId, setRateRpId] = useState<number>(0);
  const [rateStart, setRateStart] = useState("");
  const [rateEnd, setRateEnd] = useState("");
  const [rateValue, setRateValue] = useState("");
  const [rateDays, setRateDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  // Adjust rates state
  const [adjustRpIds, setAdjustRpIds] = useState<number[]>([]);
  const [adjustStart, setAdjustStart] = useState("");
  const [adjustEnd, setAdjustEnd] = useState("");
  const [adjustDirection, setAdjustDirection] = useState<"increase" | "decrease">("increase");
  const [adjustValue, setAdjustValue] = useState("");
  const [adjustType, setAdjustType] = useState<"percentage" | "flat">("percentage");
  const [adjustDays, setAdjustDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  // Restrictions state
  const [restrictRpIds, setRestrictRpIds] = useState<number[]>([]);
  const [restrictStart, setRestrictStart] = useState("");
  const [restrictEnd, setRestrictEnd] = useState("");
  const [restrictDays, setRestrictDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [restrictType, setRestrictType] = useState<string>("stopSell");
  const [restrictValue, setRestrictValue] = useState<string | boolean>("");

  const dormBeds = useMemo(() => {
    if (!data || !blockDormId) return [];
    return data.beds.filter((b) => b.dormId === blockDormId);
  }, [data, blockDormId]);

  const activeBlocks = useMemo(() => {
    if (!data) return [];
    return data.blocks.filter((b) => b.startDate <= (blockEnd || "9999") && b.endDate > (blockStart || "0000"));
  }, [data, blockStart, blockEnd]);

  const toggleDay = (day: number, currentDays: number[], setter: (d: number[]) => void) => {
    setter(currentDays.includes(day) ? currentDays.filter((d) => d !== day) : [...currentDays, day]);
  };

  const DaySelector = ({ days, setDays }: { days: number[]; setDays: (d: number[]) => void }) => (
    <div className="flex gap-1 flex-wrap">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name, i) => (
        <button key={i} type="button" onClick={() => toggleDay(i, days, setDays)}
          className={cn("px-2 py-1 rounded text-[10px] font-medium border", days.includes(i) ? "bg-brand-green text-white border-brand-green" : "border-input text-brand-green-dark/60")}
        >{name}</button>
      ))}
      <button type="button" onClick={() => setDays([1, 2, 3, 4, 5])} className="px-2 py-1 rounded text-[10px] border border-input text-brand-green-dark/60 hover:bg-brand-sand">Weekdays</button>
      <button type="button" onClick={() => setDays([0, 6])} className="px-2 py-1 rounded text-[10px] border border-input text-brand-green-dark/60 hover:bg-brand-sand">Weekends</button>
      <button type="button" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])} className="px-2 py-1 rounded text-[10px] border border-input text-brand-green-dark/60 hover:bg-brand-sand">All</button>
    </div>
  );

  const handleBlockBeds = async () => {
    if (!blockBedIds.length || !blockStart || !blockEnd) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, username, action: "blockBeds", bedIds: blockBedIds, dormId: blockDormId, startDate: blockStart, endDate: blockEnd, reason: blockReason }),
      });
      const json = await res.json();
      setResult(json.success ? `Blocked ${json.blocked} bed(s)` : json.error);
      if (json.success) { onSaved(); }
    } finally { setSaving(false); }
  };

  const handleUnblockBeds = async () => {
    if (!unblockIds.length) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, username, action: "unblockBeds", blockIds: unblockIds }),
      });
      const json = await res.json();
      setResult(json.success ? "Beds unblocked" : json.error);
      if (json.success) { onSaved(); }
    } finally { setSaving(false); }
  };

  const handleSetRates = async () => {
    if (!rateRpId || !rateStart || !rateEnd || !rateValue) return;
    setSaving(true);
    try {
      const dates: string[] = [];
      const d = new Date(rateStart + "T00:00:00");
      const end = new Date(rateEnd + "T00:00:00");
      while (d <= end) { dates.push(localDateStr(d)); d.setDate(d.getDate() + 1); }
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, username, action: "bulkSetRates", ratePlanId: rateRpId, dates, dayFilter: rateDays, rate: parseInt(rateValue), adult1Rate: parseInt(rateValue) }),
      });
      const json = await res.json();
      setResult(json.success ? `Updated ${json.updated} rate(s)` : json.error);
      if (json.success) { onSaved(); }
    } finally { setSaving(false); }
  };

  const handleAdjustRates = async () => {
    if (!adjustRpIds.length || !adjustStart || !adjustEnd || !adjustValue) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, username, action: "bulkAdjustRates", ratePlanIds: adjustRpIds, startDate: adjustStart, endDate: adjustEnd, dayFilter: adjustDays, direction: adjustDirection, value: parseInt(adjustValue), type: adjustType }),
      });
      const json = await res.json();
      setResult(json.success ? `Adjusted ${json.updated} rate(s)` : json.error);
      if (json.success) { onSaved(); }
    } finally { setSaving(false); }
  };

  const handleSetRestrictions = async () => {
    if (!restrictRpIds.length || !restrictStart || !restrictEnd || !restrictType) return;
    setSaving(true);
    try {
      const booleanTypes = ["stopSell", "closeOnArrival", "closeOnDeparture"];
      const val = booleanTypes.includes(restrictType) ? (restrictValue === true || restrictValue === "true") : (parseInt(String(restrictValue)) || null);
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, username, action: "bulkSetRestrictions", ratePlanIds: restrictRpIds, startDate: restrictStart, endDate: restrictEnd, dayFilter: restrictDays, restrictionType: restrictType, value: val }),
      });
      const json = await res.json();
      setResult(json.success ? `Updated ${json.updated} restriction(s)` : json.error);
      if (json.success) { onSaved(); }
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-brand-mist bg-white dark:bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-brand-green-dark dark:text-zinc-100">Bulk Update</h3>

        {/* Tabs */}
        <div className="mt-3 flex gap-1 flex-wrap">
          {([["blockBeds", "Block Beds"], ["unblockBeds", "Unblock"], ["setRates", "Set Rates"], ["adjustRates", "Adjust Rates"], ["restrictions", "Restrictions"]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => { setTab(id); setResult(""); }}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", tab === id ? "bg-brand-green text-white" : "bg-brand-sand text-brand-green-dark/70 hover:bg-brand-mist")}
            >{label}</button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {tab === "blockBeds" && (
            <>
              <div>
                <label className="text-xs font-medium">Dorm</label>
                <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={blockDormId} onChange={(e) => { setBlockDormId(Number(e.target.value)); setBlockBedIds([]); }}>
                  <option value={0}>Select dorm</option>
                  {data?.dorms.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              {blockDormId > 0 && (
                <div>
                  <label className="text-xs font-medium">Beds</label>
                  <div className="mt-1 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    <button type="button" onClick={() => setBlockBedIds(blockBedIds.length === dormBeds.length ? [] : dormBeds.map((b) => b.id))}
                      className="px-2 py-1 rounded text-[10px] font-medium border border-brand-green text-brand-green">
                      {blockBedIds.length === dormBeds.length ? "Deselect All" : "Select All"}
                    </button>
                    {dormBeds.map((b) => (
                      <button key={b.id} type="button" onClick={() => setBlockBedIds(blockBedIds.includes(b.id) ? blockBedIds.filter((x) => x !== b.id) : [...blockBedIds, b.id])}
                        className={cn("px-2 py-1 rounded text-[10px] font-medium border", blockBedIds.includes(b.id) ? "bg-brand-green text-white border-brand-green" : "border-input")}>
                        {b.bedId}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs font-medium">Start Date</label><input type="date" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} /></div>
                <div><label className="text-xs font-medium">End Date</label><input type="date" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} /></div>
              </div>
              <div><label className="text-xs font-medium">Reason</label><input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Maintenance, etc." /></div>
              <Button variant="cta" size="sm" className="w-full" onClick={handleBlockBeds} disabled={saving || !blockBedIds.length || !blockStart || !blockEnd}>
                {saving ? "Blocking..." : `Block ${blockBedIds.length} Bed(s)`}
              </Button>
            </>
          )}

          {tab === "unblockBeds" && (
            <>
              <div className="text-xs text-brand-green-dark/60 mb-2">Active blocks:</div>
              {data?.blocks.filter((b) => b.startDate <= "9999").length === 0 && <p className="text-sm text-brand-green-dark/50">No active blocks found.</p>}
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {data?.blocks.map((bl) => {
                  const bed = data.beds.find((b) => b.id === bl.bedId);
                  const dorm = data.dorms.find((d) => d.id === bl.dormId);
                  return (
                    <label key={bl.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-brand-sand text-xs cursor-pointer">
                      <input type="checkbox" checked={unblockIds.includes(bl.id)} onChange={() => setUnblockIds(unblockIds.includes(bl.id) ? unblockIds.filter((x) => x !== bl.id) : [...unblockIds, bl.id])} />
                      <span className="font-medium">{dorm?.name} — {bed?.bedId}</span>
                      <span className="text-brand-green-dark/50">{bl.startDate} to {bl.endDate}</span>
                      {bl.reason && <span className="text-brand-green-dark/40">({bl.reason})</span>}
                    </label>
                  );
                })}
              </div>
              <Button variant="cta" size="sm" className="w-full" onClick={handleUnblockBeds} disabled={saving || !unblockIds.length}>
                {saving ? "Unblocking..." : `Unblock ${unblockIds.length} Block(s)`}
              </Button>
            </>
          )}

          {tab === "setRates" && (
            <>
              <div>
                <label className="text-xs font-medium">Rate Plan</label>
                <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={rateRpId} onChange={(e) => setRateRpId(Number(e.target.value))}>
                  <option value={0}>Select rate plan</option>
                  {data?.ratePlans.map((rp) => <option key={rp.id} value={rp.id}>{getRatePlanLabel(rp)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs font-medium">Start Date</label><input type="date" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={rateStart} onChange={(e) => setRateStart(e.target.value)} /></div>
                <div><label className="text-xs font-medium">End Date</label><input type="date" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={rateEnd} onChange={(e) => setRateEnd(e.target.value)} /></div>
              </div>
              <div><label className="text-xs font-medium">Days</label><div className="mt-1"><DaySelector days={rateDays} setDays={setRateDays} /></div></div>
              <div><label className="text-xs font-medium">Rate (₹)</label><input type="number" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={rateValue} onChange={(e) => setRateValue(e.target.value)} /></div>
              <Button variant="cta" size="sm" className="w-full" onClick={handleSetRates} disabled={saving || !rateRpId || !rateStart || !rateEnd || !rateValue}>
                {saving ? "Setting..." : "Set Rates"}
              </Button>
            </>
          )}

          {tab === "adjustRates" && (
            <>
              <div>
                <label className="text-xs font-medium">Rate Plans</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {data?.ratePlans.map((rp) => (
                    <button key={rp.id} type="button" onClick={() => setAdjustRpIds(adjustRpIds.includes(rp.id) ? adjustRpIds.filter((x) => x !== rp.id) : [...adjustRpIds, rp.id])}
                      className={cn("px-2 py-1 rounded text-[10px] font-medium border", adjustRpIds.includes(rp.id) ? "bg-brand-green text-white border-brand-green" : "border-input")}>
                      {getRatePlanLabel(rp)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs font-medium">Start</label><input type="date" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={adjustStart} onChange={(e) => setAdjustStart(e.target.value)} /></div>
                <div><label className="text-xs font-medium">End</label><input type="date" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={adjustEnd} onChange={(e) => setAdjustEnd(e.target.value)} /></div>
              </div>
              <div><label className="text-xs font-medium">Days</label><div className="mt-1"><DaySelector days={adjustDays} setDays={setAdjustDays} /></div></div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAdjustDirection("increase")} className={cn("flex-1 py-1.5 rounded text-xs font-medium border", adjustDirection === "increase" ? "bg-green-600 text-white border-green-600" : "border-input")}>Increase</button>
                <button type="button" onClick={() => setAdjustDirection("decrease")} className={cn("flex-1 py-1.5 rounded text-xs font-medium border", adjustDirection === "decrease" ? "bg-red-600 text-white border-red-600" : "border-input")}>Decrease</button>
              </div>
              <div className="flex gap-2">
                <input type="number" className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={adjustValue} onChange={(e) => setAdjustValue(e.target.value)} placeholder="Value" />
                <select className="rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={adjustType} onChange={(e) => setAdjustType(e.target.value as any)}>
                  <option value="percentage">%</option>
                  <option value="flat">₹ Flat</option>
                </select>
              </div>
              <Button variant="cta" size="sm" className="w-full" onClick={handleAdjustRates} disabled={saving || !adjustRpIds.length || !adjustStart || !adjustEnd || !adjustValue}>
                {saving ? "Adjusting..." : "Adjust Rates"}
              </Button>
            </>
          )}

          {tab === "restrictions" && (
            <>
              <div>
                <label className="text-xs font-medium">Rate Plans</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {data?.ratePlans.map((rp) => (
                    <button key={rp.id} type="button" onClick={() => setRestrictRpIds(restrictRpIds.includes(rp.id) ? restrictRpIds.filter((x) => x !== rp.id) : [...restrictRpIds, rp.id])}
                      className={cn("px-2 py-1 rounded text-[10px] font-medium border", restrictRpIds.includes(rp.id) ? "bg-brand-green text-white border-brand-green" : "border-input")}>
                      {rp.ratePlanName || rp.ratePlanCode}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs font-medium">Start</label><input type="date" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={restrictStart} onChange={(e) => setRestrictStart(e.target.value)} /></div>
                <div><label className="text-xs font-medium">End</label><input type="date" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={restrictEnd} onChange={(e) => setRestrictEnd(e.target.value)} /></div>
              </div>
              <div><label className="text-xs font-medium">Days</label><div className="mt-1"><DaySelector days={restrictDays} setDays={setRestrictDays} /></div></div>
              <div>
                <label className="text-xs font-medium">Restriction Type</label>
                <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={restrictType} onChange={(e) => { setRestrictType(e.target.value); setRestrictValue(""); }}>
                  <option value="stopSell">Stop Sell</option>
                  <option value="closeOnArrival">Close on Arrival</option>
                  <option value="closeOnDeparture">Close on Departure</option>
                  <option value="minimumStay">Minimum Stay</option>
                  <option value="maximumStay">Maximum Stay</option>
                  <option value="minimumAdvanceReservation">Min Advance Reservation</option>
                  <option value="maximumAdvanceReservation">Max Advance Reservation</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Value</label>
                {["stopSell", "closeOnArrival", "closeOnDeparture"].includes(restrictType) ? (
                  <div className="mt-1 flex gap-2">
                    <button type="button" onClick={() => setRestrictValue(true)} className={cn("flex-1 py-1.5 rounded text-xs font-medium border", restrictValue === true ? "bg-red-600 text-white border-red-600" : "border-input")}>Enable</button>
                    <button type="button" onClick={() => setRestrictValue(false)} className={cn("flex-1 py-1.5 rounded text-xs font-medium border", restrictValue === false ? "bg-green-600 text-white border-green-600" : "border-input")}>Disable</button>
                  </div>
                ) : (
                  <input type="number" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={String(restrictValue)} onChange={(e) => setRestrictValue(e.target.value)} placeholder="Number of nights / days" />
                )}
              </div>
              <Button variant="cta" size="sm" className="w-full" onClick={handleSetRestrictions} disabled={saving || !restrictRpIds.length || !restrictStart || !restrictEnd || restrictValue === ""}>
                {saving ? "Setting..." : "Set Restrictions"}
              </Button>
            </>
          )}
        </div>

        {result && <p className="mt-3 text-sm font-medium text-brand-green">{result}</p>}

        <div className="mt-4">
          <Button variant="outline" size="sm" className="w-full" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
