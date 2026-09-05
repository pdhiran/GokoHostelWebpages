"use client";

import { useEffect, useRef, useState } from "react";
import { MAPPING_HEALTH_LABELS, MAPPING_ISSUE_HELP, type MappingHealth, type MappingIssue } from "@/lib/aiosellMappingHealth";

export function MappingHealthPanel({ call, onResolve }: {
  call: (url: string, body: Record<string, unknown>) => Promise<{ health: MappingHealth; skipped?: string }>;
  onResolve: (tab: "rooms" | "rates" | "config", issue?: MappingIssue) => void;
}) {
  const [health, setHealth] = useState<MappingHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let cancelled = false;
    heading.current?.focus();
    call("/api/admin/channel-manager", { action: "getMappingHealth" })
      .then((data) => { if (!cancelled) setHealth(data.health); })
      .catch(() => { if (!cancelled) setError("Could not load mapping health. Try Check again."); });
    return () => { cancelled = true; };
  }, [call]);
  const check = async () => {
    setBusy(true); setError("");
    try {
      const data = await call("/api/admin/channel-manager", { action: "checkMappings" });
      setHealth(data.health);
      if (data.skipped === "busy") setError("A check is already running. Try again shortly.");
    } catch { setError("Could not complete the check. Review Configuration and PMS logs, then try again."); }
    finally { setBusy(false); }
  };
  const report = health?.report;
  let connection: string[] = [];
  try {
    const parsed = report ? JSON.parse(report.identity) : [];
    if (Array.isArray(parsed) && parsed.every((part) => typeof part === "string")) connection = parsed;
  } catch { /* Older reports may not have a readable connection label. */ }
  return <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 ref={heading} tabIndex={-1} className="text-sm font-semibold outline-none">Mapping health</h3>
      <button type="button" disabled={busy || health?.status === "disabled"} onClick={check} className="rounded border border-input bg-background px-3 py-1.5 text-xs disabled:opacity-50">{busy ? "Checking…" : "Check again"}</button>
    </div>
    <p role="status" className="mt-2 text-sm font-medium">{health ? MAPPING_HEALTH_LABELS[health.status] : "Loading mapping health…"}{report?.issues.length ? ` · ${report.issues.length} issue(s)` : ""}</p>
    <p className="mt-1 text-xs text-muted-foreground">Daily check: 9:00 AM IST. Pushes continue using saved mappings. This check never changes mappings automatically.</p>
    <p className="mt-1 text-xs text-muted-foreground">Last successful check: {report?.checkedAt ? new Date(report.checkedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST" : "Not yet checked"}</p>
    {report && <p className="mt-1 break-all text-xs text-muted-foreground">Connection: {connection[0] || "Unknown"} · Property: {connection[1] || "Unknown"} · Partner: {connection[2] || "Unknown"} · Last attempt: {new Date(report.attemptedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>}
    {health && ["changed", "failed", "stale"].includes(health.status) && <p className="mt-2 text-xs">Findings below are from the last successful check. Verify again after correcting mappings.</p>}
    {(error || report?.error) && <p role="alert" className="mt-2 text-sm text-amber-900 dark:text-amber-200">{error || report?.error} <button type="button" className="underline" onClick={() => onResolve("config")}>Open Configuration</button></p>}
    {!!report?.issues.length && <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[600px] text-left text-xs">
        <thead><tr className="border-b border-amber-200"><th className="p-2">Issue / room</th><th className="p-2">Codes / Aiosell name</th><th className="p-2">How to resolve</th></tr></thead>
        <tbody>{report.issues.map((issue, index) => <tr key={index} className="border-b border-amber-100 align-top dark:border-amber-900/50">
          <td className="p-2"><strong>{MAPPING_ISSUE_HELP[issue.kind].title}</strong><p className="mt-1">{issue.dormName || (issue.dormId ? `Dorm ${issue.dormId}` : "Not mapped locally")}</p></td>
          <td className="p-2"><p className="break-all">Room: {issue.roomCode}</p>{issue.planCode && <p className="break-all">Plan: {issue.planCode}</p>}{issue.remoteName && <p>{issue.remoteName}</p>}</td>
          <td className="p-2"><ol className="list-decimal space-y-1 pl-4">{MAPPING_ISSUE_HELP[issue.kind].steps.map((step) => <li key={step}>{step}</li>)}</ol>
            <button type="button" className="mt-2 rounded border border-input bg-background px-2 py-1" onClick={() => onResolve(issue.kind.includes("plan") ? "rates" : "rooms", issue)}>Open {issue.kind.includes("plan") ? "Rate Plans" : "Room Mapping"}</button>
          </td>
        </tr>)}</tbody>
      </table>
    </div>}
    <p className="mt-3 text-xs text-muted-foreground">After saving changes, return to Sync & Logs and click Check again. A successful save alone does not confirm that both systems match.</p>
  </section>;
}
