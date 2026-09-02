import { describe, expect, it } from "vitest";
import { resolveOpeningBalance } from "@/lib/reconciliation";

const ledger = (overrides: Partial<Parameters<typeof resolveOpeningBalance>[0]> = {}) => ({
  openingBalance: 100,
  expectedClosing: 200,
  actualClosing: null,
  isReconciled: 0,
  openingAdjusted: 0,
  ...overrides,
});

describe("reconciliation opening balance", () => {
  it("recalculates a stale unreconciled opening from the latest prior closing", () => {
    expect(resolveOpeningBalance(ledger({ openingBalance: 999 }), ledger({ actualClosing: 450 }), 50)).toBe(450);
  });

  it("preserves reconciled and manually adjusted openings", () => {
    expect(resolveOpeningBalance(ledger({ openingBalance: 300, isReconciled: 1 }), ledger(), 50)).toBe(300);
    expect(resolveOpeningBalance(ledger({ openingBalance: 400, openingAdjusted: 1 }), ledger(), 50)).toBe(400);
  });

  it("uses the expected close and then account seed as fallbacks", () => {
    expect(resolveOpeningBalance(undefined, ledger({ expectedClosing: 250 }), 50)).toBe(250);
    expect(resolveOpeningBalance(undefined, undefined, 50)).toBe(50);
  });
});
