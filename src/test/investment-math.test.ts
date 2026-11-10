import { describe, expect, it } from "vitest";
import { calculatePortfolioSummary } from "@/lib/investment-math";

describe("Investment portfolio calculations", () => {
  it("includes dividend income in accumulated return and groups asset allocation", () => {
    const result = calculatePortfolioSummary(
      [
        { asset_type: "Ação", quantity: 2, average_price_cents: 10000, current_price_cents: 12000 },
        { asset_type: "Ação", quantity: 1, average_price_cents: 5000, current_price_cents: 4000 },
        { asset_type: "Renda fixa", quantity: 1, average_price_cents: 20000, current_price_cents: 21000 },
      ],
      1000,
    );
    expect(result.investedCents).toBe(45000);
    expect(result.currentCents).toBe(49000);
    expect(result.accumulatedReturnCents).toBe(5000);
    expect(result.returnPercent).toBeCloseTo(11.1111);
    expect(result.allocation).toEqual([
      { type: "Ação", value: 28000 },
      { type: "Renda fixa", value: 21000 },
    ]);
  });

  it("rejects invalid quantities and dividend totals", () => {
    expect(() => calculatePortfolioSummary([
      { asset_type: "Ação", quantity: -1, average_price_cents: 1, current_price_cents: 1 },
    ], 0)).toThrow("Investment positions must have non-negative finite values.");
    expect(() => calculatePortfolioSummary([], -1)).toThrow(
      "Dividend total must be a non-negative number.",
    );
  });
});
