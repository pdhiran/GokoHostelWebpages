"use client";

import { motion, AnimatePresence } from "framer-motion";
import { overlayVariants, modalVariants } from "@/lib/animations";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="confirm-overlay"
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/30 p-4 backdrop-blur-sm"
        onClick={onCancel}
      >
        <motion.div
          key="confirm-modal"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="w-full min-w-0 max-w-sm rounded-2xl border border-border bg-popover p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="font-heading text-base font-medium break-words text-foreground">{title}</h3>
          <p className="mt-2 break-words text-sm text-muted-foreground">{description}</p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" className="min-w-0" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              variant={variant === "destructive" ? "destructive" : "default"}
              size="sm"
              className="min-w-0"
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
