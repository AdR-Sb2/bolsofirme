import { describe, expect, it } from "vitest";
import { compareMonthlyPeriods, previousMonthKey, reportMonthTotals } from "@/lib/reporting";

describe("Period reports", () => {
  it("finds the previous month across year boundaries", () => {
    expect(previousMonthKey("2026-01")).toBe("2025-12");
    expect(previousMonthKey("2026-12")).toBe("2026-11");
  });

  it("compares income, expenses, and balance for consecutive months", () => {
    const transactions = [
      {
        id: "income-previous",
        description: "Salário",
        amount: 100000,
        type: "receita" as const,
        date: "2025-12-01",
        categoryId: "salary",
      },
      {
        id: "expense-previous",
        description: "Mercado",
        amount: 30000,
        type: "despesa" as const,
        date: "2025-12-10",
        categoryId: "food",
      },
      {
        id: "income-current",
        description: "Salário",
        amount: 110000,
        type: "receita" as const,
        date: "2026-01-01",
        categoryId: "salary",
      },
      {
        id: "expense-current",
        description: "Mercado",
        amount: 36000,
        type: "despesa" as const,
        date: "2026-01-10",
        categoryId: "food",
      },
    ];

    const comparison = compareMonthlyPeriods(transactions, "2026-01");
    expect(comparison.previousMonth).toBe("2025-12");
    expect(comparison.incomeChange).toBe(10);
    expect(comparison.expenseChange).toBe(20);
    expect(comparison.balanceChange).toBe(4000);
  });

  it("handles zero previous totals and filters both periods by institution", () => {
    const transactions = [
      {
        id: "bank-current",
        description: "Compra",
        amount: 500,
        type: "despesa" as const,
        date: "2026-02-02",
        categoryId: "food",
        bankId: "bank-a",
      },
      {
        id: "other-bank",
        description: "Compra",
        amount: 1000,
        type: "despesa" as const,
        date: "2026-02-03",
        categoryId: "food",
        bankId: "bank-b",
      },
      {
        id: "card-current",
        description: "Fatura",
        amount: 250,
        type: "despesa" as const,
        date: "2026-02-04",
        categoryId: "food",
        cardId: "card-a",
      },
    ];
    const comparison = compareMonthlyPeriods(transactions, "2026-02", {
      type: "bank",
      id: "bank-a",
    });
    expect(comparison.expenseChange).toBeNull();
    expect(comparison.current.expense).toBe(500);
    expect(comparison.previous.expense).toBe(0);
    expect(reportMonthTotals(transactions, "2026-02", { type: "card", id: "card-a" }).expense).toBe(
      0,
    );
    expect(
      reportMonthTotals(transactions, "2026-02", { type: "card", id: "card-a" }).list,
    ).toHaveLength(1);
    expect(() => previousMonthKey("2026-13")).toThrow("Invalid month key: 2026-13");
  });

  it("reports income by reference month without moving cash income between months", () => {
    const transactions = [
      {
        id: "salary",
        description: "Salário de novembro",
        amount: 300_000,
        type: "receita" as const,
        date: "2026-12-05",
        referenceMonth: "2026-11-01",
        categoryId: "salary",
        bankId: "bank",
      },
      {
        id: "expense",
        description: "Conta",
        amount: 20_000,
        type: "despesa" as const,
        date: "2026-11-20",
        categoryId: "home",
        bankId: "bank",
      },
    ];

    const november = reportMonthTotals(transactions, "2026-11");
    const december = reportMonthTotals(transactions, "2026-12");

    expect(november.income).toBe(300_000);
    expect(november.expense).toBe(20_000);
    expect(november.cashIncome).toBe(0);
    expect(november.balance).toBe(280_000);
    expect(december.income).toBe(0);
    expect(december.cashIncome).toBe(300_000);
    expect(december.expense).toBe(0);
    expect(december.balance).toBe(0);
    expect(december.list).toHaveLength(0);
  });
});
