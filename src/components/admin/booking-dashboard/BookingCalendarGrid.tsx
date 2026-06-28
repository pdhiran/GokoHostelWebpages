"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronRightIcon, BanIcon } from "lucide-react";
import { BookingTile } from "./BookingTile";
import { getDatesArray, formatDateShort, formatDateCompact, isToday } from "./utils";
import type { DashboardBooking, BedAssignment, CalendarDorm, DateRange } from "./types";

type GridCell = {
  booking: DashboardBooking | null;
  isStart: boolean;
  isEnd: boolean;
  spanDays: number;
  isBlocked: boolean;
};

function buildGridData(
  dorms: CalendarDorm[],
  bookings: DashboardBooking[],
  assignments: BedAssignment[],
  dates: string[],
) {
  const grid = new Map<string, GridCell>();
  const bookingMap = new Map<number, DashboardBooking>();
  bookings.forEach((b) => bookingMap.set(b.id, b));

  const bedAssignmentMap = new Map<number, BedAssignment[]>();
  assignments
    .filter((a) => a.status === "assigned")
    .forEach((a) => {
      const list = bedAssignmentMap.get(a.bedId) || [];
      list.push(a);
      bedAssignmentMap.set(a.bedId, list);
    });

  const multiBedBookings = new Set<number>();
  const bookingBedCount = new Map<number, number>();
  assignments.filter((a) => a.status === "assigned").forEach((a) => {
    bookingBedCount.set(a.bookingId, (bookingBedCount.get(a.bookingId) || 0) + 1);
  });
  bookingBedCount.forEach((count, bId) => {
    if (count > 1) multiBedBookings.add(bId);
  });

  for (const dorm of dorms) {
    for (const bed of dorm.beds) {
      const bedAssigns = bedAssignmentMap.get(bed.id) || [];
      for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const key = `${bed.id}-${date}`;

        if (bed.isBlocked) {
          grid.set(key, { booking: null, isStart: false, isEnd: false, spanDays: 1, isBlocked: true });
          continue;
        }

        const assignment = bedAssigns.find((a) => {
          return date >= a.checkinDate && date < a.checkoutDate;
        });

        if (assignment) {
          const booking = bookingMap.get(assignment.bookingId) || null;
          const isStart = date === assignment.checkinDate;
          const isEnd = i + 1 < dates.length && dates[i + 1] === assignment.checkoutDate;

          let spanDays = 1;
          if (isStart && booking) {
            const endIdx = dates.indexOf(assignment.checkoutDate);
            spanDays = endIdx >= 0 ? endIdx - i : dates.length - i;
          }

          grid.set(key, { booking, isStart, isEnd, spanDays, isBlocked: false });
        } else {
          const checkoutAssign = bedAssigns.find((a) => date === a.checkoutDate);
          if (checkoutAssign) {
            const booking = bookingMap.get(checkoutAssign.bookingId) || null;
            grid.set(key, { booking, isStart: false, isEnd: true, spanDays: 1, isBlocked: false });
          } else {
            grid.set(key, { booking: null, isStart: false, isEnd: false, spanDays: 1, isBlocked: false });
          }
        }
      }
    }
  }

  return { grid, multiBedBookings };
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

  const { grid, multiBedBookings } = useMemo(
    () => buildGridData(dorms, bookings, assignments, dates),
    [dorms, bookings, assignments, dates],
  );

  const dormOccupancy = useMemo(() => {
    const occ = new Map<number, { total: number; occupied: number }>();
    for (const dorm of dorms) {
      const total = dorm.beds.filter((b) => !b.isBlocked).length;
      const occupied = new Set<number>();
      for (const bed of dorm.beds) {
        if (bed.isBlocked) continue;
        const key = `${bed.id}-${today}`;
        const cell = grid.get(key);
        if (cell?.booking) occupied.add(bed.id);
      }
      occ.set(dorm.id, { total, occupied: occupied.size });
    }
    return occ;
  }, [dorms, grid, today]);

  const colWidth = isCompact ? "w-[50px]" : "w-[80px]";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white dark:bg-card">
      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full">
          {/* Sticky left column */}
          <div className="sticky left-0 z-20 w-[140px] shrink-0 border-r border-border bg-white dark:bg-card">
            {/* Header cell */}
            <div className="flex h-[52px] items-end border-b border-border px-2 pb-1">
              <span className="text-[10px] font-medium text-muted-foreground">Dorms / Beds</span>
            </div>
            {dorms.map((dorm) => {
              const occ = dormOccupancy.get(dorm.id);
              return (
                <div key={dorm.id}>
                  {/* Dorm header */}
                  <button
                    type="button"
                    onClick={() => onToggleDorm(dorm.id)}
                    className="flex h-8 w-full items-center gap-1 border-b border-border bg-muted/50 px-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    {dorm.collapsed ? (
                      <ChevronRightIcon className="size-3.5 shrink-0" />
                    ) : (
                      <ChevronDownIcon className="size-3.5 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{dorm.name}</span>
                    {occ && (
                      <span className="shrink-0 text-[10px] font-normal text-muted-foreground">
                        {occ.total - occ.occupied}/{occ.total}
                      </span>
                    )}
                  </button>
                  {/* Bed rows */}
                  {!dorm.collapsed &&
                    dorm.beds.map((bed) => (
                      <div
                        key={bed.id}
                        className={cn(
                          "flex h-8 items-center border-b border-border px-2 text-[11px]",
                          bed.isBlocked
                            ? "bg-gray-100 text-gray-400 dark:bg-gray-800/50 dark:text-gray-500"
                            : "text-foreground",
                        )}
                      >
                        <span className="truncate">{bed.bedId}</span>
                      </div>
                    ))}
                </div>
              );
            })}
          </div>

          {/* Date columns */}
          <div className="flex">
            {dates.map((date) => (
              <div key={date} className={cn("shrink-0", colWidth)}>
                {/* Date header */}
                <div
                  className={cn(
                    "flex h-[52px] flex-col items-center justify-end border-b border-r border-border px-0.5 pb-1",
                    isToday(date) && "bg-brand-green/5 dark:bg-brand-green/10",
                  )}
                >
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {new Date(date + "T12:00:00Z").toLocaleDateString("en", { weekday: "short", timeZone: "UTC" })}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      isToday(date) ? "text-brand-green" : "text-foreground",
                    )}
                  >
                    {isCompact ? formatDateCompact(date) : formatDateShort(date)}
                  </span>
                </div>

                {/* Cells per dorm/bed */}
                {dorms.map((dorm) => (
                  <div key={dorm.id}>
                    {/* Dorm summary row */}
                    <div className="h-8 border-b border-r border-border bg-muted/50" />
                    {/* Bed cells */}
                    {!dorm.collapsed &&
                      dorm.beds.map((bed) => {
                        const key = `${bed.id}-${date}`;
                        const cell = grid.get(key);

                        return (
                          <div
                            key={bed.id}
                            className={cn(
                              "relative h-8 border-b border-r border-border",
                              isToday(date) && "bg-brand-green/[0.03] dark:bg-brand-green/[0.06]",
                              cell?.isBlocked && "bg-gray-100 dark:bg-gray-800/50",
                            )}
                          >
                            {cell?.isBlocked ? (
                              <div className="flex h-full items-center justify-center">
                                <BanIcon className="size-3 text-gray-400 dark:text-gray-600" />
                              </div>
                            ) : cell?.booking && cell.isStart ? (
                              <div
                                className="absolute inset-y-0.5 left-0 z-10"
                                style={{
                                  width: `calc(${Math.min(cell.spanDays, dates.length - dates.indexOf(date))} * 100%)`,
                                }}
                              >
                                <BookingTile
                                  booking={cell.booking}
                                  isMultiBed={multiBedBookings.has(cell.booking.id)}
                                  isSelected={selectedBookingId === cell.booking.id}
                                  onClick={() => onSelectBooking(cell.booking!.id)}
                                />
                              </div>
                            ) : cell?.booking && cell.isEnd ? (
                              <div className="absolute inset-y-0.5 left-0 z-10 w-[20%]">
                                <BookingTile
                                  booking={cell.booking}
                                  isMultiBed={multiBedBookings.has(cell.booking.id)}
                                  isSelected={selectedBookingId === cell.booking.id}
                                  onClick={() => onSelectBooking(cell.booking!.id)}
                                  isCheckoutDay
                                />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
