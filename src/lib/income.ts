export const INCOME_SOURCES = ["stay", "food", "refund", "other"] as const;

export type ManualIncomeInput = {
  date?: unknown;
  accountId?: unknown;
  type?: unknown;
  amount?: unknown;
  source?: unknown;
  sourceDetail?: unknown;
  description?: unknown;
};

export type ValidManualIncome = {
  date: string;
  accountId: number | null;
  type: "cash" | "online";
  amount: number;
  source: typeof INCOME_SOURCES[number];
  sourceDetail: string;
  description: string;
};

export function validateManualIncome(input: ManualIncomeInput): { value: ValidManualIncome; error?: never } | { value?: never; error: string } {
  const date = String(input.date || "");
  const parsedDate = new Date(date + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return { error: "A valid date is required" };

  if (!Number.isInteger(input.amount) || Number(input.amount) <= 0) return { error: "Amount must be a positive integer in paise" };
  const source = String(input.source || "stay").trim().toLowerCase();
  if (!INCOME_SOURCES.includes(source as typeof INCOME_SOURCES[number])) return { error: "Invalid income source" };
  const sourceDetail = String(input.sourceDetail || "").trim();
  const description = String(input.description || "").trim();
  if (source === "other" && !sourceDetail) return { error: "Specify the other income source" };
  if (source !== "other" && sourceDetail) return { error: "Source detail is only valid for Other income" };
  if (sourceDetail.length > 100 || description.length > 500) return { error: "Source detail or description is too long" };

  if (input.type !== "cash" && input.type !== "online") return { error: "Type must be cash or online" };
  const accountId = input.accountId == null || input.accountId === "" ? null : Number(input.accountId);
  if (input.type === "cash" && accountId !== null) return { error: "Cash income must use the Cash account" };
  if (input.type === "online" && (!Number.isInteger(accountId) || accountId! <= 0)) return { error: "Select an account for online income" };

  return { value: {
    date,
    accountId,
    type: input.type,
    amount: Number(input.amount),
    source: source as ValidManualIncome["source"],
    sourceDetail: source === "other" ? sourceDetail : "",
    description,
  } };
}
