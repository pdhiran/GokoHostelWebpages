import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, parseExpenseCategories, parseIncomeCategories } from "@/lib/accountCategories";
import { validateManualIncome } from "@/lib/income";

describe("account categories", () => {
  it("falls back to the existing expense and income options", () => {
    expect(parseExpenseCategories(null)).toEqual(DEFAULT_EXPENSE_CATEGORIES);
    expect(parseIncomeCategories("bad json")).toEqual(DEFAULT_INCOME_CATEGORIES);
  });

  it("accepts saved categories and custom income source ids", () => {
    expect(parseExpenseCategories('["Repairs"]')).toEqual(["Repairs"]);
    expect(parseIncomeCategories('[{"id":"Events","name":"Events"}]')).toEqual([{ id: "Events", name: "Events" }]);
    expect(validateManualIncome({ date: "2026-09-03", amount: 100, type: "cash", source: "Events" }, ["Events"]).value?.source).toBe("Events");
  });

  it("uses managed categories across settings, forms, records, and bulk imports", () => {
    const settings = readFileSync("src/components/admin/AccountSettings.tsx", "utf8");
    const expense = readFileSync("src/components/admin/AdminAddExpense.tsx", "utf8");
    const income = readFileSync("src/components/admin/IncomeForm.tsx", "utf8");
    const bulk = readFileSync("src/app/api/admin/bulk-import-accounts/route.ts", "utf8");
    expect(settings).toContain('label: "Categories"');
    expect(settings).toContain('action: "saveCategories"');
    expect(settings).toContain("{expenseCategories.map((c) => <option");
    expect(settings).not.toContain("VENDOR_CATEGORIES");
    expect(expense).toContain('action: "getExpenseCategories"');
    expect(income).toContain('action: "getIncomeCategories"');
    expect(bulk).toContain('getSetting("expense_categories")');
    expect(bulk).toContain('getSetting("income_categories")');
  });

  it("keeps the shared category module dependency-free", () => {
    const shared = readFileSync("src/lib/accountCategories.ts", "utf8");
    expect(shared).not.toMatch(/^import /m);
    expect(shared).not.toContain("components/admin");
    expect(shared).not.toContain("@/db");
  });
});
