export interface SpendingLimit {
  [key: string]: string | number;
  categoryId: string;
  amountCents: number;
}

export interface SavingsGoal {
  [key: string]: string | number;
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSpendingLimits(value: unknown): SpendingLimit[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError("Expected spending limits to be an array.");
  return value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item["categoryId"] !== "string" ||
      !item["categoryId"] ||
      typeof item["amountCents"] !== "number" ||
      !Number.isSafeInteger(item["amountCents"]) ||
      item["amountCents"] <= 0
    ) {
      throw new TypeError("Invalid spending limit data.");
    }
    return { categoryId: item["categoryId"], amountCents: item["amountCents"] };
  });
}

export function parseSavingsGoals(value: unknown): SavingsGoal[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError("Expected savings goals to be an array.");
  return value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item["id"] !== "string" ||
      !item["id"] ||
      typeof item["name"] !== "string" ||
      !item["name"].trim() ||
      typeof item["targetCents"] !== "number" ||
      !Number.isSafeInteger(item["targetCents"]) ||
      item["targetCents"] <= 0 ||
      typeof item["savedCents"] !== "number" ||
      !Number.isSafeInteger(item["savedCents"]) ||
      item["savedCents"] < 0
    ) {
      throw new TypeError("Invalid savings goal data.");
    }
    return {
      id: item["id"],
      name: item["name"].trim(),
      targetCents: item["targetCents"],
      savedCents: item["savedCents"],
    };
  });
}

export function progressPercent(currentCents: number, targetCents: number): number {
  if (!Number.isFinite(currentCents) || currentCents < 0) {
    throw new RangeError("Progress amount must be a non-negative number.");
  }
  if (!Number.isFinite(targetCents) || targetCents <= 0) {
    throw new RangeError("Progress target must be a positive number.");
  }
  return Math.min(100, (currentCents / targetCents) * 100);
}
