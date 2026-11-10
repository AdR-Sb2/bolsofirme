import { describe, expect, it } from "vitest";
import {
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
});
