"use client";

import { useEffect, useRef, useId } from "react";

// Global stack of active panel IDs — only the topmost panel handles back
const panelStack: string[] = [];

/**
 * Pushes a browser history entry when a panel/modal opens, so that
 * pressing back closes the panel instead of navigating away.
 *
 * Uses a global LIFO stack to ensure that when multiple panels are
 * open, only the topmost one responds to the back button.
 *
 * @param isOpen - whether the panel is currently open
 * @param onClose - called when back is pressed while panel is open
 */
export function usePanelHistory(isOpen: boolean, onClose: () => void) {
  const panelId = useId();
  const hasPushed = useRef(false);
  const closingViaPopstate = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // When panel opens, push a history entry and register on the stack
  useEffect(() => {
    if (isOpen && !hasPushed.current) {
      hasPushed.current = true;
      panelStack.push(panelId);
      history.pushState({ panelId }, "");
    }
  }, [isOpen, panelId]);

  // When panel closes programmatically (X button, backdrop click),
  // remove our history entry so back behaves naturally
  useEffect(() => {
    if (!isOpen && hasPushed.current && !closingViaPopstate.current) {
      hasPushed.current = false;
      const idx = panelStack.indexOf(panelId);
      if (idx !== -1) panelStack.splice(idx, 1);
      history.back();
    } else if (!isOpen) {
      hasPushed.current = false;
      closingViaPopstate.current = false;
    }
  }, [isOpen, panelId]);

  // On unmount, clean up stack entry (don't call history.back to avoid
  // conflicting with concurrent navigations like tab changes)
  useEffect(() => {
    return () => {
      if (hasPushed.current) {
        hasPushed.current = false;
        const idx = panelStack.indexOf(panelId);
        if (idx !== -1) panelStack.splice(idx, 1);
      }
    };
  }, [panelId]);

  // Listen for back button — only respond if we're the topmost panel
  useEffect(() => {
    const handlePopState = () => {
      if (!hasPushed.current) return;
      if (panelStack[panelStack.length - 1] !== panelId) return;

      closingViaPopstate.current = true;
      hasPushed.current = false;
      panelStack.pop();
      onCloseRef.current();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [panelId]);
}
