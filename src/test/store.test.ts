import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addMonthsToDate,
  cardInvoiceDates,
  cardInvoiceKey,
  loadUserData,
  resetStore,
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
          return {
            order: async () => ({
              error: null,
              data:
                table === "categories"
                  ? [{ id: "category", name: "Salário", icon: "💰", color: "" }]
                  : [],
            }),
          };
        },
      }),
    }));
    await loadUserData(owner);
    expect(filters).toEqual([
      ["categories", "user_id", owner],
      ["banks", "user_id", owner],
      ["cards", "user_id", owner],
      ["transactions", "user_id", owner],
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

  it("reports failure when default categories cannot be persisted", async () => {
    const failure = new Error("write rejected");
    mocks.from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
      insert: async () => ({ error: failure }),
    }));
    await expect(loadUserData("owner")).rejects.toThrow("write rejected");
  });
});
