"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronRightIcon, BanIcon } from "lucide-react";
import { BookingTile } from "./BookingTile";
import { getDatesArray, formatDateShort, formatDateCompact, isToday, isWeekend } from "./utils";
import type { DashboardBooking, BedAssignment, CalendarDorm, DateRange } from "./types";

type TilePlacement = {
  booking: DashboardBooking;
  startCol: number;
  spanCols: number;
  isMultiBed: boolean;
};

function computeTilePlacements(
  bedId: number,
  assignments: BedAssignment[],
  bookingMap: Map<number, DashboardBooking>,
  dates: string[],
  multiBedBookings: Set<number>,
): TilePlacement[] {
  const placements: TilePlacement[] = [];
  const bedAssigns = assignments.filter((a) => a.bedId === bedId && a.status === "assigned");

  for (const assign of bedAssigns) {
    const booking = bookingMap.get(assign.bookingId);
    if (!booking) continue;

    let startIdx = dates.indexOf(assign.checkinDate);
    if (startIdx < 0) {
      if (assign.checkinDate < dates[0]) startIdx = 0;
      else continue;
    }

    let endIdx = dates.indexOf(assign.checkoutDate);
    if (endIdx < 0) {
      if (assign.checkoutDate > dates[dates.length - 1]) endIdx = dates.length;
      else continue;
    }

    const spanCols = Math.max(1, endIdx - startIdx);

    placements.push({
      booking,
      startCol: startIdx,
      spanCols,
      isMultiBed: multiBedBookings.has(booking.id),
    });
  }

  return placements;
}

export function BookingCalendarGrid({
  bookings,
  assignments,
  dorms,
  dateRange,
  today,
  onSelectBooking,
  selectedBookingId,
  onToggleDorm,
}: {
  bookings: DashboardBooking[];
  assignments: BedAssignment[];
  dorms: CalendarDorm[];
  dateRange: DateRange;
  today: string;
  onSelectBooking: (id: number) => void;
  selectedBookingId: number | null;
  onToggleDorm: (dormId: number) => void;
}) {
  const dates = useMemo(() => getDatesArray(dateRange.startDate, dateRange.endDate), [dateRange]);
  const isCompact = dates.length > 10;
  const colWidth = isCompact ? 50 : 80;

  const bookingMap = useMemo(() => {
    const m = new Map<number, DashboardBooking>();
    bookings.forEach((b) => m.set(b.id, b));
    return m;
  }, [bookings]);

  const multiBedBookings = useMemo(() => {
    const counts = new Map<number, number>();
    assignments.filter((a) => a.status === "assigned").forEach((a) => {
      counts.set(a.bookingId, (counts.get(a.bookingId) || 0) + 1);
    });
    const multi = new Set<number>();
    counts.forEach((count, bId) => { if (count > 1) multi.add(bId); });
    return multi;
  }, [assignments]);

  const dormOccupancy = useMemo(() => {
    const occ = new Map<number, { total: number; occupied: number }>();
    for (const dorm of dorms) {
      const total = dorm.beds.filter((b) => !b.isBlocked).length;
      let occupied = 0;
      for (const bed of dorm.beds) {
        if (bed.isBlocked) continue;
        const hasAssignment = assignments.some(
          (a) => a.bedId === bed.id && a.status === "assigned" && a.checkinDate <= today && a.checkoutDate > today
        );
        if (hasAssignment) occupied++;
      }
      occ.set(dorm.id, { total, occupied });
    }
    return occ;
  }, [dorms, assignments, today]);

  const gridWidth = dates.length * colWidth;

  return (
    <div className="isolate min-h-0 flex-1 overflow-auto overscroll-contain rounded-xl border border-border bg-white dark:bg-card">
      <div className="inline-flex min-w-full">
          {/* Sticky left column: dorm/bed labels */}
          <div className="sticky left-0 z-20 w-[140px] shrink-0 border-r border-border bg-white dark:bg-card">
            <div className="sticky top-0 left-0 z-30 flex h-[52px] items-end border-b border-border bg-brand-sand px-2 pb-1 shadow-[0_1px_4px_rgba(45,92,63,0.08)] dark:bg-zinc-800 dark:shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
              <span className="text-[10px] font-medium text-muted-foreground">Dorms / Beds</span>
            </div>
            {dorms.map((dorm, dormIdx) => {
              const occ = dormOccupancy.get(dorm.id);
              const dormBg = dormIdx % 2 === 0
                ? "bg-emerald-50 dark:bg-emerald-950/30"
                : "bg-sky-50 dark:bg-sky-950/25";
              return (
                <div key={dorm.id}>
                  <button
                    type="button"
                    onClick={() => onToggleDorm(dorm.id)}
                    className={cn(
                      "flex h-8 w-full items-center gap-1 border-b border-border px-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted",
                      dormBg,
                    )}
                  >
                    {dorm.collapsed ? <ChevronRightIcon className="size-3.5 shrink-0" /> : <ChevronDownIcon className="size-3.5 shrink-0" />}
                    <span className="min-w-0 flex-1 truncate">{dorm.name}</span>
                    {occ && (
                      <span className="shrink-0 text-[10px] font-normal text-muted-foreground">
                        {occ.total - occ.occupied}/{occ.total}
                      </span>
                    )}
                  </button>
                  {!dorm.collapsed && dorm.beds.map((bed, bedIdx) => {
                    const bedBg = bed.isBlocked
                      ? "bg-gray-100 text-gray-400 dark:bg-gray-800/50"
                      : bedIdx % 2 === 0
                        ? "bg-white text-foreground dark:bg-card"
                        : "bg-brand-sand text-foreground dark:bg-zinc-800";
                    return (
                    <div
                      key={bed.id}
                      className={cn("flex h-8 items-center border-b border-border px-2 text-[11px]", bedBg)}
                    >
                      <span className="truncate">{bed.bedId}</span>
                    </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Right side: date grid with spanning tiles */}
          <div className="flex-1" style={{ minWidth: gridWidth }}>
            {/* Date header row */}
            <div className="sticky top-0 z-20 flex h-[52px] border-b border-border bg-brand-sand shadow-[0_1px_4px_rgba(45,92,63,0.08)] dark:bg-zinc-800 dark:shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
              {dates.map((date) => {
                const weekend = isWeekend(date);
                const todayCol = isToday(date);
                return (
                <div
                  key={date}
                  className={cn(
                    "flex shrink-0 flex-col items-center justify-end pb-1",
                    todayCol && "bg-brand-green/[0.09] dark:bg-brand-green/20",
                    weekend && !todayCol && "bg-amber-50/90 dark:bg-amber-950/25",
                  )}
                  style={{ width: colWidth }}
                >
                  <span className={cn(
                    "text-[10px] font-medium",
                    weekend && !todayCol ? "text-amber-700/70 dark:text-amber-400/70" : "text-muted-foreground",
                  )}>
                    {new Date(date + "T12:00:00Z").toLocaleDateString("en", { weekday: "short", timeZone: "UTC" })}
                  </span>
                  <span className={cn(
                    "text-xs font-semibold",
                    todayCol ? "text-brand-green" : weekend ? "text-amber-800 dark:text-amber-300" : "text-foreground",
                  )}>
                    {isCompact ? formatDateCompact(date) : formatDateShort(date)}
                  </span>
                </div>
                );
              })}
            </div>

            {/* Dorm/Bed rows with tiles */}
            {dorms.map((dorm, dormIdx) => {
              const dormBg = dormIdx % 2 === 0
                ? "bg-emerald-50 dark:bg-emerald-950/30"
                : "bg-sky-50 dark:bg-sky-950/25";
              return (
              <div key={dorm.id}>
                {/* Dorm summary row */}
                <div className={cn("flex h-8 border-b border-border", dormBg)}>
                  {dates.map((date) => (
                    <div
                      key={date}
                      className={cn(
                        "shrink-0 border-r border-border",
                        isToday(date) && "bg-brand-green/[0.09] dark:bg-brand-green/20",
                        isWeekend(date) && !isToday(date) && "bg-amber-50/90 dark:bg-amber-950/25",
                      )}
                      style={{ width: colWidth }}
                    />
                  ))}
                </div>

                {/* Bed rows */}
                {!dorm.collapsed && dorm.beds.map((bed, bedIdx) => {
                  const placements = computeTilePlacements(bed.id, assignments, bookingMap, dates, multiBedBookings);
                  const bedRowBg = bed.isBlocked
                    ? ""
                    : bedIdx % 2 === 0
                      ? "bg-white dark:bg-card"
                      : "bg-brand-sand dark:bg-zinc-800";

                  return (
                    <div key={bed.id} className={cn("relative h-8 border-b border-border", bedRowBg)}>
                      {/* Grid lines (background) */}
                      <div className="absolute inset-0 flex">
                        {dates.map((date) => (
                          <div
                            key={date}
                            className={cn(
                              "shrink-0 border-r border-border",
                              isToday(date) && "bg-brand-green/[0.09] dark:bg-brand-green/20",
                              isWeekend(date) && !isToday(date) && "bg-amber-50/90 dark:bg-amber-950/25",
                              bed.isBlocked && "bg-gray-100 dark:bg-gray-800/50",
                            )}
                            style={{ width: colWidth }}
                          />
                        ))}
                      </div>

                      {/* Blocked indicator */}
                      {bed.isBlocked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <BanIcon className="size-3 text-gray-400" />
                        </div>
                      )}

                      {/* Booking tiles (positioned absolutely over the grid) */}
                      {!bed.isBlocked && placements.map((p) => (
                        <div
                          key={`${p.booking.id}-${p.startCol}`}
                          className="absolute top-0.5 bottom-0.5 z-10"
                          style={{
                            left: p.startCol * colWidth + 2,
                            width: p.spanCols * colWidth - 4,
                          }}
                        >
                          <BookingTile
                            booking={p.booking}
                            isMultiBed={p.isMultiBed}
                            isSelected={selectedBookingId === p.booking.id}
                            onClick={() => onSelectBooking(p.booking.id)}
                          />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              );
            })}
          </div>
      </div>
    </div>
  );
}
