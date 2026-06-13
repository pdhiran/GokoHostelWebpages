"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Pushes a browser history entry when a panel/modal opens, so that
 * pressing back closes the panel instead of navigating away.
 *
 * @param isOpen - whether the panel is currently open
 * @param onClose - called when back is pressed while panel is open
 */
export function usePanelHistory(isOpen: boolean, onClose: () => void) {
  const hasPushed = useRef(false);
  const closingViaPopstate = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // When panel opens, push a history entry
  useEffect(() => {
    if (isOpen && !hasPushed.current) {
      hasPushed.current = true;
      history.pushState({ panel: true }, "");
    }
  }, [isOpen]);

  // When panel closes programmatically (not via back), remove our history entry
  useEffect(() => {
    if (!isOpen && hasPushed.current && !closingViaPopstate.current) {
      hasPushed.current = false;
      history.back();
    } else if (!isOpen) {
      hasPushed.current = false;
      closingViaPopstate.current = false;
    }
  }, [isOpen]);

  // Listen for back button — close the panel
  useEffect(() => {
    const handlePopState = () => {
      if (hasPushed.current) {
        closingViaPopstate.current = true;
        hasPushed.current = false;
        onCloseRef.current();
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
}
