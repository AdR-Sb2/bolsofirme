import { describe, expect, it } from "vitest";
import {
  getExceededSpendingLimits,
  parseSavingsGoals,
  parseSpendingLimits,
  progressPercent,
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
});
