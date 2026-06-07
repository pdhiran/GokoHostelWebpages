"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminLoading } from "./AdminLoading";
import { cn } from "@/lib/utils";
import { SaveIcon, RefreshCwIcon } from "lucide-react";
import type { Role } from "./types";

type FoodSettings = {
  food_kitchen_whatsapp: string;
  food_tax_rate: string;
  food_kitchen_open: string;
  food_kitchen_close: string;
  food_tab_limit: string;
  food_kitchen_busy: string;
};

const DEFAULT_SETTINGS: FoodSettings = {
  food_kitchen_whatsapp: "",
  food_tax_rate: "5",
  food_kitchen_open: "07:00",
  food_kitchen_close: "22:00",
  food_tab_limit: "0",
  food_kitchen_busy: "false",
};

function paiseToRupees(paise: string): string {
  const p = parseInt(paise) || 0;
  if (p === 0) return "0";
  return (p / 100).toFixed(2).replace(/\.00$/, "");
}

function rupeesToPaise(rupees: string): string {
  const num = parseFloat(rupees.replace(/[^\d.]/g, ""));
  if (isNaN(num)) return "0";
  return String(Math.round(num * 100));
}

export function AdminFoodSettings({ password, username, role }: { password: string; username?: string; role: Role }) {
  const [settings, setSettings] = useState<FoodSettings>({ ...DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedSettings, setSavedSettings] = useState<FoodSettings>({ ...DEFAULT_SETTINGS });

  const apiCall = useCallback(async (body: Record<string, any>) => {
    const payload: Record<string, any> = { password, ...body };
    if (username) payload.username = username;
    return fetch("/api/admin/food", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }, [password, username]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall({ action: "getFoodSettings" });
      if (res.ok) {
        const data = await res.json();
        const s = data.settings || {};
        const merged: FoodSettings = {
          food_kitchen_whatsapp: s.food_kitchen_whatsapp || DEFAULT_SETTINGS.food_kitchen_whatsapp,
          food_tax_rate: s.food_tax_rate || DEFAULT_SETTINGS.food_tax_rate,
          food_kitchen_open: s.food_kitchen_open || DEFAULT_SETTINGS.food_kitchen_open,
          food_kitchen_close: s.food_kitchen_close || DEFAULT_SETTINGS.food_kitchen_close,
          food_tab_limit: s.food_tab_limit || DEFAULT_SETTINGS.food_tab_limit,
          food_kitchen_busy: s.food_kitchen_busy || DEFAULT_SETTINGS.food_kitchen_busy,
        };
        setSettings(merged);
        setSavedSettings(merged);
        setDirty(false);
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const updateField = (key: keyof FoodSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const res = await apiCall({
        action: "updateFoodSettings",
        settings: {
          ...settings,
        },
      });
      if (res.ok) {
        setSavedSettings({ ...settings });
        setDirty(false);
      } else {
        const d = await res.json();
        alert(d.error || "Failed to save settings");
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleBusyMode = async () => {
    const newValue = settings.food_kitchen_busy === "true" ? "false" : "true";
    setSaving(true);
    try {
      const res = await apiCall({
        action: "updateFoodSettings",
        settings: { food_kitchen_busy: newValue },
      });
      if (res.ok) {
        setSettings((prev) => ({ ...prev, food_kitchen_busy: newValue }));
        setSavedSettings((prev) => ({ ...prev, food_kitchen_busy: newValue }));
      } else {
        const d = await res.json();
        alert(d.error || "Failed to toggle");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLoading message="Loading food settings..." />;

  const isBusy = settings.food_kitchen_busy === "true";
  const tabLimitRupees = paiseToRupees(settings.food_tab_limit);

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-brand-green md:text-2xl">Food Settings</h2>
      <p className="mt-1 text-sm text-brand-green-dark/60">Configure kitchen hours, tax, and ordering settings.</p>

      {/* Kitchen Busy Mode - prominent toggle */}
      <div className={cn(
        "mt-6 rounded-2xl border p-5 shadow-card transition-colors",
        isBusy ? "border-red-300 bg-red-50" : "border-brand-mist bg-white"
      )}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-brand-green-dark">Kitchen Busy Mode</h3>
            <p className="mt-0.5 text-xs text-brand-green-dark/50">
              {isBusy
                ? "Kitchen is BUSY — new orders are paused. Guests see a busy message."
                : "Kitchen is accepting orders normally."}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleBusyMode}
            disabled={saving}
            className={cn(
              "relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
              isBusy ? "bg-red-500" : "bg-gray-200"
            )}
          >
            <span className={cn(
              "pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
              isBusy ? "translate-x-6" : "translate-x-0"
            )} />
          </button>
        </div>
      </div>

      {/* Settings Form */}
      <div className="mt-6 rounded-2xl border border-brand-mist bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-brand-green-dark">Settings</h3>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={loadSettings} disabled={loading}>
              <RefreshCwIcon className="mr-1 h-3.5 w-3.5" /> Reload
            </Button>
            <Button type="button" variant="cta" size="sm" onClick={saveAll} disabled={saving || !dirty}>
              <SaveIcon className="mr-1 h-3.5 w-3.5" /> Save All
            </Button>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {/* Kitchen WhatsApp */}
          <div className="grid gap-1.5 sm:grid-cols-3 sm:items-center">
            <div>
              <Label className="text-sm font-medium text-brand-green-dark">Kitchen WhatsApp Number</Label>
              <p className="text-[11px] text-brand-green-dark/40">For order notifications to kitchen staff</p>
            </div>
            <div className="sm:col-span-2">
              <Input
                value={settings.food_kitchen_whatsapp}
                onChange={(e) => updateField("food_kitchen_whatsapp", e.target.value)}
                placeholder="e.g. 919876543210"
                className="max-w-xs"
              />
            </div>
          </div>

          <hr className="border-brand-mist" />

          {/* Tax Rate */}
          <div className="grid gap-1.5 sm:grid-cols-3 sm:items-center">
            <div>
              <Label className="text-sm font-medium text-brand-green-dark">Tax Rate (%)</Label>
              <p className="text-[11px] text-brand-green-dark/40">Applied to food order subtotals</p>
            </div>
            <div className="sm:col-span-2">
              <div className="relative max-w-[120px]">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={settings.food_tax_rate}
                  onChange={(e) => updateField("food_tax_rate", e.target.value)}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-brand-green-dark/40">%</span>
              </div>
            </div>
          </div>

          <hr className="border-brand-mist" />

          {/* Kitchen Hours */}
          <div className="grid gap-1.5 sm:grid-cols-3 sm:items-center">
            <div>
              <Label className="text-sm font-medium text-brand-green-dark">Kitchen Hours</Label>
              <p className="text-[11px] text-brand-green-dark/40">Orders only accepted during these hours</p>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Input
                type="time"
                value={settings.food_kitchen_open}
                onChange={(e) => updateField("food_kitchen_open", e.target.value)}
                className="w-32"
              />
              <span className="text-xs text-brand-green-dark/40">to</span>
              <Input
                type="time"
                value={settings.food_kitchen_close}
                onChange={(e) => updateField("food_kitchen_close", e.target.value)}
                className="w-32"
              />
            </div>
          </div>

          <hr className="border-brand-mist" />

          {/* Tab Spending Limit */}
          <div className="grid gap-1.5 sm:grid-cols-3 sm:items-center">
            <div>
              <Label className="text-sm font-medium text-brand-green-dark">Tab Spending Limit</Label>
              <p className="text-[11px] text-brand-green-dark/40">Max tab amount per guest (0 = no limit)</p>
            </div>
            <div className="sm:col-span-2">
              <div className="relative max-w-[160px]">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-green-dark/50">₹</span>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={tabLimitRupees}
                  onChange={(e) => updateField("food_tab_limit", rupeesToPaise(e.target.value))}
                  className="pl-7"
                />
              </div>
              {parseInt(settings.food_tab_limit) > 0 && (
                <p className="mt-0.5 text-[10px] text-brand-green-dark/40">
                  Stored as {settings.food_tab_limit} paise
                </p>
              )}
            </div>
          </div>
        </div>

        {dirty && (
          <div className="mt-5 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <span className="font-medium">Unsaved changes</span> — click Save All to apply.
          </div>
        )}
      </div>
    </div>
  );
}
