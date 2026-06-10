"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2Icon, ExternalLinkIcon, ImageIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminLoading } from "./AdminLoading";
import type { Role } from "./types";

const CATEGORIES = ["Groceries", "Utilities", "Maintenance", "Supplies", "Transport", "Wages", "Other"];

export function AdminAddExpense({
  password,
  username,
  role,
}: {
  password: string;
  username?: string;
  role: Role;
}) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [purpose, setPurpose] = useState("");
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billPreview, setBillPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const expenseApi = useCallback(async (body: Record<string, any>) => {
    const payload: Record<string, any> = { password, ...body };
    if (username) payload.username = username;
    return fetch("/api/admin/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }, [password, username]);

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const res = await expenseApi({ action: "getMyExpenses" });
      if (res.ok) {
        const data = await res.json();
        setRecentExpenses(data.expenses || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingRecent(false);
    }
  }, [expenseApi]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setBillFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setBillPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setBillPreview(null);
    }
  };

  const clearFile = () => {
    setBillFile(null);
    setBillPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    if (!category) {
      setError("Please select a category");
      return;
    }
    if (category === "Other" && !customCategory.trim()) {
      setError("Please enter a custom category name");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, any> = {
        action: "addExpense",
        amount: Math.round(amountNum * 100),
        category: category === "Other" ? customCategory.trim() : category,
        customCategory: category === "Other" ? customCategory.trim() : undefined,
        purpose: purpose.trim(),
      };

      if (billFile) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.readAsDataURL(billFile);
        });
        body.billImageFile = base64;
        body.billImageName = billFile.name || `bill_${Date.now()}.jpg`;
        body.billImageMime = billFile.type;
      }

      const res = await expenseApi(body);
      if (res.ok) {
        setSuccess("Expense submitted successfully!");
        setAmount("");
        setCategory("");
        setCustomCategory("");
        setPurpose("");
        clearFile();
        loadRecent();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to submit expense");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="rounded-2xl border border-brand-mist bg-white p-5 shadow-card">
        <h3 className="font-display text-lg font-bold text-brand-green-dark">Add Expense</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Amount (₹)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 500"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select category...</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {category === "Other" && (
            <div className="sm:col-span-2">
              <Label className="text-xs">Custom Category Name</Label>
              <Input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Enter category name"
                className="mt-1"
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <Label className="text-xs">Purpose / Notes</Label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Describe the expense..."
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Bill Photo (optional)</Label>
            <div className="mt-1 flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-brand-sand/50">
                <ImageIcon className="h-4 w-4 text-brand-green" />
                {billFile ? "Change photo" : "Choose photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              {billFile && (
                <button type="button" onClick={clearFile} className="text-xs text-red-500 hover:text-red-700">
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            {billPreview && (
              <img
                src={billPreview}
                alt="Bill preview"
                className="mt-2 h-32 w-auto rounded-lg border border-brand-mist object-cover"
              />
            )}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        {success && <p className="mt-3 text-sm text-green-600">{success}</p>}

        <div className="mt-4">
          <Button type="submit" variant="cta" disabled={submitting}>
            {submitting ? (
              <><Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
            ) : (
              "Submit Expense"
            )}
          </Button>
        </div>
      </form>

      <div className="mt-8">
        <h3 className="font-display text-lg font-bold text-brand-green-dark">
          Your Recent Submissions (Last 7 Days)
        </h3>
        {loadingRecent ? (
          <AdminLoading message="Loading recent expenses..." />
        ) : recentExpenses.length === 0 ? (
          <p className="mt-4 text-center text-sm text-brand-green-dark/50">No submissions in the last 7 days</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-brand-mist bg-white shadow-card">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-mist bg-brand-sand/50">
                  <th className="whitespace-nowrap px-3 py-3 font-display text-xs font-bold uppercase tracking-wide text-brand-green-dark/70">Date</th>
                  <th className="whitespace-nowrap px-3 py-3 font-display text-xs font-bold uppercase tracking-wide text-brand-green-dark/70">Category</th>
                  <th className="whitespace-nowrap px-3 py-3 font-display text-xs font-bold uppercase tracking-wide text-brand-green-dark/70">Amount</th>
                  <th className="whitespace-nowrap px-3 py-3 font-display text-xs font-bold uppercase tracking-wide text-brand-green-dark/70">Purpose</th>
                  <th className="whitespace-nowrap px-3 py-3 font-display text-xs font-bold uppercase tracking-wide text-brand-green-dark/70">Bill</th>
                </tr>
              </thead>
              <tbody>
                {recentExpenses.map((exp: any, i: number) => (
                  <tr key={exp.id || i} className="border-b border-brand-mist/60 last:border-b-0 hover:bg-brand-sand/30">
                    <td className="whitespace-nowrap px-3 py-3 text-brand-green-dark/90">
                      {exp.createdAt ? new Date(exp.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-brand-green-dark/90">{exp.category || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-brand-green-dark">
                      ₹{(exp.amount / 100).toFixed(0)}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-3 text-brand-green-dark/70">{exp.purpose || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {exp.billImageLink ? (
                        <a
                          href={exp.billImageLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-brand-green/[0.06] px-2 py-1 text-xs font-medium text-brand-green hover:bg-brand-green/[0.12]"
                        >
                          View <ExternalLinkIcon className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-brand-green-dark/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
