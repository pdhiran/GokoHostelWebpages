/** Splitwise-style money kernel. All amounts are integer paise. Never use floats. */

export type ShareInput = {
  memberId: number;
  paidAmount: number;
  owedAmount: number;
};

export type ExpenseEvent = {
  id: number;
  deleted?: boolean;
  shares: ShareInput[];
};

export type SettlementEvent = {
  id: number;
  fromMemberId: number;
  toMemberId: number;
  amount: number;
  deleted?: boolean;
  hostelExpenseId?: number | null;
  splitExpenseId?: number | null;
};

export type SimplifyPayment = { from: number; to: number; amount: number };

export function rupeesToPaise(rupees: string | number): number {
  const n = typeof rupees === "number" ? rupees : Number(String(rupees).trim());
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

export function paiseToRupees(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;
  return `${sign}${rupees}.${String(rest).padStart(2, "0")}`;
}

function sortedUniqueIds(ids: number[]): number[] | null {
  const sorted = [...ids].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]) return null;
  }
  return sorted;
}

/** Remainder +1 paise goes to lowest memberId. */
export function allocateByWeights(
  totalPaise: number,
  weights: { memberId: number; weight: number }[],
): Map<number, number> {
  if (totalPaise <= 0) throw new Error("total must be positive");
  if (weights.length === 0) throw new Error("need at least one member");
  const ids = sortedUniqueIds(weights.map((w) => w.memberId));
  if (!ids) throw new Error("duplicate member");
  const byId = new Map(weights.map((w) => [w.memberId, w.weight]));
  const ordered = ids.filter((id) => (byId.get(id) ?? 0) > 0);
  if (ordered.length === 0) throw new Error("weights must be positive");
  let sumW = 0;
  for (const id of ordered) sumW += byId.get(id)!;
  if (sumW <= 0) throw new Error("weights must be positive");

  const out = new Map<number, number>();
  let allocated = 0;
  for (const id of ordered) {
    const raw = Math.floor((totalPaise * byId.get(id)!) / sumW);
    out.set(id, raw);
    allocated += raw;
  }
  let rem = totalPaise - allocated;
  for (const id of ordered) {
    if (rem <= 0) break;
    out.set(id, (out.get(id) ?? 0) + 1);
    rem--;
  }
  for (const id of ids) {
    if (!out.has(id)) out.set(id, 0);
  }
  return out;
}

export function allocateEqual(totalPaise: number, memberIds: number[]): Map<number, number> {
  return allocateByWeights(
    totalPaise,
    memberIds.map((memberId) => ({ memberId, weight: 1 })),
  );
}

/** basisPoints must sum to 10000 (100.00%). */
export function allocatePercent(
  totalPaise: number,
  percents: { memberId: number; basisPoints: number }[],
): Map<number, number> {
  const sum = percents.reduce((s, p) => s + p.basisPoints, 0);
  if (sum !== 10000) throw new Error("percentages must sum to 10000 basis points");
  return allocateByWeights(
    totalPaise,
    percents.map((p) => ({ memberId: p.memberId, weight: p.basisPoints })),
  );
}

export function allocateShares(
  totalPaise: number,
  shares: { memberId: number; shares: number }[],
): Map<number, number> {
  return allocateByWeights(
    totalPaise,
    shares.map((s) => ({ memberId: s.memberId, weight: s.shares })),
  );
}

/** If house paid anything, it must be sole payer and owed === total. */
export function assertGokoPayerRules(
  houseId: number | null | undefined,
  shares: ShareInput[],
  total: number,
): string | null {
  if (!houseId) return null;
  const house = shares.find((s) => s.memberId === houseId);
  if (!house || house.paidAmount <= 0) return null;
  const othersPaid = shares.filter((s) => s.memberId !== houseId).reduce((n, s) => n + s.paidAmount, 0);
  if (othersPaid > 0 || house.paidAmount !== total || house.owedAmount !== total) {
    return "When Goko pays, Goko must be the sole payer and Goko's share must equal the total";
  }
  return null;
}

export function assertBalanced(total: number, shares: ShareInput[]): string | null {
  if (!Number.isInteger(total) || total <= 0) return "total must be a positive integer";
  const seen = new Set<number>();
  let paid = 0;
  let owed = 0;
  for (const s of shares) {
    if (!Number.isInteger(s.memberId)) return "invalid member";
    if (seen.has(s.memberId)) return "duplicate member on expense";
    seen.add(s.memberId);
    if (!Number.isInteger(s.paidAmount) || s.paidAmount < 0) return "paid cannot be negative";
    if (!Number.isInteger(s.owedAmount) || s.owedAmount < 0) return "owed cannot be negative";
    paid += s.paidAmount;
    owed += s.owedAmount;
  }
  if (paid !== total) return "paid must sum to total";
  if (owed !== total) return "owed must sum to total";
  if (paid === 0) return "at least one payer required";
  return null;
}

export function netsFromEvents(
  expenses: ExpenseEvent[],
  settlements: SettlementEvent[],
): Map<number, number> {
  const nets = new Map<number, number>();
  const add = (id: number, delta: number) => {
    nets.set(id, (nets.get(id) ?? 0) + delta);
  };
  for (const e of expenses) {
    if (e.deleted) continue;
    for (const s of e.shares) {
      add(s.memberId, s.paidAmount - s.owedAmount);
    }
  }
  for (const st of settlements) {
    if (st.deleted) continue;
    add(st.fromMemberId, st.amount);
    add(st.toMemberId, -st.amount);
  }
  return nets;
}

export function overallNets(perGroup: Map<number, number>[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const g of perGroup) {
    for (const [id, n] of g) {
      out.set(id, (out.get(id) ?? 0) + n);
    }
  }
  return out;
}

export function simplifyDebts(nets: Map<number, number>): SimplifyPayment[] {
  const debtors: { id: number; amount: number }[] = [];
  const creditors: { id: number; amount: number }[] = [];
  for (const [id, n] of nets) {
    if (n < 0) debtors.push({ id, amount: -n });
    else if (n > 0) creditors.push({ id, amount: n });
  }
  const payments: SimplifyPayment[] = [];
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.amount - a.amount || a.id - b.id);
    creditors.sort((a, b) => b.amount - a.amount || a.id - b.id);
    const d = debtors[0];
    const c = creditors[0];
    const t = Math.min(d.amount, c.amount);
    payments.push({ from: d.id, to: c.id, amount: t });
    d.amount -= t;
    c.amount -= t;
    if (d.amount === 0) debtors.shift();
    if (c.amount === 0) creditors.shift();
  }
  return payments;
}

export function suggestionIncludes(
  suggestions: SimplifyPayment[],
  from: number,
  to: number,
): boolean {
  return suggestions.some((s) => s.from === from && s.to === to);
}

function sliceKey(expenseId: number, memberId: number): string {
  return `${expenseId}:${memberId}`;
}

/** Per-expense FIFO partition of Goko owed across human payers (memberId asc). */
export function allocateGokoAttribution(
  houseMemberId: number,
  expenses: ExpenseEvent[],
  reimbursements: SettlementEvent[],
): Map<string, number> {
  const remaining = new Map<string, number>();
  const live = expenses.filter((e) => !e.deleted).sort((a, b) => a.id - b.id);

  for (const e of live) {
    const gokoOwed = e.shares.find((s) => s.memberId === houseMemberId)?.owedAmount ?? 0;
    if (gokoOwed <= 0) continue;
    const payers = e.shares
      .filter((s) => s.memberId !== houseMemberId && s.paidAmount > 0)
      .sort((a, b) => a.memberId - b.memberId);
    let budget = gokoOwed;
    for (const p of payers) {
      const take = Math.min(p.paidAmount, budget);
      remaining.set(sliceKey(e.id, p.memberId), take);
      budget -= take;
      if (budget <= 0) break;
    }
  }

  const reimbs = reimbursements
    .filter((r) => !r.deleted && r.fromMemberId === houseMemberId && r.hostelExpenseId != null && r.splitExpenseId != null)
    .sort((a, b) => a.id - b.id);

  for (const r of reimbs) {
    const key = sliceKey(r.splitExpenseId!, r.toMemberId);
    const have = remaining.get(key) ?? 0;
    remaining.set(key, Math.max(0, have - r.amount));
  }
  return remaining;
}

export function gokoAttributableRemaining(
  houseMemberId: number,
  expenses: ExpenseEvent[],
  reimbursements: SettlementEvent[],
  payeeId: number,
  expenseId: number,
): number {
  const rem = allocateGokoAttribution(houseMemberId, expenses, reimbursements);
  return rem.get(sliceKey(expenseId, payeeId)) ?? 0;
}

export type GokoIncludeMode = "none" | "covers_all" | "equal" | "grid";

/** Reconstruct Include-Goko mode so Edit → Save does not drop a hostel slice. */
export function inferGokoIncludeMode(
  houseId: number | null | undefined,
  total: number,
  shares: ShareInput[],
  splitMethod: string,
): GokoIncludeMode {
  if (!houseId) return "none";
  const houseShare = shares.find((s) => s.memberId === houseId && s.owedAmount > 0);
  if (!houseShare) return "none";
  if (houseShare.owedAmount === total) return "covers_all";
  if (splitMethod === "equal") {
    const humanIds = shares.filter((s) => s.memberId !== houseId && s.owedAmount > 0).map((s) => s.memberId);
    try {
      const expected = allocateEqual(total, [...humanIds, houseId]);
      if ((expected.get(houseId) ?? 0) === houseShare.owedAmount) return "equal";
    } catch {
      /* fall through to grid */
    }
  }
  return "grid";
}

export function sharesMoneyEqual(a: ShareInput[], b: ShareInput[]): boolean {
  if (a.length !== b.length) return false;
  const key = (s: ShareInput) => `${s.memberId}:${s.paidAmount}:${s.owedAmount}`;
  const left = a.map(key).sort();
  const right = b.map(key).sort();
  return left.every((k, i) => k === right[i]);
}

/** House belongs on the owed list for equal-with-group and for any grid (including grid + method equally). */
export function owedIdsWithGoko(
  checked: number[],
  gokoMode: GokoIncludeMode,
  houseId: number | null,
): number[] {
  if (!houseId || gokoMode === "none" || gokoMode === "covers_all") return [...checked];
  if (checked.includes(houseId)) return [...checked];
  return [...checked, houseId];
}

export function gokoPayButtons(
  houseMemberId: number,
  expenses: ExpenseEvent[],
  reimbursements: SettlementEvent[],
): { payeeId: number; expenseId: number; amount: number }[] {
  const rem = allocateGokoAttribution(houseMemberId, expenses, reimbursements);
  const out: { payeeId: number; expenseId: number; amount: number }[] = [];
  for (const [key, amount] of rem) {
    if (amount <= 0) continue;
    const [expenseId, payeeId] = key.split(":").map(Number);
    out.push({ payeeId, expenseId, amount });
  }
  out.sort((a, b) => a.expenseId - b.expenseId || a.payeeId - b.payeeId);
  return out;
}
