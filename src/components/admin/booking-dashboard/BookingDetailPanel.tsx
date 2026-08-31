"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  XIcon,
  PhoneIcon,
  MailIcon,
  BedDoubleIcon,
  ClockIcon,
  CreditCardIcon,
  UserIcon,
  FileTextIcon,
  HistoryIcon,
  Loader2Icon,
  LogInIcon,
  LogOutIcon,
  BanIcon,
  EditIcon,
} from "lucide-react";
import { STATUS_COLORS, platformLogo, STATUS_LABELS, formatCurrency, getNights, collectionCopy, displayedStayPayment } from "./utils";
import { parseGokoWalkin, walkinDiscountOnGross } from "@/lib/bookingPricing";
import { CheckInPopup } from "./CheckInPopup";
import { ConfirmDialog } from "./ConfirmDialog";
import { useAdminToast } from "@/components/admin/AdminToast";
import { hasPermission, type Role } from "../types";
import type { DashboardBooking, BedAssignment, BookingHistoryEntry } from "./types";

export function BookingDetailPanel({
  booking,
  assignments,
  onClose,
  onAction,
  role,
  permissions,
  password,
  username,
}: {
  booking: DashboardBooking;
  assignments: BedAssignment[];
  onClose: () => void;
  onAction: (action: string, bookingId: number, extra?: Record<string, unknown>) => Promise<boolean | void>;
  role: Role;
  permissions: Record<string, boolean>;
  password: string;
  username?: string;
}) {
  const { showError } = useAdminToast();
  const [history, setHistory] = useState<BookingHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showCheckinPopup, setShowCheckinPopup] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    action: string;
    title: string;
    description: string;
    variant: "default" | "destructive";
  } | null>(null);

  const statusColor = STATUS_COLORS[booking.status] ?? STATUS_COLORS.received;
  const platform = platformLogo(booking.platform);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const payload: Record<string, unknown> = { password, action: "getBookingHistory", bookingId: booking.id };
      if (username) payload.username = username;
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch {
      // silently fail for history
    } finally {
      setLoadingHistory(false);
    }
  }, [password, username, booking.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleAction = async (action: string, extra?: Record<string, unknown>) => {
    setBusy(true);
    try {
      await onAction(action, booking.id, extra);
    } finally {
      setBusy(false);
    }
  };

  const nights = getNights(booking.checkinDate, booking.checkoutDate);
  const walkin = parseGokoWalkin(booking.rawData);
  const gross = booking.nightlyRate * nights * Math.max(1, booking.persons);
  const discount = walkin
    ? walkinDiscountOnGross(gross, walkin)
    : (booking.source === "manual" ? Math.max(0, gross - booking.amountBeforeTax) : 0);
  const collection = collectionCopy(booking.paymentStatus, booking.balance);
  const dueAtHotel = collection ? collection.due : booking.balance > 0;
  const shownPay = displayedStayPayment(booking.paymentStatus, booking.amountTotal, booking.amountPaid);
  const hasAssignedBed = assignments.some((a) => a.status === "assigned");
  const canCancelStay = hasAssignedBed
    ? hasPermission(role, permissions, "canDeleteBooking")
    : (role === "admin" || role === "manager");

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-popover shadow-xl sm:max-w-lg"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-foreground">{booking.guestName}</h3>
              <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium", statusColor.bg, statusColor.text)}>
                {STATUS_LABELS[booking.status] ?? booking.status}
              </span>
            </div>
            {platform && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("inline-flex size-4 items-center justify-center rounded-full text-[8px] font-bold text-white", platform.color)}>
                  {platform.abbr}
                </span>
                {platform.label}
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <XIcon className="size-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 p-4">
            {/* Booking Info */}
            <Section icon={FileTextIcon} title="Booking Info">
              <InfoRow label="CM Booking ID" value={booking.cmBookingId} />
              <InfoRow label="OTA Booking ID" value={booking.bookingRef} />
              <InfoRow
                label="Goko Booking ID"
                value={
                  booking.gokoBookingId
                  || (booking.source === "manual" ? `#${booking.id}` : "")
                }
              />
              <InfoRow label="Check-in" value={booking.checkinDate} />
              <InfoRow label="Check-out" value={booking.checkoutDate} />
              <InfoRow label="Nights" value={String(nights)} />
              <InfoRow label="Persons" value={String(booking.persons)} />
              <InfoRow label="Room Type" value={booking.roomType} />
              <InfoRow label="Rate Plan" value={booking.ratePlan} />
              <InfoRow label="Source" value={booking.source} />
              <InfoRow label="Booked On" value={booking.createdAt?.split("T")[0] || "-"} />
            </Section>

            {/* Assigned Beds */}
            <Section icon={BedDoubleIcon} title="Assigned Beds">
              {assignments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No beds assigned</p>
              ) : (
                <div className="space-y-1">
                  {assignments.map((a) => (
                    <div
                      key={a.id}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs",
                        a.status === "cancelled"
                          ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                          : "border-border bg-muted/30",
                      )}
                    >
                      <span className="font-medium">{a.dormName} - {a.bedLabel}</span>
                      <span className="text-muted-foreground">{a.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Payment */}
            <Section icon={CreditCardIcon} title="Payment">
              {collection && (
                <InfoRow
                  label={collection.label}
                  value={collection.value}
                  highlight
                  className={dueAtHotel ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}
                />
              )}
              <InfoRow label="Subtotal" value={formatCurrency(booking.amountBeforeTax + discount)} />
              {discount > 0 && (
                <InfoRow
                  label={walkin?.discountReason ? `Discount (${walkin.discountReason})` : "Discount"}
                  value={`-${formatCurrency(discount)}`}
                />
              )}
              <InfoRow
                label={walkin?.taxPercent != null ? `Tax (${walkin.taxPercent}%)` : "Tax"}
                value={formatCurrency(booking.amountTax)}
              />
              <InfoRow label="Total" value={formatCurrency(booking.amountTotal)} highlight />
              <InfoRow label="Paid" value={formatCurrency(shownPay.paid)} />
              <InfoRow
                label="Balance"
                value={formatCurrency(shownPay.balance)}
                highlight={dueAtHotel}
                className={dueAtHotel ? "text-red-600 dark:text-red-400" : ""}
              />
              <InfoRow label="Nightly Rate" value={formatCurrency(booking.nightlyRate)} />
              <InfoRow label="Currency" value={booking.currency} />
            </Section>

            {/* Guest Contact */}
            <Section icon={UserIcon} title="Guest Contact">
              <div className="space-y-1.5">
                {booking.contact && (
                  <div className="flex items-center gap-2 text-xs">
                    <PhoneIcon className="size-3 text-muted-foreground" />
                    <span className="text-foreground">{booking.contact}</span>
                  </div>
                )}
                {booking.email && (
                  <div className="flex items-center gap-2 text-xs">
                    <MailIcon className="size-3 text-muted-foreground" />
                    <span className="text-foreground">{booking.email}</span>
                  </div>
                )}
              </div>
            </Section>

            {/* Special Requests */}
            {booking.specialRequests && (
              <Section icon={EditIcon} title="Special Requests">
                <p className="whitespace-pre-wrap text-xs text-foreground">{booking.specialRequests}</p>
              </Section>
            )}

            {/* Status timestamps */}
            {(booking.checkedInAt || booking.checkedOutAt || booking.cancelledAt || booking.holdExpiresAt) && (
              <Section icon={ClockIcon} title="Timestamps">
                {booking.checkedInAt && <InfoRow label="Checked in" value={`${booking.checkedInAt} by ${booking.checkedInBy}`} />}
                {booking.checkedOutAt && <InfoRow label="Checked out" value={`${booking.checkedOutAt} by ${booking.checkedOutBy}`} />}
                {booking.cancelledAt && <InfoRow label="Cancelled" value={`${booking.cancelledAt} by ${booking.cancelledBy}`} />}
                {booking.holdExpiresAt && <InfoRow label="Hold expires" value={booking.holdExpiresAt} />}
              </Section>
            )}

            {/* History */}
            <Section icon={HistoryIcon} title="History">
              {loadingHistory ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2Icon className="size-3 animate-spin" />
                  Loading...
                </div>
              ) : history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No history</p>
              ) : (
                <div className="space-y-2">
                  {history.map((entry) => (
                    <div key={entry.id} className="border-l-2 border-border pl-3 text-xs">
                      <div className="font-medium text-foreground">{entry.action}</div>
                      {entry.details && <p className="text-muted-foreground">{entry.details}</p>}
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {entry.performedBy} - {entry.performedAt}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-border p-4">
          <div className="flex flex-wrap gap-2">
            {booking.status === "received" && (hasPermission(role, permissions, "canAddBooking") || hasPermission(role, permissions, "canCheckIn")) && (
              <Button
                size="sm"
                onClick={() => setShowCheckinPopup(true)}
                disabled={busy}
              >
                <LogInIcon className="size-3.5" />
                Check In
              </Button>
            )}
            {booking.status === "checked_in" && (hasPermission(role, permissions, "canAddBooking") || hasPermission(role, permissions, "canCheckOut")) && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setConfirmAction({
                  action: "checkOut",
                  title: "Check Out Guest",
                  description: `Check out ${booking.guestName}?`,
                  variant: "default",
                })}
                disabled={busy}
              >
                <LogOutIcon className="size-3.5" />
                Check Out
              </Button>
            )}
            {(booking.status === "received" || booking.status === "hold") &&
              canCancelStay && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setConfirmAction({
                    action: "cancelBooking",
                    title: "Cancel Booking",
                    description: `Cancel booking for ${booking.guestName}? This cannot be undone.`,
                    variant: "destructive",
                  })}
                  disabled={busy}
                >
                  <BanIcon className="size-3.5" />
                  Cancel
                </Button>
              )}
            {booking.status === "received" && hasPermission(role, permissions, "canDeleteBooking") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmAction({
                  action: "markNoShow",
                  title: "Mark No Show",
                  description: `Mark ${booking.guestName} as no-show?`,
                  variant: "default",
                })}
                disabled={busy}
              >
                No Show
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Check-in popup */}
      {showCheckinPopup && (
        <CheckInPopup
          booking={booking}
          onConfirm={async (collectPayment) => {
            setShowCheckinPopup(false);
            await handleAction("checkIn", { collectPayment });
          }}
          onCancel={() => setShowCheckinPopup(false)}
        />
      )}

      {/* Confirm dialog */}
      {confirmAction && (
        <ConfirmDialog
          open
          title={confirmAction.title}
          description={confirmAction.description}
          variant={confirmAction.variant}
          onConfirm={async () => {
            const action = confirmAction.action;
            setConfirmAction(null);
            await handleAction(action);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="size-3.5 text-muted-foreground" />
        <h4 className="text-xs font-semibold text-foreground">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function InfoRow({
  label,
  value,
  highlight,
  className,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  className?: string;
}) {
  if (!value || value === "-") {
    return (
      <div className="flex items-center justify-between py-0.5 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">-</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between py-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium text-foreground", highlight && "font-semibold", className)}>
        {value}
      </span>
    </div>
  );
}
