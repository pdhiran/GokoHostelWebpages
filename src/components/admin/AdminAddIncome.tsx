"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminLoading } from "./AdminLoading";
import { IncomeForm, type IncomeAccount } from "./IncomeForm";

function today() { return new Date().toLocaleDateString("en-CA"); }

export function AdminAddIncome({ password, username }: { password: string; username?: string }) {
  const [accounts, setAccounts] = useState<IncomeAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const apiCall = useCallback(async (body: Record<string, unknown>) => fetch("/api/admin/expenses", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, ...(username ? { username } : {}), ...body }),
  }), [password, username]);

  useEffect(() => {
    apiCall({ action: "getIncomeAccounts" })
      .then(async (response) => { if (response.ok) setAccounts((await response.json()).accounts || []); })
      .finally(() => setLoading(false));
  }, [apiCall]);

  if (loading) return <AdminLoading message="Loading accounts..." />;
  return <IncomeForm date={today()} accounts={accounts} apiCall={apiCall} showDate />;
}
