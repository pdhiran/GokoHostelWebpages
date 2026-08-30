import { describe, it, expect } from "vitest";
import {
  allocateEqual,
  allocatePercent,
  allocateShares,
  assertBalanced,
  netsFromEvents,
  overallNets,
  simplifyDebts,
  suggestionIncludes,
  gokoAttributableRemaining,
  gokoPayButtons,
  inferGokoIncludeMode,
  owedIdsWithGoko,
  sharesMoneyEqual,
  rupeesToPaise,
  paiseToRupees,
  type ExpenseEvent,
  type SettlementEvent,
  type ShareInput,
} from "@/lib/splits";

const GOKO = 1;
const ARUN = 2;
const BINA = 3;
const CHET = 4;
const DEV = 5;
const PRIYA = 6;

function exp(id: number, shares: ShareInput[], deleted = false): ExpenseEvent {
  return { id, shares, deleted };
}

function st(
  id: number,
  from: number,
  to: number,
  amount: number,
  extra: Partial<SettlementEvent> = {},
): SettlementEvent {
  return { id, fromMemberId: from, toMemberId: to, amount, ...extra };
}

describe("remainder / allocate", () => {
  it("equal 100 paise / 3 by memberId (W15)", () => {
    const m = allocateEqual(100, [CHET, ARUN, BINA]);
    expect([...m.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [ARUN, 34],
      [BINA, 33],
      [CHET, 33],
    ]);
  });

  it("equal ₹100.00 / 3 (W15)", () => {
    const m = allocateEqual(10000, [ARUN, BINA, CHET]);
    expect(m.get(ARUN)).toBe(3334);
    expect(m.get(BINA)).toBe(3333);
    expect(m.get(CHET)).toBe(3333);
  });

  it("equal 101 / 2", () => {
    const m = allocateEqual(101, [ARUN, BINA]);
    expect(m.get(ARUN)).toBe(51);
    expect(m.get(BINA)).toBe(50);
  });

  it("shares 2:1 of 100 (W16)", () => {
    const m = allocateShares(100, [
      { memberId: ARUN, shares: 2 },
      { memberId: BINA, shares: 1 },
    ]);
    expect(m.get(ARUN)).toBe(67);
    expect(m.get(BINA)).toBe(33);
  });

  it("percent 50/50 of 101", () => {
    const m = allocatePercent(101, [
      { memberId: ARUN, basisPoints: 5000 },
      { memberId: BINA, basisPoints: 5000 },
    ]);
    expect(m.get(ARUN)).toBe(51);
    expect(m.get(BINA)).toBe(50);
  });

  it("percent 33.33×3 rejects (9999 bp)", () => {
    expect(() =>
      allocatePercent(10000, [
        { memberId: ARUN, basisPoints: 3333 },
        { memberId: BINA, basisPoints: 3333 },
        { memberId: CHET, basisPoints: 3333 },
      ]),
    ).toThrow(/10000/);
  });

  it("rejects total 0 and empty members", () => {
    expect(() => allocateEqual(0, [ARUN])).toThrow();
    expect(() => allocateEqual(100, [])).toThrow();
  });
});

describe("assertBalanced", () => {
  it("accepts W1 dinner", () => {
    expect(
      assertBalanced(200000, [
        { memberId: ARUN, paidAmount: 200000, owedAmount: 50000 },
        { memberId: BINA, paidAmount: 0, owedAmount: 50000 },
        { memberId: CHET, paidAmount: 0, owedAmount: 50000 },
        { memberId: DEV, paidAmount: 0, owedAmount: 50000 },
      ]),
    ).toBeNull();
  });

  it("allows owed 0 for payer not in split (W2)", () => {
    expect(
      assertBalanced(90000, [
        { memberId: ARUN, paidAmount: 90000, owedAmount: 0 },
        { memberId: BINA, paidAmount: 0, owedAmount: 45000 },
        { memberId: CHET, paidAmount: 0, owedAmount: 45000 },
      ]),
    ).toBeNull();
  });

  it("rejects negative paid, duplicate member, unbalanced", () => {
    expect(
      assertBalanced(100, [{ memberId: ARUN, paidAmount: -1, owedAmount: 100 }]),
    ).toMatch(/negative/);
    expect(
      assertBalanced(100, [
        { memberId: ARUN, paidAmount: 100, owedAmount: 50 },
        { memberId: ARUN, paidAmount: 0, owedAmount: 50 },
      ]),
    ).toMatch(/duplicate/);
    expect(
      assertBalanced(100, [{ memberId: ARUN, paidAmount: 50, owedAmount: 100 }]),
    ).toMatch(/paid must sum/);
  });
});

describe("nets and settle (W1 W2 W3 W18 W19)", () => {
  it("W1 four-way dinner then Bina settles", () => {
    const expenses = [
      exp(1, [
        { memberId: ARUN, paidAmount: 200000, owedAmount: 50000 },
        { memberId: BINA, paidAmount: 0, owedAmount: 50000 },
        { memberId: CHET, paidAmount: 0, owedAmount: 50000 },
        { memberId: DEV, paidAmount: 0, owedAmount: 50000 },
      ]),
    ];
    let nets = netsFromEvents(expenses, []);
    expect(nets.get(ARUN)).toBe(150000);
    expect(nets.get(BINA)).toBe(-50000);
    expect([...nets.values()].reduce((a, b) => a + b, 0)).toBe(0);

    const sug = simplifyDebts(nets);
    expect(sug).toEqual([
      { from: BINA, to: ARUN, amount: 50000 },
      { from: CHET, to: ARUN, amount: 50000 },
      { from: DEV, to: ARUN, amount: 50000 },
    ]);

    nets = netsFromEvents(expenses, [st(1, BINA, ARUN, 50000)]);
    expect(nets.get(ARUN)).toBe(100000);
    expect(nets.get(BINA)).toBe(0);
    expect(suggestionIncludes(simplifyDebts(nets), BINA, ARUN)).toBe(false);
  });

  it("W2 payer not in split", () => {
    const nets = netsFromEvents(
      [
        exp(1, [
          { memberId: ARUN, paidAmount: 90000, owedAmount: 0 },
          { memberId: BINA, paidAmount: 0, owedAmount: 45000 },
          { memberId: CHET, paidAmount: 0, owedAmount: 45000 },
        ]),
      ],
      [],
    );
    expect(nets.get(ARUN)).toBe(90000);
    expect(nets.get(BINA)).toBe(-45000);
  });

  it("W18 simplify chain A←B←C", () => {
    const A = 10;
    const B = 11;
    const C = 12;
    const nets = netsFromEvents(
      [
        exp(1, [
          { memberId: A, paidAmount: 10, owedAmount: 0 },
          { memberId: B, paidAmount: 0, owedAmount: 10 },
        ]),
        exp(2, [
          { memberId: B, paidAmount: 10, owedAmount: 0 },
          { memberId: C, paidAmount: 0, owedAmount: 10 },
        ]),
      ],
      [],
    );
    expect(nets.get(A)).toBe(10);
    expect(nets.get(B)).toBe(0);
    expect(nets.get(C)).toBe(-10);
    expect(simplifyDebts(nets)).toEqual([{ from: C, to: A, amount: 10 }]);
  });

  it("W19 over-settlement reverses", () => {
    const expenses = [
      exp(1, [
        { memberId: ARUN, paidAmount: 50000, owedAmount: 0 },
        { memberId: BINA, paidAmount: 0, owedAmount: 50000 },
      ]),
    ];
    const nets = netsFromEvents(expenses, [st(1, BINA, ARUN, 80000)]);
    expect(nets.get(BINA)).toBe(30000);
    expect(nets.get(ARUN)).toBe(-30000);
  });

  it("deleted expense excluded", () => {
    const nets = netsFromEvents(
      [
        exp(1, [
          { memberId: ARUN, paidAmount: 100, owedAmount: 50 },
          { memberId: BINA, paidAmount: 0, owedAmount: 50 },
        ], true),
      ],
      [],
    );
    expect(nets.size).toBe(0);
  });
});

describe("cross-group overall (W8 W27)", () => {
  it("sums nets but does not invent a settle", () => {
    const kitchen = netsFromEvents(
      [
        exp(1, [
          { memberId: PRIYA, paidAmount: 0, owedAmount: 50000 },
          { memberId: ARUN, paidAmount: 50000, owedAmount: 0 },
        ]),
      ],
      [],
    );
    const trip = netsFromEvents(
      [
        exp(2, [
          { memberId: ARUN, paidAmount: 0, owedAmount: 20000 },
          { memberId: PRIYA, paidAmount: 20000, owedAmount: 0 },
        ]),
      ],
      [],
    );
    const overall = overallNets([kitchen, trip]);
    expect(overall.get(PRIYA)).toBe(-30000);
    expect(overall.get(ARUN)).toBe(30000);
    expect(kitchen.get(PRIYA)).toBe(-50000);
    expect(trip.get(ARUN)).toBe(-20000);
  });
});

describe("Goko attribution FIFO", () => {
  it("W5 covers-all then reimburse", () => {
    const expenses = [
      exp(10, [
        { memberId: PRIYA, paidAmount: 300000, owedAmount: 0 },
        { memberId: GOKO, paidAmount: 0, owedAmount: 300000 },
      ]),
    ];
    expect(gokoAttributableRemaining(GOKO, expenses, [], PRIYA, 10)).toBe(300000);
    const after = [st(1, GOKO, PRIYA, 300000, { hostelExpenseId: 99, splitExpenseId: 10 })];
    expect(gokoAttributableRemaining(GOKO, expenses, after, PRIYA, 10)).toBe(0);
  });

  it("H1 A: Arun's personal credit is not Goko-attributable", () => {
    const expenses = [
      exp(1, [
        { memberId: PRIYA, paidAmount: 100000, owedAmount: 0 },
        { memberId: GOKO, paidAmount: 0, owedAmount: 100000 },
      ]),
      exp(2, [
        { memberId: ARUN, paidAmount: 50000, owedAmount: 0 },
        { memberId: BINA, paidAmount: 0, owedAmount: 50000 },
      ]),
    ];
    expect(gokoAttributableRemaining(GOKO, expenses, [], PRIYA, 1)).toBe(100000);
    expect(gokoAttributableRemaining(GOKO, expenses, [], ARUN, 2)).toBe(0);
    expect(gokoAttributableRemaining(GOKO, expenses, [], ARUN, 1)).toBe(0);
  });

  it("W51 FIFO 80k/80k vs Goko 100k (lower memberId fills first)", () => {
    const priya = 2;
    const arun = 5;
    const expenses = [
      exp(1, [
        { memberId: priya, paidAmount: 80000, owedAmount: 30000 },
        { memberId: arun, paidAmount: 80000, owedAmount: 30000 },
        { memberId: GOKO, paidAmount: 0, owedAmount: 100000 },
      ]),
    ];
    expect(gokoAttributableRemaining(GOKO, expenses, [], priya, 1)).toBe(80000);
    expect(gokoAttributableRemaining(GOKO, expenses, [], arun, 1)).toBe(20000);
  });

  it("H6: pooled 100000 on E1 when E1 slice is 50000 is over-cap", () => {
    const expenses = [
      exp(1, [
        { memberId: PRIYA, paidAmount: 50000, owedAmount: 0 },
        { memberId: GOKO, paidAmount: 0, owedAmount: 50000 },
      ]),
      exp(2, [
        { memberId: PRIYA, paidAmount: 50000, owedAmount: 0 },
        { memberId: GOKO, paidAmount: 0, owedAmount: 50000 },
      ]),
    ];
    expect(gokoAttributableRemaining(GOKO, expenses, [], PRIYA, 1)).toBe(50000);
    expect(gokoAttributableRemaining(GOKO, expenses, [], PRIYA, 2)).toBe(50000);
    expect(100000 > gokoAttributableRemaining(GOKO, expenses, [], PRIYA, 1)).toBe(true);
  });

  it("W52 human settle does not cut attribution", () => {
    const expenses = [
      exp(1, [
        { memberId: PRIYA, paidAmount: 300000, owedAmount: 0 },
        { memberId: GOKO, paidAmount: 0, owedAmount: 300000 },
      ]),
    ];
    const human = [st(1, ARUN, PRIYA, 10000)];
    expect(gokoAttributableRemaining(GOKO, expenses, human, PRIYA, 1)).toBe(300000);
  });

  it("W7 mixed: Goko 100000, Priya paid full; after Arun→Priya still 100000 to Priya", () => {
    const expenses = [
      exp(1, [
        { memberId: PRIYA, paidAmount: 200000, owedAmount: 50000 },
        { memberId: ARUN, paidAmount: 0, owedAmount: 50000 },
        { memberId: GOKO, paidAmount: 0, owedAmount: 100000 },
      ]),
    ];
    const human = [st(1, ARUN, PRIYA, 50000)];
    expect(gokoAttributableRemaining(GOKO, expenses, human, PRIYA, 1)).toBe(100000);
    expect(gokoAttributableRemaining(GOKO, expenses, human, ARUN, 1)).toBe(0);
  });

  it("infer equal-with-Goko on edit (not grid)", () => {
    const total = 200000;
    const owed = allocateEqual(total, [ARUN, BINA, GOKO]);
    const shares: ShareInput[] = [ARUN, BINA, GOKO].map((id) => ({
      memberId: id,
      paidAmount: id === ARUN ? total : 0,
      owedAmount: owed.get(id) ?? 0,
    }));
    expect(inferGokoIncludeMode(GOKO, total, shares, "equal")).toBe("equal");
  });

  it("infer covers_all when Goko owed is the total", () => {
    expect(inferGokoIncludeMode(GOKO, 300000, [
      { memberId: PRIYA, paidAmount: 300000, owedAmount: 0 },
      { memberId: GOKO, paidAmount: 0, owedAmount: 300000 },
    ], "exact")).toBe("covers_all");
  });

  it("grid+equal still includes house on owed ids", () => {
    expect(owedIdsWithGoko([ARUN, BINA], "grid", GOKO)).toEqual([ARUN, BINA, GOKO]);
    expect(owedIdsWithGoko([ARUN], "equal", GOKO)).toEqual([ARUN, GOKO]);
    expect(owedIdsWithGoko([ARUN], "none", GOKO)).toEqual([ARUN]);
  });

  it("sharesMoneyEqual ignores order", () => {
    expect(sharesMoneyEqual(
      [{ memberId: 1, paidAmount: 10, owedAmount: 5 }, { memberId: 2, paidAmount: 0, owedAmount: 5 }],
      [{ memberId: 2, paidAmount: 0, owedAmount: 5 }, { memberId: 1, paidAmount: 10, owedAmount: 5 }],
    )).toBe(true);
  });

  it("W22 Goko owed=paid → no pay buttons", () => {
    const expenses = [
      exp(1, [{ memberId: GOKO, paidAmount: 200000, owedAmount: 200000 }]),
    ];
    expect(gokoPayButtons(GOKO, expenses, []).length).toBe(0);
  });
});

describe("rupees", () => {
  it("2 decimal round", () => {
    expect(rupeesToPaise("10.10")).toBe(1010);
    expect(rupeesToPaise("10.105")).toBe(1011);
    expect(paiseToRupees(200000)).toBe("2000.00");
    expect(paiseToRupees(-50000)).toBe("-500.00");
  });
});
