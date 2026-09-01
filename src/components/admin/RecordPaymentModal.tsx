"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { BanknoteIcon, SmartphoneIcon, XIcon } from "lucide-react";

type PaymentTab = "cash" | "online" | "split";
type AmountUnit = "paise" | "rupees";
type ReceiptAccount = { id: number; name: string; nickname: string; isActive: number };

export function RecordPaymentModal({
  totalAmount,
  guestName,
  initialMethod,
  initialCash,
  onConfirm,
  onClose,
  mode = "collect",
  zClass = "z-[60]",
  amountUnit = "paise",
  password,
  username,
  receiptKind,
}: {
  totalAmount: number;
  guestName: string;
  initialMethod?: string;
  initialCash?: number;
  onConfirm: (method: string, cashReceived: number, changeGiven: number, onlineAccountId?: number, receiptId?: string) => void | Promise<void>;
  onClose: () => void;
  mode?: "collect" | "refund";
  zClass?: string;
  /** Food orders are paise. Bookings calendar amounts are rupees. */
  amountUnit?: AmountUnit;
  password?: string;
  username?: string;
  receiptKind?: "food" | "room";
}) {
  const refund = mode === "refund";
  const scale = amountUnit === "rupees" ? 1 : 100;
  const toStored = (rupeeValue: number) => Math.round(rupeeValue * scale);
  const defaultTab: PaymentTab = initialMethod === "cash" ? "cash" : initialMethod === "split" ? "split" : "online";
  const [activeTab, setActiveTab] = useState<PaymentTab>(defaultTab);
  const defaultCash = initialCash && initialCash > 0 ? (initialCash / scale).toString() : (totalAmount / scale).toString();
  const [cashInput, setCashInput] = useState(defaultCash);
  const [splitCash, setSplitCash] = useState("");
  const [splitOnline, setSplitOnline] = useState((totalAmount / scale).toString());
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<ReceiptAccount[]>([]);
  const [onlineAccountId, setOnlineAccountId] = useState("");

  useEffect(() => {
    if (!password || !receiptKind) return;
    const payload: Record<string, string> = { password, action: "listAccounts" };
    if (username) payload.username = username;
    void fetch("/api/admin/account-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then((r) => r.ok ? r.json() : null).then((data) => {
        if (!data) return;
        setAccounts((data.accounts || []).filter((a: ReceiptAccount) => a.isActive));
        setOnlineAccountId(String(receiptKind === "food" ? data.foodOnlineReceiptAccountId || "" : data.roomOnlineReceiptAccountId || ""));
      }).catch(() => {});
  }, [password, username, receiptKind]);

  const totalRupees = totalAmount / scale;
  const cashValue = Number(cashInput) || 0;
  const changeDue = cashValue - totalRupees;
  const splitCashVal = Number(splitCash) || 0;
  const splitOnlineVal = Number(splitOnline) || 0;
  const splitTotal = splitCashVal + splitOnlineVal;
  const splitExact = Math.round(splitTotal * 100) === Math.round(totalRupees * 100);

  useEffect(() => {
    const online = totalRupees - splitCashVal;
    setSplitOnline(online > 0 ? online.toString() : "0");
  }, [splitCash, totalRupees, splitCashVal]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (activeTab === "cash") {
        if (refund) {
          await onConfirm("cash", toStored(totalRupees), 0);
        } else {
          const received = toStored(cashValue);
          const change = changeDue > 0 ? toStored(changeDue) : 0;
          await onConfirm("cash", received, change);
        }
      } else if (activeTab === "online") {
        await onConfirm("online", 0, 0, Number(onlineAccountId) || undefined, crypto.randomUUID());
      } else {
        await onConfirm("split", toStored(splitCashVal), 0, Number(onlineAccountId) || undefined, crypto.randomUUID());
      }
    } finally {
      setSaving(false);
    }
  };

  const canSave = (() => {
    if (saving) return false;
    if (activeTab === "cash") return refund ? true : cashValue >= totalRupees;
    if (activeTab === "online") return !receiptKind || !!onlineAccountId;
    if (activeTab === "split") {
      if (!(splitCashVal > 0 && splitOnlineVal > 0)) return false;
      return (refund ? splitExact : splitTotal >= totalRupees) && (!receiptKind || !!onlineAccountId);
    }
    return false;
  })();

  const tabs: { id: PaymentTab; label: string; icon: React.ReactNode }[] = [
    { id: "cash", label: "Cash", icon: <BanknoteIcon className="h-4 w-4 shrink-0" /> },
    { id: "online", label: "Online", icon: <SmartphoneIcon className="h-4 w-4 shrink-0" /> },
    { id: "split", label: "Split", icon: <><BanknoteIcon className="h-3.5 w-3.5 shrink-0" /><span className="text-[10px]">+</span><SmartphoneIcon className="h-3.5 w-3.5 shrink-0" /></> },
  ];

  return (
    <div className={cn("fixed inset-0 flex items-center justify-center overflow-y-auto p-4", zClass)}>
      <div className="absolute inset-0 bg-black/40" onClick={() => !saving && onClose()} />
      <div className="relative w-full min-w-0 max-w-sm rounded-2xl bg-white dark:bg-card shadow-2xl dark:shadow-none animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-brand-mist px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-brand-green-dark">{refund ? "Record Refund" : "Record Payment"}</h3>
            <p className="truncate text-xs text-brand-green-dark/50">{guestName}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="shrink-0 rounded-lg p-1.5 hover:bg-brand-sand disabled:opacity-40">
            <XIcon className="h-5 w-5 text-brand-green-dark/60" />
          </button>
        </div>

        <div className="bg-brand-sand/40 px-5 py-3 text-center">
          <p className="text-xs text-brand-green-dark/60">{refund ? "Refund Total" : "Bill Total"}</p>
          <p className="text-2xl font-bold text-brand-green">₹{totalRupees.toFixed(0)}</p>
        </div>

        <div className="flex w-full min-w-0 gap-1 border-b border-brand-mist px-3 pt-3 pb-0 sm:px-5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-1 rounded-t-lg px-2 py-2 text-xs font-medium transition-colors sm:gap-1.5 sm:px-4 sm:text-sm",
                activeTab === t.id
                  ? "border-b-2 border-brand-green bg-brand-green/[0.06] text-brand-green"
                  : "text-brand-green-dark/50 hover:text-brand-green-dark/70"
              )}
            >
              {t.icon} <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="px-5 py-4">
          {activeTab === "cash" && (
            refund ? (
              <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-4 text-center">
                <BanknoteIcon className="mx-auto mb-2 h-8 w-8 text-green-600" />
                <p className="text-sm text-green-800 dark:text-green-300">
                  Give <span className="font-bold">₹{totalRupees.toFixed(0)}</span> cash?
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-brand-green-dark/70">Cash Received (₹)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="w-full min-w-0 rounded-lg border border-brand-mist px-3 py-2.5 text-lg font-semibold text-brand-green-dark focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
                    value={cashInput}
                    onChange={(e) => setCashInput(e.target.value)}
                    autoFocus
                  />
                </div>
                {cashValue > 0 && changeDue > 0 && (
                  <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-3 py-2">
                    <p className="text-sm font-semibold text-green-700 dark:text-green-400">Change Due: ₹{changeDue.toFixed(0)}</p>
                  </div>
                )}
                {cashValue > 0 && changeDue < 0 && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 space-y-1">
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">Remaining: ₹{Math.abs(changeDue).toFixed(0)}</p>
                    <button
                      type="button"
                      onClick={() => { setActiveTab("split"); setSplitCash(cashInput); }}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                    >
                      Record remaining as Online
                    </button>
                  </div>
                )}
              </div>
            )
          )}

          {activeTab === "online" && (
            <div className="space-y-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-4 py-4 text-center">
              <SmartphoneIcon className="mx-auto mb-2 h-8 w-8 text-blue-500" />
              <p className="text-sm text-blue-800 dark:text-blue-300">
                {refund ? "Mark " : "Mark "}
                <span className="font-bold">₹{totalRupees.toFixed(0)}</span>
                {refund ? " as refunded online?" : " as paid online?"}
              </p>
              {receiptKind && <label className="block text-left text-xs font-medium text-blue-900 dark:text-blue-200">Received in
                <select value={onlineAccountId} onChange={(e) => setOnlineAccountId(e.target.value)} className="mt-1 w-full rounded border border-blue-200 bg-white px-2 py-2 text-sm text-brand-green-dark"><option value="">Select bank…</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.nickname || a.name}</option>)}</select>
              </label>}
            </div>
          )}

          {activeTab === "split" && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-brand-green-dark/70">Cash Amount (₹)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="w-full min-w-0 rounded-lg border border-brand-mist px-3 py-2.5 text-base font-semibold text-brand-green-dark focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
                  value={splitCash}
                  onChange={(e) => setSplitCash(e.target.value)}
                  placeholder="0"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-brand-green-dark/70">Online Amount (₹)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  readOnly
                  className="w-full min-w-0 rounded-lg border border-brand-mist bg-brand-sand/40 px-3 py-2.5 text-base font-semibold text-brand-green-dark/70 focus:outline-none"
                  value={splitOnline}
                  placeholder="0"
                />
              </div>
              <div className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium",
                (refund ? splitExact : splitTotal >= totalRupees)
                  ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                  : "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
              )}>
                Total: ₹{splitTotal.toFixed(0)} / ₹{totalRupees.toFixed(0)}
                {splitTotal < totalRupees && <span className="ml-1 text-xs">(₹{(totalRupees - splitTotal).toFixed(0)} short)</span>}
              </div>
              {receiptKind && <label className="block text-xs font-medium text-brand-green-dark/70">Online amount received in
                <select value={onlineAccountId} onChange={(e) => setOnlineAccountId(e.target.value)} className="mt-1 w-full rounded border border-input bg-white px-2 py-2 text-sm"><option value="">Select bank…</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.nickname || a.name}</option>)}</select>
              </label>}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-brand-mist px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-w-0 flex-1 rounded-lg border border-brand-mist px-4 py-2.5 text-sm font-medium text-brand-green-dark/70 hover:bg-brand-sand disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="min-w-0 flex-1 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-green/90 disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PaymentDetailLabel({
  method, total, cashReceived, changeGiven, amountUnit = "paise",
}: {
  method: string; total: number; cashReceived: number; changeGiven: number; amountUnit?: AmountUnit;
}) {
  const fmt = (n: number) => amountUnit === "rupees"
    ? `₹${(n || 0).toLocaleString("en-IN")}`
    : `₹${((n || 0) / 100).toFixed(0)}`;
  if (method === "cash") {
    if (cashReceived > 0) {
      return <span className="text-green-700 dark:text-green-400">Cash — Received {fmt(cashReceived)}{changeGiven > 0 ? `, Change ${fmt(changeGiven)}` : ""}</span>;
    }
    return <span className="text-green-700 dark:text-green-400">Cash — {fmt(total)}</span>;
  }
  if (method === "online") {
    return <span className="text-blue-700 dark:text-blue-400">Online — {fmt(total)}</span>;
  }
  if (method === "split") {
    const cashAfterChange = cashReceived - (changeGiven || 0);
    const onlinePart = total - cashAfterChange;
    if (onlinePart <= 0) {
      return <span className="text-green-700 dark:text-green-400">Cash — Received {fmt(cashReceived)}{changeGiven > 0 ? `, Change ${fmt(changeGiven)}` : ""}</span>;
    }
    return <span className="text-purple-700 dark:text-purple-400">Split — Cash {fmt(cashAfterChange)} + Online {fmt(onlinePart)}</span>;
  }
  return <span>{method}</span>;
}
