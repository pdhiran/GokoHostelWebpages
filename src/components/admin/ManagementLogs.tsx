"use client";

import { useState, useEffect } from "react";
import { useAdminApi, fetchWithRetry } from "./useAdminApi";
import { AdminLoading } from "./AdminLoading";
import { Button } from "@/components/ui/button";
import { DownloadIcon, AlertCircleIcon, AlertTriangleIcon, InfoIcon, CopyIcon, CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn, localDateStr } from "@/lib/utils";
import type { Role } from "./types";

type LogSubTab = "system" | "pms";

type LogEntryData = {
  id: number;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  details: string;
};

type PmsLogRow = {
  id: number;
  direction: string;
  type: string;
  status: string;
  requestPayload: string;
  responsePayload: string;
  errorMessage: string;
  recordsAffected: number | null;
  createdAt: string;
  httpMethod?: string | null;
  url?: string | null;
  httpStatus?: number | null;
  durationMs?: number | null;
};

export function ManagementLogs({ password, username, role }: { password: string; username?: string; role: Role }) {
  const [subTab, setSubTab] = useState<LogSubTab>("system");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border border-brand-mist bg-white dark:bg-card p-1">
        {([
          { id: "system" as const, label: "System" },
          { id: "pms" as const, label: "PMS" },
        ]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              subTab === t.id
                ? "bg-brand-green/10 text-brand-green"
                : "text-brand-green-dark/60 hover:bg-brand-sand/50"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {subTab === "system" && <SystemLogsPanel password={password} username={username} role={role} />}
      {subTab === "pms" && <PmsLogsPanel password={password} username={username} />}
    </div>
  );
}

function SystemLogsPanel({ password, username, role }: { password: string; username?: string; role: Role }) {
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
    const a = document.createElement("a"); a.href = url; a.download = `system-logs-${localDateStr(new Date())}.json`; a.click();
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

function prettyJson(raw: string | null | undefined): string {
  if (!raw) return "";
  try { return JSON.stringify(JSON.parse(raw), null, 2); }
  catch { return raw; }
}

function PmsLogsPanel({ password, username }: { password: string; username?: string }) {
  const [logs, setLogs] = useState<PmsLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterDirection, setFilterDirection] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const loadLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        password,
        action: "getSyncLogs",
        limit: 200,
      };
      if (username) payload.username = username;
      if (filterDirection) payload.direction = filterDirection;
      if (filterType) payload.type = filterType;
      if (filterStatus) payload.status = filterStatus;
      const res = await fetchWithRetry("/api/admin/channel-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLogs([]);
        setError(typeof data.error === "string" ? data.error : `Failed to load logs (${res.status})`);
        return;
      }
      setLogs(data.logs || []);
    } catch {
      setLogs([]);
      setError("Failed to load logs");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadLogs(); }, [filterDirection, filterType, filterStatus]);

  const downloadLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `pms-logs-${localDateStr(new Date())}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && logs.length === 0) return <AdminLoading message="Loading PMS logs..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-brand-green-dark">PMS Logs</h3>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ctaOutline" onClick={downloadLogs} disabled={logs.length === 0}>
            <DownloadIcon className="mr-1 h-4 w-4" /> Download
          </Button>
          <Button type="button" variant="ctaOutline" onClick={loadLogs}>Refresh</Button>
        </div>
      </div>

      <p className="text-[11px] text-brand-green-dark/50">
        Every call to and from Aiosell: inbound reservation webhooks (pull), Channel Manager fetch (pull), and outbound inventory / rates / restrictions / no-show (push). Newest 200 shown; older rows are pruned after 500.
      </p>

      <div className="flex flex-wrap gap-3">
        <select value={filterDirection} onChange={(e) => setFilterDirection(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-xs">
          <option value="">All directions</option>
          <option value="push">Push (outbound)</option>
          <option value="pull">Pull (inbound)</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-xs">
          <option value="">All types</option>
          <option value="inventory">Inventory</option>
          <option value="rate">Rate</option>
          <option value="restriction">Restriction</option>
          <option value="reservation">Reservation (webhook)</option>
          <option value="fetch">Fetch from Aiosell</option>
          <option value="noshow">No-show</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-xs">
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>
        <span className="ml-auto self-center text-xs text-brand-green-dark/50">{logs.length} logs</span>
      </div>

      <div className="space-y-2">
        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : logs.length === 0 ? (
          <p className="py-12 text-center text-sm text-brand-green-dark/50">
            No PMS calls yet. They appear when inventory, rates, or no-show are pushed, or when Aiosell sends a reservation.
          </p>
        ) : (
          logs.map((l) => <PmsLogCard key={l.id} log={l} />)
        )}
      </div>
    </div>
  );
}

function PmsLogCard({ log }: { log: PmsLogRow }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const failed = log.status !== "success";

  const copyLog = () => {
    const requestText = prettyJson(log.requestPayload);
    const responseText = prettyJson(log.responsePayload);
    const text = [
      `${log.direction} ${log.type} ${log.status}`,
      log.url ? `URL: ${log.httpMethod || "POST"} ${log.url}` : "",
      log.httpStatus === 0 ? "network error" : log.httpStatus != null ? `HTTP ${log.httpStatus}` : "",
      log.durationMs != null ? `${log.durationMs}ms` : "",
      `Time: ${new Date(log.createdAt).toLocaleString()}`,
      log.errorMessage ? `Error: ${log.errorMessage}` : "",
      requestText ? `\nRequest:\n${requestText}` : "",
      responseText ? `\nResponse:\n${responseText}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden",
      failed
        ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/50"
        : "border-brand-mist bg-white dark:bg-card"
    )}>
      <div className="flex items-start gap-2 p-3">
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", failed ? "bg-red-500" : "bg-green-500")} />
        <button type="button" onClick={() => setOpen(!open)} className="flex-1 min-w-0 text-left">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-brand-sand px-1.5 py-0.5 text-[9px] font-medium uppercase text-brand-green-dark/60">{log.direction}</span>
            <span className="text-xs font-medium text-brand-green-dark">{log.type}</span>
            {log.httpStatus === 0 && (
              <span className="text-[10px] text-brand-green-dark/50">network</span>
            )}
            {log.httpStatus != null && log.httpStatus !== 0 && (
              <span className="text-[10px] text-brand-green-dark/50">HTTP {log.httpStatus}</span>
            )}
            {log.durationMs != null && (
              <span className="text-[10px] text-brand-green-dark/40">{log.durationMs}ms</span>
            )}
            {(log.recordsAffected ?? 0) > 0 && (
              <span className="text-[10px] text-brand-green-dark/40">{log.recordsAffected} records</span>
            )}
          </div>
          {log.url && <p className="mt-0.5 truncate font-mono text-[10px] text-brand-green-dark/40">{log.httpMethod || "POST"} {log.url}</p>}
          {log.errorMessage && <p className="mt-0.5 text-[11px] text-red-600 dark:text-red-400 break-all">{log.errorMessage}</p>}
          <p className="mt-0.5 text-[10px] text-brand-green-dark/40">{new Date(log.createdAt).toLocaleString()}</p>
        </button>
        <button
          type="button"
          onClick={copyLog}
          className="shrink-0 rounded-md p-1 text-brand-green-dark/40 hover:bg-brand-sand hover:text-brand-green-dark transition-colors"
          title="Copy log entry"
        >
          {copied ? <CheckIcon className="h-3.5 w-3.5 text-green-500" /> : <CopyIcon className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="shrink-0 rounded-md p-1 text-brand-green-dark/40"
          aria-label={open ? "Collapse" : "Expand"}
        >
          <ChevronDownIcon className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && (() => {
        const requestText = prettyJson(log.requestPayload);
        const responseText = prettyJson(log.responsePayload);
        return (
        <div className="space-y-2 border-t border-brand-mist/60 px-3 pb-3 pt-2">
          {requestText ? (
            <div>
              <p className="mb-0.5 text-[10px] font-medium text-brand-green-dark/50">Request</p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-brand-sand/50 p-2 text-[10px] text-brand-green-dark/60">{requestText}</pre>
            </div>
          ) : null}
          {responseText ? (
            <div>
              <p className="mb-0.5 text-[10px] font-medium text-brand-green-dark/50">Response</p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-brand-sand/50 p-2 text-[10px] text-brand-green-dark/60">{responseText}</pre>
            </div>
          ) : null}
          {!requestText && !responseText && (
            <p className="text-[10px] text-brand-green-dark/40">No request or response body stored.</p>
          )}
        </div>
        );
      })()}
    </div>
  );
}
