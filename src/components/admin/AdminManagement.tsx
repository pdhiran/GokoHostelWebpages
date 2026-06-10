"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BedDoubleIcon, UsersIcon, DatabaseIcon, ShieldCheckIcon, FileTextIcon, HeartPulseIcon, HistoryIcon, IndianRupeeIcon, UtensilsIcon, SettingsIcon, UploadIcon, QrCodeIcon } from "lucide-react";
import { AdminSetup } from "./AdminSetup";
import { ManagementUsers } from "./ManagementUsers";
import { ManagementBackup } from "./ManagementBackup";
import { ManagementAudit } from "./ManagementAudit";
import { ManagementLogs } from "./ManagementLogs";
import { ManagementHealth } from "./ManagementHealth";
import { AdminBedHistory } from "./AdminBedHistory";
import { AdminCheckRates } from "./AdminCheckRates";
import { AdminMenuManagement } from "./AdminMenuManagement";
import { AdminFoodSettings } from "./AdminFoodSettings";
import { AdminBulkImport } from "./AdminBulkImport";
import { QRGenerator } from "./qr-generator";
import type { Role, ManagementTab } from "./types";

const TABS: { id: ManagementTab; label: string; icon: React.ReactNode; adminOnly?: boolean; permission?: string }[] = [
  { id: "dorms", label: "Dorms", icon: <BedDoubleIcon className="h-3.5 w-3.5" />, adminOnly: true },
  { id: "users", label: "Users", icon: <UsersIcon className="h-3.5 w-3.5" />, adminOnly: true },
  { id: "backup", label: "Backup", icon: <DatabaseIcon className="h-3.5 w-3.5" />, adminOnly: true },
  { id: "audit", label: "Audit", icon: <ShieldCheckIcon className="h-3.5 w-3.5" />, adminOnly: true },
  { id: "logs", label: "Logs", icon: <FileTextIcon className="h-3.5 w-3.5" />, adminOnly: true },
  { id: "health", label: "Health & Stats", icon: <HeartPulseIcon className="h-3.5 w-3.5" />, adminOnly: true },
  { id: "history", label: "History", icon: <HistoryIcon className="h-3.5 w-3.5" /> },
  { id: "rates", label: "Rates", icon: <IndianRupeeIcon className="h-3.5 w-3.5" /> },
  { id: "menu", label: "Menu", icon: <UtensilsIcon className="h-3.5 w-3.5" />, adminOnly: true },
  { id: "foodSettings", label: "Food Settings", icon: <SettingsIcon className="h-3.5 w-3.5" />, adminOnly: true },
  { id: "bulkUpload", label: "Bulk Upload", icon: <UploadIcon className="h-3.5 w-3.5" />, adminOnly: true },
  { id: "qrGenerator", label: "QR Codes", icon: <QrCodeIcon className="h-3.5 w-3.5" />, permission: "canUseQRGenerator" },
];

export function AdminManagement({ password, username, role, permissions = {} }: { password: string; username?: string; role: Role; permissions?: Record<string, boolean> }) {
  const visibleTabs = TABS.filter((t) => {
    if (t.adminOnly && role !== "admin") return false;
    if (t.permission && role !== "admin" && role !== "manager" && !permissions[t.permission]) return false;
    return true;
  });
  const defaultTab = visibleTabs[0]?.id || "history";
  const [tab, setTab] = useState<ManagementTab>(defaultTab);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-brand-green md:text-2xl">Management</h2>
      </div>

      {/* Sub-tab navigation - scrollable on mobile */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-brand-mist bg-white p-1.5">
        <div className="flex gap-1.5 whitespace-nowrap">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                tab === t.id
                  ? "bg-brand-green/10 text-brand-green"
                  : "text-brand-green-dark/60 hover:bg-brand-sand/50"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {tab === "dorms" && <AdminSetup password={password} />}
        {tab === "users" && <ManagementUsers password={password} role={role} />}
        {tab === "backup" && <ManagementBackup password={password} role={role} />}
        {tab === "audit" && <ManagementAudit password={password} role={role} />}
        {tab === "logs" && <ManagementLogs password={password} role={role} />}
        {tab === "health" && <ManagementHealth password={password} role={role} />}
        {tab === "history" && <AdminBedHistory password={password} username={username} role={role} />}
        {tab === "rates" && <AdminCheckRates password={password} username={username} role={role} />}
        {tab === "menu" && <AdminMenuManagement password={password} username={username} role={role} />}
        {tab === "foodSettings" && <AdminFoodSettings password={password} username={username} role={role} />}
        {tab === "bulkUpload" && <AdminBulkImport password={password} username={username} role={role} />}
        {tab === "qrGenerator" && <QRGenerator password={password} username={username} role={role} />}
      </div>
    </div>
  );
}
