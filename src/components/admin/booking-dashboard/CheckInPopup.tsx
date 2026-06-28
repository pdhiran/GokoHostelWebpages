"use client";

import { motion, AnimatePresence } from "framer-motion";
import { overlayVariants, modalVariants } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import { CreditCardIcon, ClockIcon } from "lucide-react";
import { formatCurrency } from "./utils";
import type { DashboardBooking } from "./types";

export function CheckInPopup({
  booking,
  onConfirm,
  onCancel,
}: {
  booking: DashboardBooking;
  onConfirm: (collectPayment: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const balance = booking.balance;
  const hasBalance = balance > 0;

  return (
    <AnimatePresence>
      <motion.div
        key="checkin-overlay"
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm"
        onClick={onCancel}
      />
      <motion.div
        key="checkin-modal"
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed left-1/2 top-1/2 z-[60] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-popover p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-heading text-base font-medium text-foreground">Check In Guest</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {booking.guestName}
        </p>

        {hasBalance ? (
          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-center dark:border-orange-800 dark:bg-orange-900/20">
            <p className="text-xs text-orange-600 dark:text-orange-400">Balance Due</p>
            <p className="mt-1 text-2xl font-bold text-orange-700 dark:text-orange-300">
              {formatCurrency(balance)}
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-900/20">
            <p className="text-sm font-medium text-green-700 dark:text-green-300">Fully Paid</p>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {hasBalance && (
            <Button
              className="flex-1"
              size="sm"
              onClick={() => onConfirm(true)}
            >
              <CreditCardIcon className="size-3.5" />
              Collected
            </Button>
          )}
          <Button
            className="flex-1"
            size="sm"
            variant={hasBalance ? "outline" : "default"}
            onClick={() => onConfirm(false)}
          >
            {hasBalance ? (
              <>
                <ClockIcon className="size-3.5" />
                Later
              </>
            ) : (
              "Check In"
            )}
          </Button>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
