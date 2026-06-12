"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  CloudIcon,
  CpuIcon,
  RefreshCwIcon,
  WifiIcon,
  WifiOffIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  Loader2Icon,
} from "lucide-react";
import type { Role } from "./types";

type BarStatus = {
  runtime: "pi" | "cloudflare";
  internetConnected: boolean;
  piOnline: boolean;
  lastSync: string | null;
  pendingChanges: number;
  buildsMatch: boolean;
  syncFailed: boolean;
  piUnreachableSince: string | null;
};

const MOCK_BAR_STATUS: BarStatus = {
  runtime: (process.env.NEXT_PUBLIC_GOKO_RUNTIME as "pi" | "cloudflare") || "cloudflare",
  internetConnected: true,
  piOnline: true,
  lastSync: new Date(Date.now() - 300000).toISOString(),
  pendingChanges: 23,
  buildsMatch: true,
  syncFailed: false,
  piUnreachableSince: null,
};

function timeAgo(isoString: string | null): string {
  if (!isoString) return "never";
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function SyncStatusBar({ password, username, role, onNavigateToSync }: { password: string; username?: string; role: Role; onNavigateToSync: () => void }) {
  const passwordRef = useRef(password);
  passwordRef.current = password;

  const [status, setStatus] = useState<BarStatus>(MOCK_BAR_STATUS);
  const [syncing, setSyncing] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordRef.current, action: "status" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.barStatus) setStatus(data.barStatus);
      }
    } catch {
      // API not available, keep mock data
    }
  }, []);

  useEffect(() => {
    if (role !== "admin") return;
    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, [role, loadStatus]);

  const handleQuickSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncing(true);
    try {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordRef.current, action: "sync", mode: "full" }),
      });
      await loadStatus();
    } catch {
      // ignore
    } finally {
      setSyncing(false);
    }
  };

  if (role !== "admin") return null;

  const piUnreachable24h = status.piUnreachableSince
    ? Date.now() - new Date(status.piUnreachableSince).getTime() > 86400000
    : false;

  const severity: "green" | "yellow" | "red" =
    status.syncFailed || piUnreachable24h ? "red" :
    status.pendingChanges > 0 || !status.piOnline ? "yellow" : "green";

  const bgClass = {
    green: "bg-emerald-50 border-emerald-200",
    yellow: "bg-amber-50 border-amber-200",
    red: "bg-red-50 border-red-200",
  }[severity];

  const isPi = status.runtime === "pi";

  return (
    <button
      type="button"
      onClick={onNavigateToSync}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors hover:opacity-80",
        bgClass
      )}
    >
      {isPi ? (
        <>
          <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 font-semibold text-purple-700">
            <CpuIcon className="h-3 w-3" /> Pi Mode
          </span>
          <span className="hidden items-center gap-1 sm:flex">
            {status.internetConnected
              ? <><WifiIcon className="h-3 w-3 text-emerald-500" /> <span className="text-emerald-700">Connected</span></>
              : <><WifiOffIcon className="h-3 w-3 text-red-500" /> <span className="text-red-700">Offline</span></>}
          </span>
          <span className="text-brand-green-dark/50">|</span>
          <span className="text-brand-green-dark/70">Last sync: {timeAgo(status.lastSync)}</span>
          {status.pendingChanges > 0 && (
            <>
              <span className="text-brand-green-dark/50">|</span>
              <span className="font-medium text-amber-700">{status.pendingChanges} pending</span>
            </>
          )}
          <span className="ml-auto flex items-center gap-1" onClick={handleQuickSync}>
            {syncing
              ? <Loader2Icon className="h-3 w-3 animate-spin text-brand-green" />
              : <RefreshCwIcon className="h-3 w-3 text-brand-green" />}
            <span className="font-medium text-brand-green">Sync</span>
          </span>
        </>
      ) : (
        <>
          <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">
            <CloudIcon className="h-3 w-3" /> Cloud
          </span>
          <span className="hidden items-center gap-1 sm:flex">
            Pi:
            {status.piOnline
              ? <span className="text-emerald-600">● Online</span>
              : <span className="text-red-600">● Offline</span>}
            {status.piOnline && status.lastSync && (
              <span className="text-brand-green-dark/60">(synced {timeAgo(status.lastSync)})</span>
            )}
          </span>
          {status.buildsMatch && (
            <>
              <span className="text-brand-green-dark/50">|</span>
              <span className="flex items-center gap-1 text-emerald-700">
                Builds match <CheckCircleIcon className="h-3 w-3" />
              </span>
            </>
          )}
          {!status.buildsMatch && (
            <>
              <span className="text-brand-green-dark/50">|</span>
              <span className="flex items-center gap-1 text-amber-700">
                Build mismatch <AlertTriangleIcon className="h-3 w-3" />
              </span>
            </>
          )}
        </>
      )}
    </button>
  );
}
