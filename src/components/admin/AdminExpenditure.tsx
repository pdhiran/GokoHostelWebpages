"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PlusCircleIcon, FileTextIcon, IndianRupeeIcon, BookOpenIcon, ScaleIcon } from "lucide-react";
import { AdminAddExpense } from "./AdminAddExpense";
import { AdminBillRecords } from "./AdminBillRecords";
import { AdminFoodBill } from "./AdminFoodBill";
import { DailyLedger } from "./DailyLedger";
import { DailyReconcile } from "./DailyReconcile";
import type { Role } from "./types";

type AccountsTab = "addExpense" | "dailyLedger" | "billRecords" | "foodBill" | "reconcile";

const TABS: { id: AccountsTab; label: string; icon: React.ReactNode; permission?: string }[] = [
  { id: "addExpense", label: "Add Expense", icon: <PlusCircleIcon className="h-3.5 w-3.5" /> },
  { id: "dailyLedger", label: "Daily Ledger", icon: <BookOpenIcon className="h-3.5 w-3.5" />, permission: "canAddIncome" },
  { id: "billRecords", label: "Records", icon: <FileTextIcon className="h-3.5 w-3.5" />, permission: "canViewExpenses" },
  { id: "foodBill", label: "Food Revenue", icon: <IndianRupeeIcon className="h-3.5 w-3.5" />, permission: "canViewFoodBills" },
  { id: "reconcile", label: "Reconcile", icon: <ScaleIcon className="h-3.5 w-3.5" />, permission: "canReconcile" },
];

export function AdminExpenditure({
  password,
  username,
  role,
  permissions,
}: {
  password: string;
  username?: string;
  role: Role;
  permissions: Record<string, boolean>;
}) {
  const visibleTabs = TABS.filter((t) => !t.permission || role === "admin" || role === "manager" || permissions[t.permission!]);
  const defaultTab = visibleTabs[0]?.id || "addExpense";
  const [tab, setTab] = useState<AccountsTab>(defaultTab);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-brand-green md:text-2xl">Accounts</h2>
      </div>

      {/* Tab buttons */}
      <div className="mt-4 flex flex-wrap gap-1.5 rounded-xl border border-brand-mist bg-white p-1.5">
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

      <div className="mt-6">
        {tab === "addExpense" && <AdminAddExpense password={password} username={username} role={role} />}
        {tab === "dailyLedger" && <DailyLedger password={password} username={username} role={role} />}
        {tab === "billRecords" && <AdminBillRecords password={password} username={username} role={role} />}
        {tab === "foodBill" && <AdminFoodBill password={password} username={username} role={role} />}
        {tab === "reconcile" && <DailyReconcile password={password} username={username} role={role} />}
      </div>
    </div>
  );
}
