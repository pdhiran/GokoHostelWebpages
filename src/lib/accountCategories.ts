export type IncomeCategory = { id: string; name: string };

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Salary", "Rent", "Utilities", "Groceries", "Capital",
  "Maintenance", "Supplies", "Transport", "Miscellaneous", "Others",
];

export const DEFAULT_INCOME_CATEGORIES: IncomeCategory[] = [
  { id: "stay", name: "Stay Revenue" },
  { id: "food", name: "Food Revenue" },
  { id: "refund", name: "Refund Received" },
  { id: "other", name: "Other" },
];

export function parseExpenseCategories(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value || "null");
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : DEFAULT_EXPENSE_CATEGORIES;
  } catch { return DEFAULT_EXPENSE_CATEGORIES; }
}

export function parseIncomeCategories(value: string | null | undefined): IncomeCategory[] {
  try {
    const parsed = JSON.parse(value || "null");
    return Array.isArray(parsed) && parsed.every((item) => typeof item?.id === "string" && typeof item?.name === "string") ? parsed : DEFAULT_INCOME_CATEGORIES;
  } catch { return DEFAULT_INCOME_CATEGORIES; }
}
