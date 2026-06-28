"use client";

import { cn } from "@/lib/utils";
import { UsersIcon } from "lucide-react";
import { STATUS_COLORS, PLATFORM_LOGOS } from "./utils";
import type { DashboardBooking } from "./types";

export function BookingTile({
  booking,
  isMultiBed,
  isSelected,
  onClick,
}: {
  booking: DashboardBooking;
  isMultiBed: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const statusColor = STATUS_COLORS[booking.status] ?? STATUS_COLORS.received;
  const platform = PLATFORM_LOGOS[booking.platform];

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${booking.guestName} - ${booking.platform} (${booking.checkinDate} to ${booking.checkoutDate})`}
      className={cn(
        "group flex h-full w-full items-center gap-1 overflow-hidden rounded-md px-1.5 text-left text-[11px] leading-tight transition-all",
        statusColor.bg,
        statusColor.text,
        statusColor.border,
        "border",
        isSelected && "ring-2 ring-brand-green ring-offset-1 dark:ring-offset-gray-900",
        "hover:brightness-95 dark:hover:brightness-110 cursor-pointer",
      )}
    >
      {platform && (
        <span
          className={cn(
            "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white",
            platform.color,
          )}
        >
          {platform.abbr}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate font-medium">
        {booking.guestName}
      </span>
      {isMultiBed && (
        <UsersIcon className="size-3 shrink-0 opacity-60" />
      )}
    </button>
  );
}
