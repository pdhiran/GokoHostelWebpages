"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { XIcon, CheckIcon, Loader2Icon, AlertCircleIcon } from "lucide-react";
import { useAdminToast } from "@/components/admin/AdminToast";
import { fetchWithRetry } from "@/components/admin/useAdminApi";
import { exclusiveEndDate } from "@/lib/inventoryAvailability";
import { platformLogo } from "./utils";
import type { DashboardBooking, CalendarDorm, DateRange } from "./types";

type AvailableBed = { id: number; bedId: string; dormId: number; dormName: string; pool?: "online" | "offline" | "block" };

export function UnassignedBookings({
  bookings,
  onAssign,
  onClose,
  password,
  username,
  canAssign = true,
}: {
  bookings: DashboardBooking[];
  dorms: CalendarDorm[];
  dateRange: DateRange;
  onAssign: (bookingId: number, bedIds: number[]) => Promise<boolean>;
  onClose: () => void;
  password: string;
  username?: string;
  canAssign?: boolean;
}) {
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [selectedBeds, setSelectedBeds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [rangeBeds, setRangeBeds] = useState<AvailableBed[]>([]);
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [bedsError, setBedsError] = useState("");
  const { showError } = useAdminToast();

  useEffect(() => {
    if (!assigningId) {
      setRangeBeds([]);
      setLoadingBeds(false);
      setBedsError("");
      return;
    }
    const booking = bookings.find((b) => b.id === assigningId);
    if (!booking?.checkinDate) {
      setRangeBeds([]);
      setLoadingBeds(false);
      setBedsError("This booking has no check-in date.");
      return;
    }
    const checkinDate = booking.checkinDate;
    const checkoutDate = exclusiveEndDate(checkinDate, booking.checkoutDate);
    if (!checkoutDate) {
      setRangeBeds([]);
      setLoadingBeds(false);
      setBedsError("Invalid stay dates on this booking.");
      return;
    }
    setLoadingBeds(true);
    setSelectedBeds([]);
    setBedsError("");
    const payload: Record<string, unknown> = { password, action: "getAvailableBeds", checkinDate, checkoutDate, bookingId: booking.id };
    if (username) payload.username = username;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithRetry("/api/admin/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) {
            setRangeBeds([]);
            setBedsError(typeof data.error === "string" ? data.error : `Failed to load beds (${res.status})`);
          }
          return;
        }
        if (!cancelled) setRangeBeds(data.beds || []);
      } catch {
        if (!cancelled) {
          setRangeBeds([]);
          setBedsError("Network error loading beds");
        }
      } finally {
        if (!cancelled) setLoadingBeds(false);
      }
    })();
    return () => { cancelled = true; };
  }, [assigningId, bookings, password, username]);

  const availableBeds = useMemo(() => {
    const dormMap = new Map<number, { id: number; name: string; beds: AvailableBed[] }>();
    for (const bed of rangeBeds) {
      if (!dormMap.has(bed.dormId)) {
        dormMap.set(bed.dormId, { id: bed.dormId, name: bed.dormName, beds: [] });
      }
      dormMap.get(bed.dormId)!.beds.push(bed);
    }
    return Array.from(dormMap.values());
  }, [rangeBeds]);

  const toggleBed = useCallback((bedId: number) => {
    setSelectedBeds((prev) =>
      prev.includes(bedId) ? prev.filter((id) => id !== bedId) : [...prev, bedId],
    );
  }, []);

  const handleAssign = async (bookingId: number) => {
    if (selectedBeds.length === 0) {
      showError("Select at least one bed");
      return;
    }
    setBusy(true);
    try {
      const ok = await onAssign(bookingId, selectedBeds);
      if (!ok) return;
      setAssigningId(null);
      setSelectedBeds([]);
    } catch {
      showError("Failed to assign beds");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20"
    >
      <div className="flex items-center justify-between border-b border-orange-200 px-4 py-2 dark:border-orange-800">
        <div className="flex items-center gap-2">
          <AlertCircleIcon className="size-4 text-orange-600 dark:text-orange-400" />
          <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-300">
            Unassigned Bookings ({bookings.length})
          </h3>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="divide-y divide-orange-200 dark:divide-orange-800">
        {bookings.length === 0 ? (
          <p className="px-4 py-3 text-xs text-muted-foreground">
            No unassigned bookings. Assigned stays appear as bars on the calendar.
          </p>
        ) : bookings.map((booking) => {
          const platform = platformLogo(booking.platform);
          const isAssigning = assigningId === booking.id;
          return (
            <div key={booking.id} className="p-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {platform && (
                      <span className={cn("inline-flex size-4 items-center justify-center rounded-full text-[8px] font-bold text-white", platform.color)}>
                        {platform.abbr}
                      </span>
                    )}
                    <span className="truncate text-sm font-medium text-foreground">{booking.guestName}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {booking.checkinDate} - {booking.checkoutDate} | {booking.persons} person{booking.persons !== 1 ? "s" : ""}
                    {booking.bookingRef ? ` | ${booking.bookingRef}` : ""}
                  </div>
                </div>
                {canAssign && (
                  !isAssigning ? (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => { setAssigningId(booking.id); setSelectedBeds([]); }}
                  >
                    Assign
                  </Button>
                  ) : (
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => { setAssigningId(null); setSelectedBeds([]); }}
                  >
                    <XIcon className="size-3" />
                  </Button>
                  )
                )}
              </div>

              {/* Bed picker */}
              {isAssigning && (
                <div className="mt-3 space-y-2">
                  {loadingBeds ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2Icon className="size-3.5 animate-spin" /> Loading available beds...
                    </div>
                  ) : bedsError ? (
                    <p className="text-xs text-red-600 dark:text-red-400">{bedsError}</p>
                  ) : availableBeds.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No beds available for this stay.</p>
                  ) : (
                    availableBeds.map((dorm) => (
                    <div key={dorm.id} className="rounded-lg border border-border bg-white p-2 dark:bg-card">
                      <div className="mb-1.5 text-[11px] font-semibold text-foreground">{dorm.name}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {dorm.beds.map((bed) => {
                          const isSelected = selectedBeds.includes(bed.id);
                          const pool = bed.pool ?? "online";
                          return (
                            <button
                              key={bed.id}
                              type="button"
                              onClick={() => toggleBed(bed.id)}
                              className={cn(
                                "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                                isSelected && pool === "online" && "border-sky-600 bg-sky-100 text-sky-800",
                                isSelected && pool === "offline" && "border-emerald-600 bg-emerald-100 text-emerald-800",
                                isSelected && pool === "block" && "border-orange-500 bg-orange-100 text-orange-800",
                                !isSelected && pool === "online" && "border-sky-200 bg-sky-50/80 text-sky-800 hover:bg-sky-100",
                                !isSelected && pool === "offline" && "border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100",
                                !isSelected && pool === "block" && "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100",
                              )}
                            >
                              {isSelected && <CheckIcon className="size-3" />}
                              {bed.bedId}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    ))
                  )}
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="xs"
                      onClick={() => handleAssign(booking.id)}
                      disabled={selectedBeds.length === 0 || busy || loadingBeds}
                    >
                      {busy && <Loader2Icon className="size-3 animate-spin" />}
                      Assign {selectedBeds.length} bed{selectedBeds.length !== 1 ? "s" : ""}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
