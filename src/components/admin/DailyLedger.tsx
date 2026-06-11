"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PlusIcon,
  Loader2Icon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  IndianRupeeIcon,
} from "lucide-react";
import { AdminLoading } from "./AdminLoading";
import type { Role } from "./types";

type IncomeEntry = {
  id: number;
  date: string;
  accountId: number | null;
  type: string;
  amount: number;
  source: string;
  description: string;
  createdBy: string;
  createdAt: string;
};

type ExpenseEntry = {
  id: number;
  amount: number;
  category: string;
  mainCategory: string;
  subCategory: string;
  purpose: string;
  paymentMethod: string;
  accountId: number | null;
  vendorName: string;
  createdBy: string;
  createdAt: string;
};

type Account = { id: number; name: string; nickname: string };

type DaySummary = {
  incomeEntries: IncomeEntry[];
  expenseEntries: ExpenseEntry[];
  accounts: Account[];
  foodRevenue: number;
  accountSummaries: {
    accountId: number | null;
    accountName: string;
    income: number;
    expense: number;
  }[];
};

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const INCOME_SOURCES = [
  { id: "stay", label: "Stay Revenue" },
  { id: "food", label: "Food Revenue" },
  { id: "other", label: "Other" },
];

export function DailyLedger({ password, username, role }: { password: string; username?: string; role: Role }) {
  const [date, setDate] = useState(getToday);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DaySummary | null>(null);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [saving, setSaving] = useState(false);

  // Income form
  const [incAccountId, setIncAccountId] = useState<string>("");
  const [incType, setIncType] = useState<string>("online");
  const [incAmount, setIncAmount] = useState("");
  const [incSource, setIncSource] = useState("stay");
  const [incDescription, setIncDescription] = useState("");

  const apiCall = useCallback(async (body: Record<string, any>) => {
    const payload: Record<string, any> = { password, ...body };
    if (username) payload.username = username;
    return fetch("/api/admin/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }, [password, username]);

  const loadDay = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall({ action: "getDailyLedger", date });
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall, date]);

  useEffect(() => {
    if (data?.accounts?.length && !incAccountId) {
      const defaultAcc = data.accounts.find((a: Account) => a.id);
      if (defaultAcc) setIncAccountId(String(defaultAcc.id));
    }
  }, [data?.accounts]);

  useEffect(() => { loadDay(); }, [loadDay]);

  const addIncome = async () => {
    const amountNum = parseFloat(incAmount);
    if (!amountNum || amountNum <= 0) return;
    setSaving(true);
    try {
      const res = await apiCall({
        action: "addDailyIncome",
        date,
        accountId: incAccountId ? parseInt(incAccountId) : null,
        type: incType,
        amount: Math.round(amountNum * 100),
        source: incSource,
        description: incDescription,
      });
      if (res.ok) {
        setIncAmount("");
        setIncDescription("");
        setShowAddIncome(false);
        loadDay();
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteIncome = async (id: number) => {
    if (!confirm("Delete this income entry?")) return;
    await apiCall({ action: "deleteDailyIncome", id });
    loadDay();
  };

  const shiftDate = (days: number) => {
    const [y, m, d] = date.split("-").map(Number);
    const next = new Date(y, m - 1, d + days);
    setDate(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`);
  };

  const totalIncome = data?.incomeEntries.reduce((s, e) => s + e.amount, 0) || 0;
  const totalExpense = data?.expenseEntries.reduce((s, e) => s + e.amount, 0) || 0;
  const foodRevenue = data?.foodRevenue || 0;
  const stayRevenue = data?.incomeEntries.filter((e) => e.source === "stay").reduce((s, e) => s + e.amount, 0) || 0;
  const totalRevenue = totalIncome + foodRevenue;

  return (
    <div className="space-y-6">
      {/* Date Navigator */}
      <div className="flex items-center justify-between rounded-xl border border-brand-mist bg-white p-3">
        <button type="button" onClick={() => shiftDate(-1)} className="rounded-lg p-2 hover:bg-brand-sand">
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-brand-green" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border-none bg-transparent text-sm font-medium text-brand-green-dark focus:outline-none"
          />
          <span className="text-xs text-brand-green-dark/50">{formatDate(date)}</span>
        </div>
        <button
          type="button"
          onClick={() => shiftDate(1)}
          disabled={date >= getToday()}
          className="rounded-lg p-2 hover:bg-brand-sand disabled:opacity-30"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <AdminLoading message="Loading ledger..." />
      ) : (
        <>
          {/* Day Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-brand-mist bg-white p-3 sm:p-4">
              <p className="text-[10px] font-medium uppercase text-brand-green-dark/50">Total Revenue</p>
              <p className="mt-1 text-lg font-bold text-brand-green-dark sm:text-xl">₹{(totalRevenue / 100).toFixed(0)}</p>
            </div>
            <div className="rounded-xl border border-brand-mist bg-white p-3 sm:p-4">
              <p className="text-[10px] font-medium uppercase text-brand-green-dark/50">Stay Revenue</p>
              <p className="mt-1 text-lg font-bold text-emerald-700 sm:text-xl">₹{(stayRevenue / 100).toFixed(0)}</p>
            </div>
            <div className="rounded-xl border border-brand-mist bg-white p-3 sm:p-4">
              <p className="text-[10px] font-medium uppercase text-brand-green-dark/50">Food Revenue</p>
              <p className="mt-1 text-lg font-bold text-blue-700 sm:text-xl">₹{(foodRevenue / 100).toFixed(0)}</p>
            </div>
            <div className="rounded-xl border border-brand-mist bg-white p-3 sm:p-4">
              <p className="text-[10px] font-medium uppercase text-brand-green-dark/50">Total Expense</p>
              <p className="mt-1 text-lg font-bold text-red-600 sm:text-xl">₹{(totalExpense / 100).toFixed(0)}</p>
            </div>
            <div className="rounded-xl border border-brand-mist bg-white p-3 sm:p-4">
              <p className="text-[10px] font-medium uppercase text-brand-green-dark/50">Net (Income - Expense)</p>
              <p className={`mt-1 text-lg font-bold sm:text-xl ${(totalRevenue - totalExpense) >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                ₹{((totalRevenue - totalExpense) / 100).toFixed(0)}
              </p>
            </div>
          </div>

          {/* Account-wise Summary */}
          {data?.accountSummaries && data.accountSummaries.length > 0 && (
            <div className="rounded-xl border border-brand-mist bg-white p-4">
              <h4 className="text-sm font-semibold text-brand-green-dark mb-3">Account-wise Summary</h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.accountSummaries.map((a) => (
                  <div key={a.accountId ?? "cash"} className="flex items-center justify-between rounded-lg border border-brand-mist p-3">
                    <span className="text-xs font-medium text-brand-green-dark">{a.accountName}</span>
                    <div className="text-right">
                      <span className="text-xs text-emerald-600">+₹{(a.income / 100).toFixed(0)}</span>
                      <span className="mx-1 text-brand-green-dark/30">/</span>
                      <span className="text-xs text-red-500">-₹{(a.expense / 100).toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Income Entries */}
          <div className="rounded-xl border border-brand-mist bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-brand-green-dark">Income Entries</h4>
              <Button type="button" onClick={() => setShowAddIncome(!showAddIncome)} className="h-7 gap-1 text-xs">
                <PlusIcon className="h-3 w-3" /> Add Income
              </Button>
            </div>

            {showAddIncome && (
              <div className="mb-4 rounded-lg border border-brand-green/20 bg-brand-green/5 p-3 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label className="text-[10px]">Account</Label>
                    <select
                      value={incAccountId}
                      onChange={(e) => setIncAccountId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-brand-mist bg-white px-2 py-1.5 text-xs"
                    >
                      <option value="">Cash</option>
                      {data?.accounts?.map((a) => (
                        <option key={a.id} value={a.id}>{a.nickname || a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Type</Label>
                    <select
                      value={incType}
                      onChange={(e) => setIncType(e.target.value)}
                      className="mt-1 w-full rounded-md border border-brand-mist bg-white px-2 py-1.5 text-xs"
                    >
                      <option value="cash">Cash</option>
                      <option value="online">Online</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Source</Label>
                    <select
                      value={incSource}
                      onChange={(e) => setIncSource(e.target.value)}
                      className="mt-1 w-full rounded-md border border-brand-mist bg-white px-2 py-1.5 text-xs"
                    >
                      {INCOME_SOURCES.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Amount (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={incAmount}
                      onChange={(e) => setIncAmount(e.target.value)}
                      className="mt-1 h-8 text-xs"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px]">Description (optional)</Label>
                  <Input
                    value={incDescription}
                    onChange={(e) => setIncDescription(e.target.value)}
                    className="mt-1 h-8 text-xs"
                    placeholder="Notes..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={addIncome} disabled={saving} className="h-7 text-xs">
                    {saving ? <Loader2Icon className="h-3 w-3 animate-spin" /> : "Save"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowAddIncome(false)} className="h-7 text-xs">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {data?.incomeEntries.length === 0 ? (
              <p className="py-4 text-center text-xs text-brand-green-dark/40">No income entries for this day.</p>
            ) : (
              <div className="space-y-1.5">
                {data?.incomeEntries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-lg border border-brand-mist px-3 py-2">
                    <div className="flex items-center gap-3">
                      <IndianRupeeIcon className="h-3.5 w-3.5 text-emerald-600" />
                      <div>
                        <p className="text-xs font-medium text-brand-green-dark">
                          ₹{(e.amount / 100).toFixed(0)}
                          <span className="ml-2 text-[10px] text-brand-green-dark/50">{e.source} · {e.type}</span>
                        </p>
                        {e.description && <p className="text-[10px] text-brand-green-dark/40">{e.description}</p>}
                      </div>
                    </div>
                    {role === "admin" && (
                      <button type="button" onClick={() => deleteIncome(e.id)} className="text-[10px] text-red-400 hover:text-red-600">
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expense Entries for the day */}
          <div className="rounded-xl border border-brand-mist bg-white p-4">
            <h4 className="text-sm font-semibold text-brand-green-dark mb-3">Expenses for {formatDate(date)}</h4>
            {data?.expenseEntries.length === 0 ? (
              <p className="py-4 text-center text-xs text-brand-green-dark/40">No expenses recorded for this day.</p>
            ) : (
              <div className="space-y-1.5">
                {data?.expenseEntries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-lg border border-brand-mist px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-brand-green-dark">
                        ₹{(e.amount / 100).toFixed(0)}
                        <span className="ml-2 text-[10px] text-brand-green-dark/50">
                          {e.subCategory || e.category} · {e.paymentMethod || "cash"}
                        </span>
                      </p>
                      <p className="text-[10px] text-brand-green-dark/40">
                        {e.vendorName && `${e.vendorName} · `}{e.purpose}
                      </p>
                    </div>
                    <span className="text-[10px] text-red-500 font-medium">-₹{(e.amount / 100).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
