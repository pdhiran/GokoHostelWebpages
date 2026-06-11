"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  LockIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminLoading } from "./AdminLoading";
import type { Role } from "./types";

type AccountBalance = {
  accountId: number | null;
  accountName: string;
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  expectedClosing: number;
  actualClosing: number | null;
  isReconciled: boolean;
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

export function DailyReconcile({ password, username, role }: { password: string; username?: string; role: Role }) {
  const [date, setDate] = useState(getToday);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [actuals, setActuals] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [reconciled, setReconciled] = useState(false);

  const apiCall = useCallback(async (body: Record<string, any>) => {
    const payload: Record<string, any> = { password, ...body };
    if (username) payload.username = username;
    return fetch("/api/admin/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }, [password, username]);

  const loadReconciliation = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall({ action: "getReconciliation", date });
      if (res.ok) {
        const d = await res.json();
        setBalances(d.balances || []);
        setReconciled(d.isReconciled || false);
        setNotes(d.notes || "");
        const initialActuals: Record<string, string> = {};
        for (const b of d.balances || []) {
          const key = b.accountId != null ? String(b.accountId) : "cash";
          if (b.actualClosing != null) {
            initialActuals[key] = (b.actualClosing / 100).toFixed(2);
          }
        }
        setActuals(initialActuals);
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall, date]);

  useEffect(() => { loadReconciliation(); }, [loadReconciliation]);

  const saveReconciliation = async () => {
    setSaving(true);
    try {
      const entries = balances.map((b) => {
        const key = b.accountId != null ? String(b.accountId) : "cash";
        const actualStr = actuals[key];
        return {
          accountId: b.accountId,
          actualClosing: actualStr ? Math.round(parseFloat(actualStr) * 100) : null,
        };
      });
      await apiCall({
        action: "saveReconciliation",
        date,
        entries,
        notes,
      });
      await loadReconciliation();
    } finally {
      setSaving(false);
    }
  };

  const adjustOpening = async (accountId: number | null, newOpening: number) => {
    await apiCall({
      action: "adjustOpeningBalance",
      date,
      accountId,
      openingBalance: Math.round(newOpening * 100),
    });
    loadReconciliation();
  };

  const shiftDate = (days: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split("T")[0]);
  };

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

      {reconciled && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <LockIcon className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">This day has been reconciled.</span>
        </div>
      )}

      {loading ? (
        <AdminLoading message="Loading balances..." />
      ) : (
        <>
          {/* Account Balances */}
          <div className="space-y-3">
            {balances.map((b) => {
              const key = b.accountId != null ? String(b.accountId) : "cash";
              const actual = actuals[key] ? parseFloat(actuals[key]) * 100 : null;
              const mismatch = actual != null && Math.abs(actual - b.expectedClosing) > 50;

              return (
                <div key={key} className="rounded-xl border border-brand-mist bg-white p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-brand-green-dark">{b.accountName}</h4>
                    {b.isReconciled ? (
                      <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                    ) : mismatch ? (
                      <AlertTriangleIcon className="h-4 w-4 text-amber-500" />
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
                    <div>
                      <p className="text-[10px] uppercase text-brand-green-dark/50">Opening</p>
                      <p className="text-sm font-medium text-brand-green-dark">₹{(b.openingBalance / 100).toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-brand-green-dark/50">+ Income</p>
                      <p className="text-sm font-medium text-emerald-600">₹{(b.totalIncome / 100).toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-brand-green-dark/50">- Expense</p>
                      <p className="text-sm font-medium text-red-500">₹{(b.totalExpense / 100).toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-brand-green-dark/50">Expected Closing</p>
                      <p className="text-sm font-bold text-brand-green-dark">₹{(b.expectedClosing / 100).toFixed(0)}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex-1">
                      <Label className="text-[10px]">Actual Closing (₹)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={actuals[key] || ""}
                        onChange={(e) => setActuals((prev) => ({ ...prev, [key]: e.target.value }))}
                        className={cn("mt-1 h-8 text-xs", mismatch && "border-amber-400 bg-amber-50")}
                        placeholder="Enter actual balance..."
                        disabled={reconciled}
                      />
                    </div>
                    {mismatch && (
                      <p className="text-[10px] text-amber-600 font-medium mt-4">
                        Diff: ₹{((actual! - b.expectedClosing) / 100).toFixed(0)}
                      </p>
                    )}
                  </div>

                  {role === "admin" && !reconciled && (
                    <button
                      type="button"
                      onClick={() => {
                        const val = prompt("Adjust opening balance (₹):", (b.openingBalance / 100).toFixed(2));
                        if (val) adjustOpening(b.accountId, parseFloat(val));
                      }}
                      className="mt-2 text-[10px] text-brand-green/70 hover:text-brand-green"
                    >
                      Adjust opening balance
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {balances.length === 0 && (
            <p className="py-8 text-center text-sm text-brand-green-dark/50">
              No accounts configured. Add accounts in Management → Account Settings.
            </p>
          )}

          {/* Notes & Save */}
          {balances.length > 0 && !reconciled && (
            <div className="rounded-xl border border-brand-mist bg-white p-4 space-y-3">
              <div>
                <Label className="text-xs">Notes (optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 h-8 text-xs"
                  placeholder="Any observations for the day..."
                />
              </div>
              <Button
                type="button"
                onClick={saveReconciliation}
                disabled={saving}
                className="w-full gap-1.5"
              >
                {saving ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <CheckCircleIcon className="h-4 w-4" />}
                Confirm & Reconcile
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
