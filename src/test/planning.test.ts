import { describe, expect, it } from "vitest";
import {
  budgetStatus,
  getExceededSpendingLimits,
  getMonthlySpendingByCategory,
  monthlySavingsSuggestion,
  parseSavingsGoals,
  parseSpendingLimits,
  progressPercent,
  savingsGoalBalanceCents,
} from "@/lib/planning";

describe("Budget and savings planning", () => {
  it("parses valid limits and goals from user settings", () => {
    expect(parseSpendingLimits([{ categoryId: "food", amountCents: 50000 }])).toEqual([
      { categoryId: "food", amountCents: 50000 },
    ]);
    expect(parseSavingsGoals([
      { id: "trip", name: "Viagem", targetCents: 100000, savedCents: 25000 },
    ])).toEqual([
      { id: "trip", name: "Viagem", targetCents: 100000, savedCents: 25000 },
    ]);
  });

  it("rejects malformed or non-positive financial values", () => {
    expect(() => parseSpendingLimits([{ categoryId: "food", amountCents: 0 }])).toThrow(
      "Invalid spending limit data.",
    );
    expect(() => parseSavingsGoals([
      { id: "trip", name: "Viagem", targetCents: 100000, savedCents: -1 },
    ])).toThrow("Invalid savings goal data.");
  });

  it("clamps completed budgets and goals at 100 percent", () => {
    expect(progressPercent(2500, 10000)).toBe(25);
    expect(progressPercent(12000, 10000)).toBe(100);
    expect(() => progressPercent(1, 0)).toThrow("Progress target must be a positive number.");
  });

  it("reports only categories that exceed their spending limit", () => {
    const limits = [
      { categoryId: "food", amountCents: 50000 },
      { categoryId: "transport", amountCents: 20000 },
    ];

    expect(
      getExceededSpendingLimits(limits, { food: 50000, transport: 27500, other: 90000 }),
    ).toEqual([{ ...limits[1], spentCents: 27500, overByCents: 7500 }]);
  });

  it("uses the invoice due month for card-purchase budget consumption", () => {
    const spending = getMonthlySpendingByCategory(
      [
        {
          id: "card-purchase",
          description: "Compra",
          amount: 12_500,
          type: "despesa",
          date: "2026-10-25",
          categoryId: "food",
          cardId: "card",
          invoiceId: "invoice",
        },
        {
          id: "invoice-payment",
          description: "Pagamento",
          amount: 12_500,
          type: "pagamento_fatura",
          date: "2026-11-10",
          categoryId: "",
          bankId: "bank",
        },
        {
          id: "bank-purchase",
          description: "Conta",
          amount: 2_500,
          type: "despesa",
          date: "2026-11-02",
          categoryId: "food",
          bankId: "bank",
        },
      ],
      "2026-11",
      [{ id: "card", name: "Cartão", bank: "", color: "", limit: 0, closing: 24, due: 10 }],
      [{
        id: "invoice",
        cardId: "card",
        dueMonth: "2026-11-01",
        closingDate: "2026-10-24",
        dueDate: "2026-11-10",
      }],
    );

    expect(spending).toEqual({ food: 15_000 });
  });

  it("calculates goal balances, deadlines and budget alert thresholds", () => {
    const goal = {
      id: "trip",
      name: "Viagem",
      targetCents: 100_000,
      deadline: "2026-12-01",
      icon: "🎯",
      color: "#22c55e",
      status: "em_andamento" as const,
      legacyBalanceCents: 10_000,
      createdAt: "2026-01-01T00:00:00Z",
    };
    const movements = [
      {
        id: "one",
        goalId: "trip",
        type: "aporte" as const,
        amountCents: 25_000,
        date: "2026-01-05",
        bankId: "bank",
        note: "",
        createdAt: "2026-01-05T00:00:00Z",
      },
      {
        id: "two",
        goalId: "trip",
        type: "resgate" as const,
        amountCents: 5_000,
        date: "2026-01-06",
        bankId: "bank",
        note: "",
        createdAt: "2026-01-06T00:00:00Z",
      },
    ];

    expect(savingsGoalBalanceCents(goal, movements)).toBe(30_000);
    expect(monthlySavingsSuggestion(30_000, 100_000, "2026-12-01", new Date(2026, 9, 1))).toBe(35_000);
    expect(budgetStatus(79)).toBe("normal");
    expect(budgetStatus(80)).toBe("atencao");
    expect(budgetStatus(100)).toBe("estourado");
  });
});
