"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PlusCircleIcon, FileTextIcon, IndianRupeeIcon, ChevronDownIcon } from "lucide-react";
import { AdminAddExpense } from "./AdminAddExpense";
import { AdminBillRecords } from "./AdminBillRecords";
import { AdminFoodBill } from "./AdminFoodBill";
import type { Role } from "./types";

type ExpenseTab = "addExpense" | "billRecords" | "foodBill";

const TABS: { id: ExpenseTab; label: string; icon: React.ReactNode; permission?: string }[] = [
  { id: "addExpense", label: "Add Expense", icon: <PlusCircleIcon className="h-3.5 w-3.5" /> },
  { id: "billRecords", label: "Bill Records", icon: <FileTextIcon className="h-3.5 w-3.5" />, permission: "canViewExpenses" },
  { id: "foodBill", label: "Food Bill", icon: <IndianRupeeIcon className="h-3.5 w-3.5" />, permission: "canViewFoodBills" },
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
  const visibleTabs = TABS.filter((t) => !t.permission || role === "admin" || permissions[t.permission]);
  const defaultTab = visibleTabs[0]?.id || "addExpense";
  const [tab, setTab] = useState<ExpenseTab>(defaultTab);
  const [expMenuOpen, setExpMenuOpen] = useState(false);

  const activeTab = visibleTabs.find((t) => t.id === tab);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-brand-green md:text-2xl">Expenditure</h2>
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
      <div className="relative mt-4 lg:hidden">
        <button
          type="button"
          onClick={() => setExpMenuOpen(!expMenuOpen)}
          className="flex w-full items-center justify-between rounded-xl border border-brand-mist bg-white px-4 py-3"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-brand-green">
            {activeTab?.icon}
            {activeTab?.label}
          </span>
          <ChevronDownIcon className={cn("h-4 w-4 text-brand-green-dark/40 transition-transform", expMenuOpen && "rotate-180")} />
        </button>
        {expMenuOpen && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-brand-mist bg-white p-2 shadow-lg">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTab(t.id); setExpMenuOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors",
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
        )}
      </div>

      <div className="mt-6">
        {tab === "addExpense" && <AdminAddExpense password={password} username={username} role={role} />}
        {tab === "billRecords" && <AdminBillRecords password={password} username={username} role={role} />}
        {tab === "foodBill" && <AdminFoodBill password={password} username={username} role={role} />}
      </div>
    </div>
  );
}
