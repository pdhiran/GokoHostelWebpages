"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { XIcon, CheckIcon, Loader2Icon, AlertCircleIcon } from "lucide-react";
import { useAdminToast } from "@/components/admin/AdminToast";
import { PLATFORM_LOGOS, STATUS_LABELS } from "./utils";
import type { DashboardBooking, CalendarDorm, DateRange } from "./types";

export function UnassignedBookings({
  bookings,
  dorms,
  dateRange,
  onAssign,
  onClose,
  password,
  username,
}: {
  bookings: DashboardBooking[];
  dorms: CalendarDorm[];
  dateRange: DateRange;
  onAssign: (bookingId: number, bedIds: number[]) => Promise<void>;
  onClose: () => void;
  password: string;
  username?: string;
}) {
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [selectedBeds, setSelectedBeds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const { showError, showSuccess } = useAdminToast();

  const availableBeds = useMemo(() => {
    return dorms.map((dorm) => ({
      ...dorm,
      beds: dorm.beds.filter((bed) => !bed.isBlocked),
    }));
  }, [dorms]);

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
      await onAssign(bookingId, selectedBeds);
      showSuccess("Beds assigned");
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
        {bookings.map((booking) => {
          const platform = PLATFORM_LOGOS[booking.platform];
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
                  </div>
                </div>
                {!isAssigning ? (
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
                )}
              </div>

              {/* Bed picker */}
              {isAssigning && (
                <div className="mt-3 space-y-2">
                  {availableBeds.map((dorm) => (
                    <div key={dorm.id} className="rounded-lg border border-border bg-white p-2 dark:bg-card">
                      <div className="mb-1.5 text-[11px] font-semibold text-foreground">{dorm.name}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {dorm.beds.map((bed) => {
                          const isSelected = selectedBeds.includes(bed.id);
                          return (
                            <button
                              key={bed.id}
                              type="button"
                              onClick={() => toggleBed(bed.id)}
                              className={cn(
                                "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                                isSelected
                                  ? "border-brand-green bg-brand-green/10 text-brand-green"
                                  : "border-input bg-background text-muted-foreground hover:bg-muted",
                              )}
                            >
                              {isSelected && <CheckIcon className="size-3" />}
                              {bed.bedId}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="xs"
                      onClick={() => handleAssign(booking.id)}
                      disabled={selectedBeds.length === 0 || busy}
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
