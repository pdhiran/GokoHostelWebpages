"use client";

import { useState, useEffect } from "react";
import { useAdminApi } from "./useAdminApi";
import { AdminLoading } from "./AdminLoading";
import { Button } from "@/components/ui/button";
import { DownloadIcon, AlertCircleIcon, AlertTriangleIcon, InfoIcon, CopyIcon, CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "./types";

type LogEntryData = {
  id: number;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  details: string;
};

export function ManagementLogs({ password, username, role }: { password: string; username?: string; role: Role }) {
  const { apiCall } = useAdminApi(password, username);
  const [logs, setLogs] = useState<LogEntryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [configuredLevel, setConfiguredLevel] = useState("error");
  const [savingLevel, setSavingLevel] = useState(false);

  useEffect(() => { loadLogs(); loadLogLevel(); }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await apiCall({ action: "getSystemLogs" });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } finally { setLoading(false); }
  };

  const loadLogLevel = async () => {
    const res = await apiCall({ action: "getSetting", key: "log_level" });
    if (res.ok) { const d = await res.json(); setConfiguredLevel(d.value || "error"); }
  };

  const changeLogLevel = async (level: string) => {
    setSavingLevel(true);
    try {
      await apiCall({ action: "setSetting", key: "log_level", value: level });
      setConfiguredLevel(level);
    } finally { setSavingLevel(false); }
  };

  const filtered = logs.filter((l) => {
    if (filterLevel && l.level !== filterLevel) return false;
    if (filterSource && l.source !== filterSource) return false;
    return true;
  });

  const allSources = [...new Set(logs.map((l) => l.source).filter(Boolean))];

  const downloadLogs = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `system-logs-${new Date().toISOString().split("T")[0]}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const levelIcon = (level: string) => {
    if (level === "error") return <AlertCircleIcon className="h-3.5 w-3.5 text-red-500" />;
    if (level === "warn") return <AlertTriangleIcon className="h-3.5 w-3.5 text-yellow-500" />;
    return <InfoIcon className="h-3.5 w-3.5 text-blue-500" />;
  };

  if (loading) return <AdminLoading message="Loading logs..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-brand-green-dark">System Logs</h3>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ctaOutline" onClick={downloadLogs} disabled={filtered.length === 0}>
            <DownloadIcon className="mr-1 h-4 w-4" /> Download
          </Button>
          <Button type="button" variant="ctaOutline" onClick={loadLogs}>Refresh</Button>
        </div>
      </div>

      {/* Log level config */}
      {role === "admin" && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center rounded-xl border border-brand-mist bg-white dark:bg-card p-3">
          <span className="text-xs font-medium text-brand-green-dark/60">Logging level:</span>
          <select
            value={configuredLevel}
            onChange={(e) => changeLogLevel(e.target.value)}
            disabled={savingLevel}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            <option value="error">Error only (default)</option>
            <option value="warn">Warn + Error</option>
            <option value="info">Info + Warn + Error</option>
            <option value="debug">Debug (all)</option>
          </select>
          <span className="text-[10px] text-brand-green-dark/40">Higher levels = more logs = more storage used</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-xs">
          <option value="">All levels</option>
          <option value="error">Error</option>
          <option value="warn">Warning</option>
          <option value="info">Info</option>
        </select>
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-xs">
          <option value="">All sources</option>
          {allSources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="ml-auto self-center text-xs text-brand-green-dark/50">{filtered.length} logs</span>
      </div>

      {/* Log entries */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-brand-green-dark/50">No logs recorded yet. Logs appear when errors or important events occur.</p>
        ) : (
          filtered.slice(0, 100).map((l) => (
            <LogEntryCard key={l.id} log={l} levelIcon={levelIcon} />
          ))
        )}
      </div>
    </div>
  );
}

function LogEntryCard({ log, levelIcon }: { log: LogEntryData; levelIcon: (level: string) => React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const copyLog = () => {
    const text = [
      `[${log.level.toUpperCase()}] ${log.message}`,
      `Source: ${log.source || "unknown"}`,
      `Time: ${new Date(log.timestamp).toLocaleString()}`,
      log.details ? `\nDetails:\n${log.details}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={cn(
      "rounded-xl border p-3 overflow-hidden",
      log.level === "error" && "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/50",
      log.level === "warn" && "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/50",
      log.level === "info" && "border-blue-100 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/30",
    )}>
      <div className="flex items-start gap-2">
        {levelIcon(log.level)}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-brand-green-dark break-all">{log.message}</span>
                {log.source && <span className="shrink-0 rounded bg-brand-sand px-1.5 py-0.5 text-[9px] font-medium text-brand-green-dark/50">{log.source}</span>}
              </div>
              <p className="mt-0.5 text-[10px] text-brand-green-dark/40">{new Date(log.timestamp).toLocaleString()}</p>
            </div>
            <button
              onClick={copyLog}
              className="shrink-0 rounded-md p-1 text-brand-green-dark/40 hover:bg-brand-sand hover:text-brand-green-dark transition-colors"
              title="Copy log entry"
            >
              {copied ? <CheckIcon className="h-3.5 w-3.5 text-green-500" /> : <CopyIcon className="h-3.5 w-3.5" />}
            </button>
          </div>
          {log.details && (
            <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-brand-sand/50 p-2 text-[10px] text-brand-green-dark/60">{log.details}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
