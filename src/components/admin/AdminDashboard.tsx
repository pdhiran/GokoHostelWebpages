"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminApi } from "./useAdminApi";
import { AdminLoading } from "./AdminLoading";
import { cn } from "@/lib/utils";
import { BedDoubleIcon, UsersIcon, CalendarCheckIcon, AlertTriangleIcon, LogOutIcon, Loader2Icon, ExternalLinkIcon, BanknoteIcon, SmartphoneIcon, XIcon, CheckCircleIcon } from "lucide-react";
import { getAgeFromDob, dobsMatch } from "@/lib/parseDob";
import type { Role, AdminSection } from "./types";

export function AdminDashboard({
  password,
  username,
  role,
  onNavigate,
}: {
  password: string;
  username?: string;
  role: Role;
  onNavigate: (section: AdminSection) => void;
}) {
  const { apiCall } = useAdminApi(password, username);
  const [todayCheckins, setTodayCheckins] = useState<{ row: string[]; assignedBed: string | null; dob: string; dobFromId: string; vibeMatched: number }[]>([]);
  const [todayCheckouts, setTodayCheckouts] = useState<{
    name: string; contact: string; bedId: string; dorm: string; bedIdx: number; expectedCheckout: string;
    pendingTab: number; paidTotal: number; totalOrders: number; pendingOrders: number; checkinId: number | null;
  }[]>([]);
  const [stats, setStats] = useState({ total: 0, occupied: 0, available: 0, cleanup: 0 });
  const [validationOn, setValidationOn] = useState(true);
  const [togglingValidation, setTogglingValidation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [ageRange, setAgeRange] = useState({ min: 18, max: 40 });
  const [vibeMatchingId, setVibeMatchingId] = useState<number | null>(null);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await apiCall({ action: "getDashboard" });
      if (res.ok) {
        const data = await res.json();
        setTodayCheckins(data.todayCheckins || []);
        setTodayCheckouts(data.todayCheckouts || []);
        setStats(data.stats || { total: 0, occupied: 0, available: 0, cleanup: 0 });
        setValidationOn(data.validationEnabled !== false);
        if (data.guestMinAge || data.guestMaxAge) {
          setAgeRange({ min: data.guestMinAge || 18, max: data.guestMaxAge || 40 });
        }
      }
    } finally { setLoading(false); }
  };

  const toggleValidation = async () => {
    setTogglingValidation(true);
    try {
      const newValue = validationOn ? "off" : "on";
      const res = await apiCall({ action: "setSetting", key: "image_validation", value: newValue });
      if (res.ok) setValidationOn(!validationOn);
    } finally { setTogglingValidation(false); }
  };

  const [checkoutModal, setCheckoutModal] = useState<{
    bedIdx: number; name: string; pendingTab: number; pendingOrders: number; checkinId: number | null; contact: string;
  } | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const foodApiCall = useCallback(async (body: Record<string, any>) => {
    const payload: Record<string, any> = { password, ...body };
    if (username) payload.username = username;
    return fetch("/api/admin/food-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  }, [password, username]);

  const handleCheckoutClick = (co: typeof todayCheckouts[0]) => {
    if (co.pendingTab > 0) {
      setCheckoutModal({ bedIdx: co.bedIdx, name: co.name, pendingTab: co.pendingTab, pendingOrders: co.pendingOrders, checkinId: co.checkinId, contact: co.contact });
    } else {
      doCheckout(co.bedIdx);
    }
  };

  const doCheckout = async (bedIdx: number) => {
    setBusyIdx(bedIdx);
    setCheckoutBusy(true);
    try {
      const res = await apiCall({ action: "checkoutBed", bedId: bedIdx });
      if (res.ok) { setCheckoutModal(null); await loadDashboard(); }
    } finally { setBusyIdx(null); setCheckoutBusy(false); }
  };

  const handleCheckoutWithPayment = async (method: string) => {
    if (!checkoutModal || !checkoutModal.checkinId) return;
    setCheckoutBusy(true);
    try {
      const tabRes = await foodApiCall({ action: "getGuestTab", checkinId: checkoutModal.checkinId });
      if (tabRes.ok) {
        const tabData = await tabRes.json();
        const orderIds = (tabData.orders || []).map((o: any) => o.id);
        if (orderIds.length > 0) {
          await foodApiCall({ action: "markOrderPaid", orderIds, paymentMethod: method });
        }
      }
      await doCheckout(checkoutModal.bedIdx);
    } catch {
      setCheckoutBusy(false);
    }
  };

  const handleVibeMatch = async (checkinId: number) => {
    setVibeMatchingId(checkinId);
    try {
      const res = await apiCall({ action: "markVibeMatched", checkinId });
      if (res.ok) {
        setTodayCheckins((prev) =>
          prev.map((item) =>
            item.row[15] === String(checkinId) ? { ...item, vibeMatched: 1 } : item
          )
        );
      }
    } finally { setVibeMatchingId(null); }
  };

  const today = new Date().toISOString().split("T")[0];

  if (loading) {
    return <AdminLoading message="Loading dashboard..." />;
  }

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-brand-green md:text-2xl">Dashboard</h2>
      <p className="mt-1 text-sm text-brand-green-dark/60">{today}</p>

      {/* Stats cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-brand-mist bg-white p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50"><UsersIcon className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold text-brand-green-dark">{todayCheckins.length}</p>
              <p className="text-xs text-brand-green-dark/60">Check-ins today</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-brand-mist bg-white p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50"><CalendarCheckIcon className="h-5 w-5 text-orange-600" /></div>
            <div>
              <p className="text-2xl font-bold text-brand-green-dark">{todayCheckouts.length}</p>
              <p className="text-xs text-brand-green-dark/60">Checkouts due today</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-brand-mist bg-white p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50"><BedDoubleIcon className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-2xl font-bold text-brand-green-dark">{stats.available}</p>
              <p className="text-xs text-brand-green-dark/60">Beds available</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-brand-mist bg-white p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50"><BedDoubleIcon className="h-5 w-5 text-red-600" /></div>
            <div>
              <p className="text-2xl font-bold text-brand-green-dark">{stats.occupied}/{stats.total}</p>
              <p className="text-xs text-brand-green-dark/60">Beds occupied</p>
            </div>
          </div>
        </div>
      </div>

      {/* Occupancy bar */}
      {stats.total > 0 && (
        <div className="mt-4 rounded-xl border border-brand-mist bg-white p-4">
          <div className="flex items-center justify-between text-xs text-brand-green-dark/70">
            <span>Occupancy: {Math.round((stats.occupied / stats.total) * 100)}%</span>
            <span>{stats.occupied} occupied, {stats.available} available, {stats.cleanup} cleanup</span>
          </div>
          <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-gray-100">
            {stats.occupied > 0 && <div className="bg-red-400" style={{ width: `${(stats.occupied / stats.total) * 100}%` }} />}
            {stats.cleanup > 0 && <div className="bg-orange-400" style={{ width: `${(stats.cleanup / stats.total) * 100}%` }} />}
            {stats.available > 0 && <div className="bg-green-400" style={{ width: `${(stats.available / stats.total) * 100}%` }} />}
          </div>
        </div>
      )}

      {/* Checkouts due */}
      {todayCheckouts.length > 0 && (
        <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="h-5 w-5 text-orange-600" />
            <span className="font-medium text-orange-800">{todayCheckouts.length} guest{todayCheckouts.length !== 1 ? "s" : ""} due for checkout</span>
          </div>
          <div className="mt-2 space-y-2">
            {todayCheckouts.map((co, i) => (
              <div key={i} className="rounded-lg bg-white px-3 py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-brand-green-dark">{co.name}</span>
                    <span className="ml-2 text-xs text-brand-green-dark/50">{co.dorm} / {co.bedId}</span>
                  </div>
                  <button type="button" onClick={() => handleCheckoutClick(co)} disabled={busyIdx === co.bedIdx}
                    className="flex items-center gap-1 rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50">
                    {busyIdx === co.bedIdx ? <Loader2Icon className="h-3 w-3 animate-spin" /> : <LogOutIcon className="h-3 w-3" />}
                    Checkout
                  </button>
                </div>
                {co.totalOrders > 0 && (
                  <div className="mt-1.5 flex items-center gap-3 text-xs">
                    {co.pendingTab > 0 ? (
                      <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">
                        ₹{(co.pendingTab / 100).toFixed(0)} pending
                        <span className="font-normal text-red-500">({co.pendingOrders} order{co.pendingOrders !== 1 ? "s" : ""})</span>
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-700">All paid</span>
                    )}
                    {co.paidTotal > 0 && (
                      <span className="text-brand-green-dark/40">₹{(co.paidTotal / 100).toFixed(0)} paid</span>
                    )}
                    {co.contact && (
                      <a
                        href={`/my-bills?phone=${encodeURIComponent(co.contact)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 font-medium text-blue-600 hover:text-blue-800"
                      >
                        View Bills <ExternalLinkIcon className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's check-ins */}
      <div className="mt-6">
        <h3 className="font-display text-lg font-bold text-brand-green-dark">Today&apos;s Check-ins</h3>
        {todayCheckins.length === 0 ? (
          <p className="mt-2 text-sm text-brand-green-dark/50">No check-ins today yet</p>
        ) : (
          <div className="mt-3 space-y-2">
            {todayCheckins.map((item, i) => {
              const age = getAgeFromDob(item.dob);
              const isFlagged = age !== null && !item.vibeMatched && (age < ageRange.min || age > ageRange.max);
              const isUnderage = age !== null && age < ageRange.min;
              const hasDobMismatch = !!(item.dob && item.dobFromId && !item.vibeMatched && !dobsMatch(item.dob, item.dobFromId));
              const isAnyFlagged = isFlagged || hasDobMismatch;
              const checkinId = parseInt(item.row[15]);
              return (
              <div key={i} className={cn("flex items-center justify-between rounded-xl border bg-white px-4 py-3", isAnyFlagged ? "border-orange-300 bg-orange-50/40" : "border-brand-mist")}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-brand-green-dark">{item.row[3]}</p>
                    {item.row[14] === "yes" ? (
                      <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-semibold text-green-700">ID verified</span>
                    ) : item.row[14] === "no" ? (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold text-red-700">ID rejected</span>
                    ) : item.row[14] === "spoof_warning" ? (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">Possibly fake ID</span>
                    ) : !item.row[14] || item.row[14] === "pending" ? (
                      <span className="rounded-full bg-yellow-100 px-1.5 py-0.5 text-[9px] font-semibold text-yellow-700">ID pending</span>
                    ) : null}
                    {isFlagged && (
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold", isUnderage ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700")}>
                        {isUnderage ? `Underage (${age})` : `Overage (${age})`}
                      </span>
                    )}
                    {hasDobMismatch && (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold text-red-700">DOB mismatch</span>
                    )}
                    {item.vibeMatched === 1 && (
                      (age !== null && (age < ageRange.min || age > ageRange.max)) ||
                      (item.dob && item.dobFromId && !dobsMatch(item.dob, item.dobFromId))
                    ) && (
                      <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-semibold text-green-700">Vibe OK</span>
                    )}
                  </div>
                  <p className="text-xs text-brand-green-dark/60">{item.row[7]}, {item.row[8]} · {item.row[4]} person{item.row[4] !== "1" ? "s" : ""} · {item.row[6]} days</p>
                </div>
                <div className="flex items-center gap-3">
                  {isAnyFlagged && (
                    <button
                      type="button"
                      onClick={() => handleVibeMatch(checkinId)}
                      disabled={vibeMatchingId === checkinId}
                      className="flex items-center gap-1 rounded-md bg-green-100 px-2.5 py-1 text-[11px] font-medium text-green-700 hover:bg-green-200 disabled:opacity-50"
                    >
                      <CheckCircleIcon className="h-3 w-3" />
                      {vibeMatchingId === checkinId ? "..." : "Vibe Matches"}
                    </button>
                  )}
                  {item.assignedBed ? (
                    <span className="rounded-full bg-brand-green/10 px-2.5 py-1 text-[11px] font-semibold text-brand-green">
                      {item.assignedBed}
                    </span>
                  ) : (
                    <button type="button" onClick={() => onNavigate("beds")}
                      className="rounded-md bg-blue-100 px-3 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-200">
                      Assign bed
                    </button>
                  )}
                  <span className="text-xs text-brand-green-dark/40">{item.row[2]}</span>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={() => onNavigate("beds")} className="rounded-xl border border-brand-mist bg-white p-4 text-left transition-all hover:shadow-soft">
          <BedDoubleIcon className="h-5 w-5 text-brand-green" />
          <p className="mt-2 font-medium text-brand-green-dark">Assign Beds</p>
          <p className="text-xs text-brand-green-dark/50">Manage dorm assignments</p>
        </button>
        <button type="button" onClick={() => onNavigate("records")} className="rounded-xl border border-brand-mist bg-white p-4 text-left transition-all hover:shadow-soft">
          <UsersIcon className="h-5 w-5 text-brand-green" />
          <p className="mt-2 font-medium text-brand-green-dark">View Records</p>
          <p className="text-xs text-brand-green-dark/50">All check-in entries</p>
        </button>
        {role === "admin" && (
          <button type="button" onClick={() => onNavigate("management")} className="rounded-xl border border-brand-mist bg-white p-4 text-left transition-all hover:shadow-soft">
            <BedDoubleIcon className="h-5 w-5 text-brand-green" />
            <p className="mt-2 font-medium text-brand-green-dark">Dorm Setup</p>
            <p className="text-xs text-brand-green-dark/50">Configure beds and dorms</p>
          </button>
        )}
      </div>

      {/* Validation toggle (admin only) */}
      {role === "admin" && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-brand-mist bg-white px-4 py-3">
          <span className="text-sm font-medium text-brand-green-dark">ID Validation (Vision API)</span>
          <button type="button" onClick={toggleValidation} disabled={togglingValidation}
            className={cn("relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200", validationOn ? "bg-brand-green" : "bg-brand-green-dark/20")}>
            <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 mt-0.5", validationOn ? "translate-x-5" : "translate-x-0.5")} />
          </button>
          <span className={cn("text-xs font-semibold", validationOn ? "text-brand-green" : "text-brand-green-dark/40")}>
            {togglingValidation ? "..." : validationOn ? "ON" : "OFF"}
          </span>
        </div>
      )}

      {/* Checkout confirmation modal */}
      {checkoutModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !checkoutBusy && setCheckoutModal(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-brand-mist px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-brand-green-dark">Checkout {checkoutModal.name}</h3>
                <p className="text-xs text-brand-green-dark/50">Unpaid food tab</p>
              </div>
              <button type="button" onClick={() => !checkoutBusy && setCheckoutModal(null)} className="rounded-lg p-1.5 hover:bg-brand-sand">
                <XIcon className="h-5 w-5 text-brand-green-dark/60" />
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                <p className="text-sm text-red-800">This guest has an unpaid food tab of</p>
                <p className="mt-1 text-2xl font-bold text-red-700">₹{(checkoutModal.pendingTab / 100).toFixed(0)}</p>
                <p className="mt-1 text-xs text-red-600">{checkoutModal.pendingOrders} unpaid order{checkoutModal.pendingOrders !== 1 ? "s" : ""}</p>
              </div>

              <p className="mt-4 text-sm font-medium text-brand-green-dark">Record payment & checkout:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleCheckoutWithPayment("cash")}
                  disabled={checkoutBusy}
                  className="flex items-center gap-1.5 rounded-lg border border-green-500 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                >
                  <BanknoteIcon className="h-4 w-4" /> Pay Cash & Checkout
                </button>
                <button
                  type="button"
                  onClick={() => handleCheckoutWithPayment("online")}
                  disabled={checkoutBusy}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-500 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                  <SmartphoneIcon className="h-4 w-4" /> Pay Online & Checkout
                </button>
              </div>

              <div className="mt-4 border-t border-brand-mist pt-3">
                <button
                  type="button"
                  onClick={() => doCheckout(checkoutModal.bedIdx)}
                  disabled={checkoutBusy}
                  className="w-full rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {checkoutBusy ? "Processing..." : "Checkout without payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
