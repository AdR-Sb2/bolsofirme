import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  addMonthsToDate,
  addRecurrenceDate,
  bankBalance,
  cardInvoiceDates,
  cardInvoiceKey,
  cardUsed,
  invoiceSummary,
  loadUserData,
  monthTotals,
  netWorthCents,
  resetStore,
  savingsAssetsCents,
  transactionReferenceMonth,
  useStore,
} from "@/lib/store";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

describe("Personal finance loading", () => {
  beforeEach(() => {
    resetStore();
    mocks.from.mockReset();
  });

  it("restricts every personal list to the signed-in owner", async () => {
    const owner = "0b09ff40-78bb-4078-81cb-f67df8f79c6f";
    const filters: unknown[][] = [];
    mocks.from.mockImplementation((table: string) => ({
      select: () => ({
        eq: (...args: unknown[]) => {
          filters.push([table, ...args]);
          const result = {
            error: null,
            data:
              table === "categories"
                ? [{ id: "category", name: "Salário", icon: "💰", color: "", type: "receita" }]
                : [],
          };
          return {
            order: async () => result,
            maybeSingle: async () => ({ error: null, data: null }),
          };
        },
      }),
    }));
    await loadUserData(owner);
    expect(filters).toEqual([
      ["categories", "user_id", owner],
      ["banks", "user_id", owner],
      ["cards", "user_id", owner],
      ["credit_card_invoices", "user_id", owner],
      ["transactions", "user_id", owner],
      ["savings_goal_movements", "user_id", owner],
      ["savings_goals", "user_id", owner],
      ["user_settings", "user_id", owner],
      ["payable_series", "user_id", owner],
    ]);
    const { result } = renderHook(() => useStore());
    expect(result.current.categories).toEqual([
      { id: "category", name: "Salário", icon: "💰", color: "", type: "receita" },
    ]);
  });

  describe("Credit card invoice cycles", () => {
    it("moves purchases after closing into the next invoice cycle", () => {
      const card = { closing: 10, due: 20 };

      expect(cardInvoiceKey("2026-06-10", card)).toBe("2026-06");
      expect(cardInvoiceKey("2026-06-11", card)).toBe("2026-07");
    });

    it("places the due date in the following month when it precedes the closing day", () => {
      const card = { closing: 25, due: 10 };

      expect(cardInvoiceKey("2026-06-25", card)).toBe("2026-07");
      expect(cardInvoiceKey("2026-06-26", card)).toBe("2026-08");
      expect(cardInvoiceDates("2026-07", card)).toEqual({
        closingDate: "2026-06-25",
        dueDate: "2026-07-10",
      });
    });

    it("clamps installment dates to each month's last day", () => {
      expect(addMonthsToDate("2026-01-31", 1)).toBe("2026-02-28");
      expect(addMonthsToDate("2026-01-31", 2)).toBe("2026-03-31");
    });
  });

  describe("Recurring transaction dates", () => {
    it("keeps monthly dates clamped instead of drifting after short months", () => {
      expect(addRecurrenceDate("2026-01-31", "monthly", 1)).toBe("2026-02-28");
      expect(addRecurrenceDate("2026-01-31", "monthly", 2)).toBe("2026-03-31");
    });

    it("does not include future scheduled occurrences in current balances or card usage", () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const futureDate = addRecurrenceDate(today, "weekly", 1);
      const state = {
        categories: [],
        banks: [
          { id: "bank", name: "Banco", color: "", kind: "Conta Corrente" as const, initial: 1000 },
        ],
        cards: [],
        invoices: [],
        txs: [
          {
            id: "future-bank",
            description: "Conta recorrente",
            amount: 250,
            type: "despesa" as const,
            date: futureDate,
            categoryId: "",
            bankId: "bank",
            recurrenceGroupId: "bank-series",
          },
          {
            id: "future-card",
            description: "Assinatura recorrente",
            amount: 300,
            type: "despesa" as const,
            date: futureDate,
            categoryId: "",
            cardId: "card",
            recurrenceGroupId: "card-series",
          },
          {
            id: "today-card",
            description: "Assinatura de hoje",
            amount: 100,
            type: "despesa" as const,
            date: today,
            categoryId: "",
            cardId: "card",
            recurrenceGroupId: "today-series",
          },
        ],
      };

      expect(bankBalance(state, "bank")).toBe(1000);
      expect(cardUsed(state, "card")).toBe(100);
    });

    it("advances weekly and yearly occurrences across leap years", () => {
      expect(addRecurrenceDate("2026-06-10", "weekly", 2)).toBe("2026-06-24");
      expect(addRecurrenceDate("2024-02-29", "yearly", 1)).toBe("2025-02-28");
      expect(addRecurrenceDate("2024-02-29", "yearly", 4)).toBe("2028-02-29");
    });
  });

  it("does not seed categories before onboarding is complete", async () => {
    const insert = vi.fn();
    mocks.from.mockImplementation((table: string) => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: [], error: null }),
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      insert,
    }));

    await loadUserData("new-user");

    expect(insert).not.toHaveBeenCalled();
  });

  it("seeds minimum typed defaults for completed accounts without categories", async () => {
    const failure = new Error("write rejected");
    mocks.from.mockImplementation((table: string) => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: [], error: null }),
          maybeSingle: async () => ({
            data: table === "user_settings" ? { onboarding_complete: true } : null,
            error: null,
          }),
        }),
      }),
      insert: async () => ({ error: failure }),
    }));
    await expect(loadUserData("owner")).rejects.toThrow("write rejected");
  });

  it("uses a minimal income and expense default set for completed accounts", async () => {
    let insertedCategories: Record<string, unknown>[] = [];
    mocks.from.mockImplementation((table: string) => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: [], error: null }),
          maybeSingle: async () => ({
            data: table === "user_settings" ? { onboarding_complete: true } : null,
            error: null,
          }),
        }),
      }),
      insert: async (rows: Record<string, unknown>[]) => {
        insertedCategories = rows;
        return { error: null };
      },
    }));

    await loadUserData("completed-user");

    expect(insertedCategories).toHaveLength(2);
    expect(insertedCategories.map(({ name, type }) => [name, type])).toEqual([
      ["Mercado", "despesa"],
      ["Salário", "receita"],
    ]);
  });

  it("counts a partial invoice payment against card use and the bank exactly once", () => {
    const invoice = {
      id: "invoice",
      cardId: "card",
      dueMonth: "2026-11-01",
      closingDate: "2026-10-24",
      dueDate: "2026-11-01",
    };
    const state = {
      categories: [],
      banks: [
        { id: "bank", name: "Banco", color: "", kind: "Conta Corrente" as const, initial: 100_000 },
      ],
      cards: [
        {
          id: "card",
          name: "Itaú",
          bank: "Itaú",
          color: "",
          limit: 50_000,
          closing: 24,
          due: 1,
        },
      ],
      invoices: [invoice],
      txs: [
        {
          id: "purchase",
          description: "Compra",
          amount: 10_000,
          type: "despesa" as const,
          date: "2026-10-10",
          categoryId: "food",
          cardId: "card",
          invoiceId: "invoice",
        },
        {
          id: "payment",
          description: "Pagamento de fatura · Itaú",
          amount: 4_000,
          type: "pagamento_fatura" as const,
          date: "2026-11-01",
          categoryId: "",
          bankId: "bank",
          invoiceId: "invoice",
        },
      ],
    };

    expect(invoiceSummary(invoice, state.txs, state.cards[0]).outstanding).toBe(6_000);
    expect(invoiceSummary(invoice, state.txs, state.cards[0]).status).toBe("Parcialmente paga");
    expect(cardUsed(state, "card")).toBe(6_000);
    expect(bankBalance(state, "bank")).toBe(96_000);
    expect(monthTotals(state.txs, "2026-10").expense).toBe(0);
    expect(monthTotals(state.txs, "2026-11").expense).toBe(4_000);
  });

  it("uses the reference month for income while bank balance follows receipt date", () => {
    const salary = {
      id: "salary",
      description: "Salário de novembro",
      amount: 300_000,
      type: "receita" as const,
      date: "2026-12-05",
      referenceMonth: "2026-11-01",
      categoryId: "salary",
      bankId: "bank",
    };
    const oldIncome = {
      id: "old-income",
      description: "Receita antiga",
      amount: 50_000,
      type: "receita" as const,
      date: "2026-12-10",
      categoryId: "other",
      bankId: "bank",
    };
    const expense = {
      id: "expense",
      description: "Conta",
      amount: 20_000,
      type: "despesa" as const,
      date: "2026-11-20",
      categoryId: "home",
      bankId: "bank",
    };
    const txs = [salary, oldIncome, expense];
    const november = monthTotals(txs, "2026-11");
    const december = monthTotals(txs, "2026-12");
    const state = {
      categories: [],
      banks: [
        { id: "bank", name: "Banco", color: "", kind: "Conta Corrente" as const, initial: 0 },
      ],
      cards: [],
      invoices: [],
      txs,
    };

    expect(november.income).toBe(300_000);
    expect(november.list.map((transaction) => transaction.id)).toEqual(["salary", "expense"]);
    expect(december.income).toBe(50_000);
    expect(december.cashIncome).toBe(350_000);
    expect(december.list.map((transaction) => transaction.id)).toEqual(["old-income"]);
    expect(november.balance).toBe(280_000);
    expect(december.balance).toBe(50_000);
    expect(bankBalance(state, "bank")).toBe(350_000 - 20_000);
    expect(transactionReferenceMonth(oldIncome)).toBe("2026-12");
  });

  it("keeps pending bills out of cash totals and counts them only after payment", () => {
    const pending = {
      id: "pending",
      description: "Conta de água",
      amount: 25_000,
      type: "despesa" as const,
      date: "2020-11-15",
      dueDate: "2020-11-15",
      status: "pendente" as const,
      categoryId: "home",
    };
    const paid = {
      ...pending,
      status: "paga" as const,
      bankId: "bank",
      paidAt: "2020-12-03",
    };
    const state = {
      categories: [],
      banks: [
        { id: "bank", name: "Banco", color: "", kind: "Conta Corrente" as const, initial: 80_000 },
      ],
      cards: [],
      invoices: [],
      txs: [pending],
    };

    expect(monthTotals(state.txs, "2020-11").list.map((transaction) => transaction.id)).toEqual([
      "pending",
    ]);
    expect(monthTotals(state.txs, "2020-11").expense).toBe(0);
    expect(bankBalance(state, "bank")).toBe(80_000);
    expect(monthTotals([paid], "2020-11").expense).toBe(0);
    expect(monthTotals([paid], "2020-12").expense).toBe(25_000);
    expect(bankBalance({ ...state, txs: [paid] }, "bank")).toBe(55_000);
  });

  it("moves contributions and resgates between the bank and goals without changing net worth", () => {
    const goalMovements = [
      {
        id: "contribution",
        goalId: "goal",
        type: "aporte" as const,
        amountCents: 20_000,
        date: "2026-11-12",
        bankId: "bank",
        note: "",
        createdAt: "2026-11-12T12:00:00Z",
      },
      {
        id: "withdrawal",
        goalId: "goal",
        type: "resgate" as const,
        amountCents: 5_000,
        date: "2026-11-13",
        bankId: "bank",
        note: "",
        createdAt: "2026-11-13T12:00:00Z",
      },
    ];
    const state = {
      categories: [],
      banks: [
        { id: "bank", name: "Banco", color: "", kind: "Conta Corrente" as const, initial: 100_000 },
      ],
      cards: [],
      invoices: [],
      txs: [],
      goalMovements,
    };

    expect(bankBalance(state, "bank")).toBe(85_000);
    expect(savingsAssetsCents(goalMovements)).toBe(15_000);
    expect(bankBalance(state, "bank") + savingsAssetsCents(goalMovements)).toBe(100_000);
  });

  it("computes net worth from bank balances, goals and investments without double counting", () => {
    const goalMovements = [
      {
        id: "contribution",
        goalId: "goal",
        type: "aporte" as const,
        amountCents: 20_000,
        date: "2026-10-12",
        bankId: "bank",
        note: "",
        createdAt: "2026-10-12T12:00:00Z",
      },
      {
        id: "withdrawal",
        goalId: "goal",
        type: "resgate" as const,
        amountCents: 5_000,
        date: "2026-11-13",
        bankId: "bank",
        note: "",
        createdAt: "2026-11-13T12:00:00Z",
      },
    ];
    const state = {
      categories: [],
      banks: [
        { id: "bank", name: "Banco", color: "", kind: "Conta Corrente" as const, initial: 100_000 },
        { id: "other", name: "Outro", color: "", kind: "Conta Corrente" as const, initial: 50_000 },
      ],
      cards: [],
      invoices: [],
      txs: [],
      goalMovements,
    };

    expect(bankBalance(state, "bank")).toBe(85_000);
    expect(bankBalance(state, "other")).toBe(50_000);
    expect(savingsAssetsCents(goalMovements)).toBe(15_000);
    expect(netWorthCents(state, 30_000)).toBe(85_000 + 50_000 + 15_000 + 30_000);
  });

  it("subtracts a negative card purchase from the invoice and used limit", () => {
    const state = {
      categories: [],
      banks: [],
      cards: [
        {
          id: "card",
          name: "Cartão",
          bank: "",
          color: "",
          limit: 50_000,
          closing: 24,
          due: 1,
        },
      ],
      invoices: [],
      txs: [
        {
          id: "purchase",
          description: "Compra",
          amount: 10_000,
          type: "despesa" as const,
          date: "2026-10-10",
          categoryId: "food",
          cardId: "card",
        },
        {
          id: "refund",
          description: "Estorno",
          amount: -2_000,
          type: "despesa" as const,
          date: "2026-10-11",
          categoryId: "food",
          cardId: "card",
        },
      ],
    };

    expect(cardUsed(state, "card")).toBe(8_000);
  });

  it("does not apply an old invoice payment to a purchase moved to a new invoice", () => {
    const state = {
      categories: [],
      banks: [],
      cards: [
        {
          id: "card",
          name: "Cartão",
          bank: "",
          color: "",
          limit: 50_000,
          closing: 24,
          due: 1,
        },
      ],
      invoices: [
        {
          id: "old-invoice",
          cardId: "card",
          dueMonth: "2026-11-01",
          closingDate: "2026-10-24",
          dueDate: "2026-11-01",
        },
        {
          id: "new-invoice",
          cardId: "card",
          dueMonth: "2026-12-01",
          closingDate: "2026-11-24",
          dueDate: "2026-12-01",
        },
      ],
      txs: [
        {
          id: "purchase",
          description: "Compra alterada",
          amount: 10_000,
          type: "despesa" as const,
          date: "2026-11-25",
          categoryId: "food",
          cardId: "card",
          invoiceId: "new-invoice",
        },
        {
          id: "old-payment",
          description: "Pagamento da fatura anterior",
          amount: 5_000,
          type: "pagamento_fatura" as const,
          date: "2026-11-01",
          categoryId: "",
          bankId: "bank",
          invoiceId: "old-invoice",
        },
      ],
    };

    expect(cardUsed(state, "card")).toBe(10_000);
  });
});
