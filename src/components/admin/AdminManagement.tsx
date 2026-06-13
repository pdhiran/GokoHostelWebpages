"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { BedDoubleIcon, UsersIcon, DatabaseIcon, ShieldCheckIcon, FileTextIcon, HeartPulseIcon, HistoryIcon, IndianRupeeIcon, UtensilsIcon, SettingsIcon, UploadIcon, QrCodeIcon, ChevronDownIcon, WalletIcon, ServerIcon } from "lucide-react";
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
import { AccountSettings } from "./AccountSettings";
import { ServerSync } from "./ServerSync";
import { useTabWithHistory } from "@/hooks/useTabWithHistory";
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
  { id: "accountSettings", label: "Account Settings", icon: <WalletIcon className="h-3.5 w-3.5" />, permission: "canManageAccounts" },
  { id: "serverSync", label: "Server Sync", icon: <ServerIcon className="h-3.5 w-3.5" />, adminOnly: true },
];

export function AdminManagement({ password, username, role, permissions = {}, initialTab, onTabUsed }: { password: string; username?: string; role: Role; permissions?: Record<string, boolean>; initialTab?: ManagementTab; onTabUsed?: () => void }) {
  const visibleTabs = TABS.filter((t) => {
    if (t.adminOnly && role !== "admin") return false;
    if (t.permission && role !== "admin" && !permissions[t.permission]) return false;
    return true;
  });
  const defaultTab = visibleTabs[0]?.id || "history";
  const [tab, setTab] = useTabWithHistory<ManagementTab>("tab", defaultTab);

  useEffect(() => {
    if (initialTab && visibleTabs.some((t) => t.id === initialTab)) {
      setTab(initialTab);
      onTabUsed?.();
    }
  }, [initialTab]);
  const [subMenuOpen, setSubMenuOpen] = useState(false);

  const activeTab = visibleTabs.find((t) => t.id === tab);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-brand-green md:text-2xl">Management</h2>
      </div>

      {/* Desktop tabs */}
      <div className="mt-4 hidden flex-wrap gap-1.5 rounded-xl border border-brand-mist bg-white p-1.5 lg:flex">
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

      {/* Mobile/Tablet dropdown */}
      <div className="relative z-30 mt-4 lg:hidden">
        <button
          type="button"
          onClick={() => setSubMenuOpen(!subMenuOpen)}
          className="flex w-full items-center justify-between rounded-xl border border-brand-mist bg-white px-4 py-3"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-brand-green">
            {activeTab?.icon}
            {activeTab?.label}
          </span>
          <ChevronDownIcon className={cn("h-4 w-4 text-brand-green-dark/40 transition-transform", subMenuOpen && "rotate-180")} />
        </button>
        {subMenuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setSubMenuOpen(false)} />
            <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-xl border border-brand-mist bg-white p-2 shadow-lg">
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {visibleTabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setTab(t.id); setSubMenuOpen(false); }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors",
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
          </>
        )}
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
        {tab === "accountSettings" && <AccountSettings password={password} username={username} role={role} />}
        {tab === "serverSync" && <ServerSync password={password} username={username} role={role} />}
      </div>
    </div>
  );
}
