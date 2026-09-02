type LedgerOpening = {
  openingBalance: number;
  expectedClosing: number;
  actualClosing: number | null;
  isReconciled: number;
  openingAdjusted: number;
};

export function resolveOpeningBalance(
  current: LedgerOpening | undefined,
  previous: LedgerOpening | undefined,
  seed: number,
): number {
  if (current && (current.isReconciled || current.openingAdjusted)) return current.openingBalance;
  if (previous) return previous.actualClosing ?? previous.expectedClosing;
  return seed;
}
