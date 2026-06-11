"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  Loader2Icon,
  BanknoteIcon,
  UsersIcon,
  StoreIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminLoading } from "./AdminLoading";
import type { Role } from "./types";

type Account = {
  id: number; name: string; nickname: string; bankName: string;
  accountType: string; accountNumber: string; ifscCode: string;
  isDefault: number; isActive: number; openingBalance: number; createdAt: string;
};

type Vendor = {
  id: number; name: string; category: string; contactPhone: string;
  notes: string; isActive: number; createdAt: string;
};

type Employee = {
  id: number; name: string; role: string; phone: string;
  salary: number; salaryFrequency: string; bankAccount: string;
  isActive: number; createdAt: string;
};

const VENDOR_CATEGORIES = [
  "Groceries", "Utilities", "Maintenance", "Supplies", "Transport", "Capital", "Rent", "Miscellaneous", "Others",
];

const ACCOUNT_TYPES = [
  { id: "savings", label: "Savings" },
  { id: "current", label: "Current" },
  { id: "cash", label: "Cash" },
];

type SettingsSection = "accounts" | "employees" | "vendors";

export function AccountSettings({ password, username, role }: { password: string; username?: string; role: Role }) {
  const [section, setSection] = useState<SettingsSection>("accounts");
  const [loading, setLoading] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [formData, setFormData] = useState<Record<string, string>>({});

  const apiCall = useCallback(async (body: Record<string, any>) => {
    const payload: Record<string, any> = { password, ...body };
    if (username) payload.username = username;
    return fetch("/api/admin/account-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }, [password, username]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [accRes, venRes, empRes] = await Promise.all([
        apiCall({ action: "listAccounts" }),
        apiCall({ action: "listVendors" }),
        apiCall({ action: "listEmployees" }),
      ]);
      if (accRes.ok) { const d = await accRes.json(); setAccounts(d.accounts || []); }
      if (venRes.ok) { const d = await venRes.json(); setVendors(d.vendors || []); }
      if (empRes.ok) { const d = await empRes.json(); setEmployees(d.employees || []); }
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => { setFormData({}); setEditing(null); setShowForm(false); };

  const startAdd = () => { resetForm(); setShowForm(true); };

  const startEdit = (item: any) => {
    setEditing(item);
    const data: Record<string, string> = {};
    Object.entries(item).forEach(([k, v]) => { data[k] = v != null ? String(v) : ""; });
    if (section === "accounts" && item.openingBalance != null) {
      data.openingBalance = (item.openingBalance / 100).toFixed(2);
    }
    if (section === "employees" && item.salary != null) {
      data.salary = (item.salary / 100).toFixed(2);
    }
    setFormData(data);
    setShowForm(true);
  };

  const saveItem = async () => {
    setSaving(true);
    try {
      let action = "";
      const payload: Record<string, any> = { ...formData };

      if (section === "accounts") {
        action = editing ? "updateAccount" : "addAccount";
        if (payload.openingBalance) payload.openingBalance = Math.round(parseFloat(payload.openingBalance) * 100);
        if (editing) payload.id = editing.id;
      } else if (section === "vendors") {
        action = editing ? "updateVendor" : "addVendor";
        if (editing) payload.id = editing.id;
      } else {
        action = editing ? "updateEmployee" : "addEmployee";
        if (payload.salary) payload.salary = Math.round(parseFloat(payload.salary) * 100);
        if (editing) payload.id = editing.id;
      }

      const res = await apiCall({ action, ...payload });
      if (res.ok) {
        resetForm();
        loadData();
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id: number) => {
    if (!confirm("Are you sure you want to delete this?")) return;
    const action = section === "accounts" ? "deleteAccount" : section === "vendors" ? "deleteVendor" : "deleteEmployee";
    await apiCall({ action, id });
    loadData();
  };

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) return <AdminLoading message="Loading settings..." />;

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex gap-1 rounded-lg border border-brand-mist bg-white p-1">
        {([
          { id: "accounts" as SettingsSection, label: "Accounts", icon: <BanknoteIcon className="h-3.5 w-3.5" /> },
          { id: "employees" as SettingsSection, label: "Employees", icon: <UsersIcon className="h-3.5 w-3.5" /> },
          { id: "vendors" as SettingsSection, label: "Vendors", icon: <StoreIcon className="h-3.5 w-3.5" /> },
        ]).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => { setSection(s.id); resetForm(); }}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
              section === s.id ? "bg-brand-green text-white" : "text-brand-green-dark/70 hover:bg-brand-green/[0.06]"
            )}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* List + Add button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-green-dark capitalize">{section} ({
          section === "accounts" ? accounts.length : section === "vendors" ? vendors.length : employees.length
        })</h3>
        <Button type="button" onClick={startAdd} className="h-7 gap-1 text-xs">
          <PlusIcon className="h-3 w-3" /> Add
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-brand-mist bg-white p-4 sm:p-5 space-y-4">
          <h4 className="text-sm font-semibold text-brand-green-dark">{editing ? "Edit" : "Add"} {section.slice(0, -1)}</h4>

          {section === "accounts" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Account Name *</Label>
                <Input value={formData.name || ""} onChange={(e) => updateField("name", e.target.value)} className="mt-1 h-8 text-xs" placeholder="e.g. Primary Account" />
              </div>
              <div>
                <Label className="text-xs">Nickname</Label>
                <Input value={formData.nickname || ""} onChange={(e) => updateField("nickname", e.target.value)} className="mt-1 h-8 text-xs" placeholder="e.g. Main" />
              </div>
              <div>
                <Label className="text-xs">Bank Name</Label>
                <Input value={formData.bankName || ""} onChange={(e) => updateField("bankName", e.target.value)} className="mt-1 h-8 text-xs" placeholder="e.g. SBI" />
              </div>
              <div>
                <Label className="text-xs">Account Type</Label>
                <select value={formData.accountType || "savings"} onChange={(e) => updateField("accountType", e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs">
                  {ACCOUNT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Account Number</Label>
                <Input value={formData.accountNumber || ""} onChange={(e) => updateField("accountNumber", e.target.value)} className="mt-1 h-8 text-xs" placeholder="Optional" />
              </div>
              <div>
                <Label className="text-xs">IFSC Code</Label>
                <Input value={formData.ifscCode || ""} onChange={(e) => updateField("ifscCode", e.target.value)} className="mt-1 h-8 text-xs" placeholder="Optional" />
              </div>
              <div>
                <Label className="text-xs">Opening Balance (₹)</Label>
                <Input type="number" step="0.01" value={formData.openingBalance || ""} onChange={(e) => updateField("openingBalance", e.target.value)} className="mt-1 h-8 text-xs" placeholder="0.00" />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" checked={formData.isDefault === "1"} onChange={(e) => updateField("isDefault", e.target.checked ? "1" : "0")} className="accent-brand-green" />
                <span className="text-xs text-brand-green-dark/70">Default account for online payments</span>
              </div>
            </div>
          )}

          {section === "vendors" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Vendor Name *</Label>
                <Input value={formData.name || ""} onChange={(e) => updateField("name", e.target.value)} className="mt-1 h-8 text-xs" placeholder="e.g. Chicken Shop" />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <select value={formData.category || ""} onChange={(e) => updateField("category", e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs">
                  <option value="">Select category</option>
                  {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Contact Phone</Label>
                <Input value={formData.contactPhone || ""} onChange={(e) => updateField("contactPhone", e.target.value)} className="mt-1 h-8 text-xs" placeholder="Optional" />
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Input value={formData.notes || ""} onChange={(e) => updateField("notes", e.target.value)} className="mt-1 h-8 text-xs" placeholder="Optional notes" />
              </div>
            </div>
          )}

          {section === "employees" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Name *</Label>
                <Input value={formData.name || ""} onChange={(e) => updateField("name", e.target.value)} className="mt-1 h-8 text-xs" placeholder="Employee name" />
              </div>
              <div>
                <Label className="text-xs">Role</Label>
                <Input value={formData.role || ""} onChange={(e) => updateField("role", e.target.value)} className="mt-1 h-8 text-xs" placeholder="e.g. Cook, Cleaner" />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input value={formData.phone || ""} onChange={(e) => updateField("phone", e.target.value)} className="mt-1 h-8 text-xs" placeholder="Optional" />
              </div>
              <div>
                <Label className="text-xs">Salary (₹)</Label>
                <Input type="number" step="0.01" value={formData.salary || ""} onChange={(e) => updateField("salary", e.target.value)} className="mt-1 h-8 text-xs" placeholder="Monthly salary" />
              </div>
              <div>
                <Label className="text-xs">Frequency</Label>
                <select value={formData.salaryFrequency || "monthly"} onChange={(e) => updateField("salaryFrequency", e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs">
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Bank Account (for reference)</Label>
                <Input value={formData.bankAccount || ""} onChange={(e) => updateField("bankAccount", e.target.value)} className="mt-1 h-8 text-xs" placeholder="Optional" />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" onClick={saveItem} disabled={saving} className="h-8 gap-1.5 text-xs">
              {saving ? <Loader2Icon className="h-3 w-3 animate-spin" /> : null}
              {editing ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm} className="h-8 text-xs">Cancel</Button>
          </div>
        </div>
      )}

      {/* Items List */}
      <div className="space-y-2">
        {section === "accounts" && accounts.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-xl border border-brand-mist bg-white p-3 sm:p-4">
            <div>
              <p className="text-sm font-medium text-brand-green-dark">
                {a.name} {a.nickname && <span className="text-brand-green-dark/50">({a.nickname})</span>}
                {a.isDefault ? <span className="ml-2 rounded bg-brand-green/10 px-1.5 py-0.5 text-[10px] text-brand-green">Default</span> : null}
              </p>
              <p className="text-[10px] text-brand-green-dark/50">
                {a.bankName && `${a.bankName} · `}{a.accountType}{a.accountNumber && ` · ****${a.accountNumber.slice(-4)}`}
              </p>
              <p className="text-[10px] text-brand-green-dark/40">Opening: ₹{(a.openingBalance / 100).toFixed(0)}</p>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => startEdit(a)} className="rounded-md p-1.5 text-brand-green-dark/40 hover:bg-brand-sand hover:text-brand-green"><PencilIcon className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => deleteItem(a.id)} className="rounded-md p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"><Trash2Icon className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}

        {section === "vendors" && vendors.map((v) => (
          <div key={v.id} className="flex items-center justify-between rounded-xl border border-brand-mist bg-white p-3 sm:p-4">
            <div>
              <p className="text-sm font-medium text-brand-green-dark">{v.name}</p>
              <p className="text-[10px] text-brand-green-dark/50">
                {v.category && `${v.category} · `}{v.contactPhone || "No phone"}
              </p>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => startEdit(v)} className="rounded-md p-1.5 text-brand-green-dark/40 hover:bg-brand-sand hover:text-brand-green"><PencilIcon className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => deleteItem(v.id)} className="rounded-md p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"><Trash2Icon className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}

        {section === "employees" && employees.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-xl border border-brand-mist bg-white p-3 sm:p-4">
            <div>
              <p className="text-sm font-medium text-brand-green-dark">{e.name}</p>
              <p className="text-[10px] text-brand-green-dark/50">
                {e.role && `${e.role} · `}₹{(e.salary / 100).toFixed(0)}/{e.salaryFrequency}{e.phone && ` · ${e.phone}`}
              </p>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => startEdit(e)} className="rounded-md p-1.5 text-brand-green-dark/40 hover:bg-brand-sand hover:text-brand-green"><PencilIcon className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => deleteItem(e.id)} className="rounded-md p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"><Trash2Icon className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}

        {((section === "accounts" && accounts.length === 0) || (section === "vendors" && vendors.length === 0) || (section === "employees" && employees.length === 0)) && (
          <p className="py-8 text-center text-sm text-brand-green-dark/50">No {section} configured yet.</p>
        )}
      </div>
    </div>
  );
}
