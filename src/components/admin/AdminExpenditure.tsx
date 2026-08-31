"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PlusCircleIcon, FileTextIcon, IndianRupeeIcon, BedDoubleIcon, BookOpenIcon, ScaleIcon } from "lucide-react";
import { AdminAddExpense } from "./AdminAddExpense";
import { AdminBillRecords } from "./AdminBillRecords";
import { AdminFoodBill } from "./AdminFoodBill";
import { AdminRoomRevenue } from "./AdminRoomRevenue";
import { DailyLedger } from "./DailyLedger";
import { DailyReconcile } from "./DailyReconcile";
import { useTabWithHistory } from "@/hooks/useTabWithHistory";
import type { Role } from "./types";

type AccountsTab = "addExpense" | "dailyLedger" | "billRecords" | "foodBill" | "roomBill" | "reconcile";

const TABS: { id: AccountsTab; label: string; icon: React.ReactNode; permission?: string }[] = [
  { id: "addExpense", label: "Add Expense", icon: <PlusCircleIcon className="h-3.5 w-3.5" />, permission: "canAddExpense" },
  { id: "dailyLedger", label: "Daily Ledger", icon: <BookOpenIcon className="h-3.5 w-3.5" />, permission: "canAddIncome" },
  { id: "billRecords", label: "Records", icon: <FileTextIcon className="h-3.5 w-3.5" />, permission: "canViewExpenses" },
  { id: "foodBill", label: "Food Revenue", icon: <IndianRupeeIcon className="h-3.5 w-3.5" />, permission: "canViewFoodBills" },
  { id: "roomBill", label: "Room Revenue", icon: <BedDoubleIcon className="h-3.5 w-3.5" />, permission: "canViewFoodBills" },
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
  const visibleTabs = TABS.filter((t) => !t.permission || role === "admin" || !!permissions[t.permission!]);
  const defaultTab = visibleTabs[0]?.id || "addExpense";
  const [tab, setTab] = useTabWithHistory<AccountsTab>("tab", defaultTab);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-brand-green md:text-2xl">Accounts</h2>
      </div>

      {/* Tab buttons */}
      <div className="mt-4 flex flex-wrap gap-1.5 rounded-xl border border-brand-mist bg-white dark:bg-card p-1.5">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              tab === t.id
                ? "text-brand-green"
                : "text-brand-green-dark/60 hover:bg-brand-sand/50"
            )}
          >
            {tab === t.id && (
              <motion.span
                layoutId="expenditure-tab-pill"
                className="absolute inset-0 rounded-lg bg-brand-green/10"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {t.icon}
              {t.label}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "addExpense" && <AdminAddExpense password={password} username={username} role={role} permissions={permissions} />}
        {tab === "dailyLedger" && <DailyLedger password={password} username={username} role={role} permissions={permissions} />}
        {tab === "billRecords" && <AdminBillRecords password={password} username={username} role={role} permissions={permissions} />}
        {tab === "foodBill" && <AdminFoodBill password={password} username={username} role={role} permissions={permissions} />}
        {tab === "roomBill" && <AdminRoomRevenue password={password} username={username} role={role} permissions={permissions} />}
        {tab === "reconcile" && <DailyReconcile password={password} username={username} role={role} permissions={permissions} />}
      </div>
    </div>
  );
}
