"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlusIcon, TableIcon, CalendarIcon, AlertCircleIcon, RefreshCwIcon, Loader2Icon } from "lucide-react";
import { BookingCalendarGrid } from "./BookingCalendarGrid";
import { BookingTableView } from "./BookingTableView";
import { BookingSearchBar } from "./BookingSearchBar";
import { BookingDetailPanel } from "./BookingDetailPanel";
import { CreateBookingModal } from "./CreateBookingModal";
import { UnassignedBookings } from "./UnassignedBookings";
import { DateRangeSelector } from "./DateRangeSelector";
import { getDateRange, getHostelToday } from "./utils";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminLoading } from "../AdminLoading";
import type { DashboardBooking, BedAssignment, DateRange, CalendarDorm } from "./types";
import type { Role } from "../types";
import { hasPermission } from "../types";

function useBookingApi(password: string, username?: string) {
  const apiCall = useCallback(
    async (body: Record<string, unknown>) => {
      const payload: Record<string, unknown> = { password, ...body };
      if (username) payload.username = username;
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return res;
    },
    [password, username],
  );
  return { apiCall };
}


export function BookingDashboard({
  password,
  username,
  role,
  permissions = {},
}: {
  password: string;
  username?: string;
  role: Role;
  permissions?: Record<string, boolean>;
}) {
  const { apiCall } = useBookingApi(password, username);
  const { showError, showSuccess } = useAdminToast();

  const [view, setView] = useState<"calendar" | "table">("calendar");
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const { start, end } = getDateRange("10days");
    return { startDate: start, endDate: end, mode: "10days" };
  });
  const [bookings, setBookings] = useState<DashboardBooking[]>([]);
  const [assignments, setAssignments] = useState<BedAssignment[]>([]);
  const [dorms, setDorms] = useState<CalendarDorm[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const selectedBooking = useMemo(
    () => bookings.find((b) => b.id === selectedBookingId) ?? null,
    [bookings, selectedBookingId],
  );

  const unassignedBookings = useMemo(
    () => {
      const assignedIds = new Set(assignments.filter((a) => a.status === "assigned").map((a) => a.bookingId));
      return bookings.filter(
        (b) => !assignedIds.has(b.id) && b.status !== "cancelled" && b.status !== "no_show" && b.status !== "checked_out",
      );
    },
    [bookings, assignments],
  );

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await apiCall({
        action: "getCalendarData",
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings || []);
        setAssignments(data.assignments || []);
        setDorms(
          (data.dorms || []).map((d: CalendarDorm) => ({
            ...d,
            collapsed: dorms.find((existing) => existing.id === d.id)?.collapsed ?? false,
          })),
        );
      } else {
        const data = await res.json().catch(() => ({ error: "Failed to load data" }));
        showError(data.error || "Failed to load booking data");
      }
    } catch {
      showError("Network error loading booking data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiCall, dateRange.startDate, dateRange.endDate, showError, dorms]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.startDate, dateRange.endDate]);

  const handleDateRangeChange = useCallback((newRange: DateRange) => {
    setDateRange(newRange);
  }, []);

  const handleToggleDorm = useCallback((dormId: number) => {
    setDorms((prev) => prev.map((d) => (d.id === dormId ? { ...d, collapsed: !d.collapsed } : d)));
  }, []);

  const handleBookingAction = useCallback(
    async (action: string, bookingId: number, extra?: Record<string, unknown>) => {
      try {
        const res = await apiCall({ action, bookingId, ...extra });
        if (res.ok) {
          showSuccess("Action completed");
          await loadData(true);
        } else {
          const data = await res.json().catch(() => ({ error: "Action failed" }));
          showError(data.error || "Action failed");
        }
      } catch {
        showError("Network error");
      }
    },
    [apiCall, loadData, showError, showSuccess],
  );

  if (loading && bookings.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center">
        <AdminLoading message="Loading booking calendar..." />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-xl font-bold text-brand-green md:text-2xl">Booking Calendar</h2>
        <div className="flex flex-wrap items-center gap-2">
          <BookingSearchBar
            bookings={bookings}
            onSelect={(id) => setSelectedBookingId(id)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}
          >
            {refreshing ? <Loader2Icon className="size-3.5 animate-spin" /> : <RefreshCwIcon className="size-3.5" />}
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DateRangeSelector dateRange={dateRange} onChange={handleDateRangeChange} />
        <div className="flex items-center gap-2">
          {unassignedBookings.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUnassigned(!showUnassigned)}
              className="relative"
            >
              <AlertCircleIcon className="size-3.5" />
              Unassigned
              <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                {unassignedBookings.length}
              </span>
            </Button>
          )}
          <div className="flex rounded-lg border border-input">
            <button
              onClick={() => setView("calendar")}
              className={cn(
                "flex items-center gap-1 rounded-l-lg px-3 py-1.5 text-xs font-medium transition-colors",
                view === "calendar"
                  ? "bg-brand-green text-white"
                  : "bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              <CalendarIcon className="size-3.5" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
            <button
              onClick={() => setView("table")}
              className={cn(
                "flex items-center gap-1 rounded-r-lg px-3 py-1.5 text-xs font-medium transition-colors",
                view === "table"
                  ? "bg-brand-green text-white"
                  : "bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              <TableIcon className="size-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>
          {hasPermission(role, permissions, "canCreateBooking") && (
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              <PlusIcon className="size-3.5" />
              <span className="hidden sm:inline">New Booking</span>
            </Button>
          )}
        </div>
      </div>

      {/* Unassigned panel */}
      {showUnassigned && (
        <div className="shrink-0">
          <UnassignedBookings
            bookings={unassignedBookings}
            dorms={dorms}
            dateRange={dateRange}
            onAssign={async (bookingId, bedIds) => {
              await handleBookingAction("assignBeds", bookingId, { bedIds });
            }}
            onClose={() => setShowUnassigned(false)}
            password={password}
            username={username}
          />
        </div>
      )}

      {/* Main content */}
      {view === "calendar" ? (
        <BookingCalendarGrid
          bookings={bookings}
          assignments={assignments}
          dorms={dorms}
          dateRange={dateRange}
          today={getHostelToday()}
          onSelectBooking={setSelectedBookingId}
          selectedBookingId={selectedBookingId}
          onToggleDorm={handleToggleDorm}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <BookingTableView
            bookings={bookings}
            assignments={assignments}
            onSelectBooking={setSelectedBookingId}
            selectedBookingId={selectedBookingId}
          />
        </div>
      )}

      {/* Detail panel */}
      {selectedBooking && (
        <BookingDetailPanel
          booking={selectedBooking}
          assignments={assignments.filter((a) => a.bookingId === selectedBooking.id)}
          onClose={() => setSelectedBookingId(null)}
          onAction={handleBookingAction}
          role={role}
          permissions={permissions}
          password={password}
          username={username}
        />
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CreateBookingModal
          dorms={dorms}
          dateRange={dateRange}
          onClose={() => setShowCreateModal(false)}
          onCreated={async () => {
            setShowCreateModal(false);
            await loadData(true);
          }}
          password={password}
          username={username}
        />
      )}
    </div>
  );
}
