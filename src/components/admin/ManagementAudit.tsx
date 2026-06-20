"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminApi } from "./useAdminApi";
import { AdminLoading } from "./AdminLoading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DownloadIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderHistory } from "./AdminFoodOrders";
import type { Role } from "./types";

type AuditSubTab = "room" | "food";

type AuditEntry = {
  id: number;
  timestamp: string;
  username: string;
  action: string;
  target: string;
  details: string;
};

export function ManagementAudit({ password, username, role }: { password: string; username?: string; role: Role }) {
  const [subTab, setSubTab] = useState<AuditSubTab>("room");

  const foodApiCall = useCallback(async (body: Record<string, any>) => {
    const payload: Record<string, any> = { password, ...body };
    if (username) payload.username = username;
    const res = await fetch("/api/admin/food-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res;
  }, [password, username]);

  const AUDIT_TABS = [
    { id: "room" as AuditSubTab, label: "Room & General" },
    { id: "food" as AuditSubTab, label: "Food Orders" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border border-brand-mist bg-white dark:bg-card p-1">
        {AUDIT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors lg:flex-none lg:py-1.5",
              subTab === t.id ? "bg-brand-green text-white" : "text-brand-green-dark/70 hover:bg-brand-green/[0.06]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "room" && <RoomAuditTrail password={password} username={username} role={role} />}
      {subTab === "food" && <OrderHistory apiCall={foodApiCall} />}
    </div>
  );
}

function RoomAuditTrail({ password, username, role }: { password: string; username?: string; role: Role }) {
  const { apiCall } = useAdminApi(password, username);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterUser, setFilterUser] = useState("");

  useEffect(() => { loadAudit(); }, []);

  const loadAudit = async () => {
    setLoading(true);
    try {
      const res = await apiCall({ action: "getAuditLog" });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } finally { setLoading(false); }
  };

  const filtered = entries.filter((e) => {
    if (search) {
      const q = search.toLowerCase();
      if (!e.username.toLowerCase().includes(q) && !e.target.toLowerCase().includes(q) && !e.action.toLowerCase().includes(q)) return false;
    }
    if (filterAction && e.action !== filterAction) return false;
    if (filterUser && e.username !== filterUser) return false;
    return true;
  });

  const allActions = [...new Set(entries.map((e) => e.action))];
  const allUsers = [...new Set(entries.map((e) => e.username))];

  const exportCsv = () => {
    const header = "Timestamp,User,Action,Target,Details";
    const body = filtered.map((e) => `"${e.timestamp}","${e.username}","${e.action}","${e.target}","${e.details}"`).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <AdminLoading message="Loading audit log..." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-brand-green-dark">Audit Trail</h3>
        <div className="flex gap-2">
          <Button type="button" variant="ctaOutline" onClick={exportCsv} disabled={filtered.length === 0}>
            <DownloadIcon className="mr-1 h-4 w-4" /> Export CSV
          </Button>
          <Button type="button" variant="ctaOutline" onClick={loadAudit}>Refresh</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-48" />
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-xs">
          <option value="">All actions</option>
          {allActions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-xs">
          <option value="">All users</option>
          {allUsers.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <span className="ml-auto self-center text-xs text-brand-green-dark/50">{filtered.length} entries</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-brand-mist bg-white dark:bg-card shadow-sm dark:shadow-none">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b border-brand-mist bg-brand-sand/50">
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-brand-green-dark/70">Time</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-brand-green-dark/70">User</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-brand-green-dark/70">Action</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-brand-green-dark/70">Target</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-brand-green-dark/70">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-brand-green-dark/50">No audit entries yet</td></tr>
            ) : (
              filtered.slice(0, 200).map((e) => (
                <tr key={e.id} className="border-b border-brand-mist/50 last:border-0 hover:bg-brand-sand/30">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-brand-green-dark/70">{new Date(e.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs font-medium text-brand-green-dark">{e.username}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      e.action.includes("delete") && "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400",
                      e.action.includes("assign") && "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400",
                      e.action.includes("checkout") && "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400",
                      e.action.includes("checkin") && "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400",
                      !e.action.includes("delete") && !e.action.includes("assign") && !e.action.includes("checkout") && !e.action.includes("checkin") && "bg-gray-100 dark:bg-[#1c1c1c] text-gray-700 dark:text-gray-300",
                    )}>
                      {e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-green-dark/80">{e.target}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-xs text-brand-green-dark/50">{e.details}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
