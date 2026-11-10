import { transactionInvoiceMonth, type CardC, type CreditCardInvoice, type SavingsGoalMovement, type Tx } from "@/lib/store";

export interface SpendingLimit {
  [key: string]: string | number;
  categoryId: string;
  amountCents: number;
}

export interface SpendingBudget {
  id: string;
  categoryId: string;
  month: string;
  amountCents: number;
}

export interface SavingsGoalRecord {
  id: string;
  name: string;
  targetCents: number;
  deadline: string | null;
  icon: string;
  color: string;
  status: "em_andamento" | "concluida" | "arquivada";
  legacyBalanceCents: number;
  createdAt: string;
}

export interface ExceededSpendingLimit extends SpendingLimit {
  spentCents: number;
  overByCents: number;
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

export function getExceededSpendingLimits(
  limits: SpendingLimit[],
  spendingByCategory: Record<string, number>,
): ExceededSpendingLimit[] {
  return limits.flatMap((limit) => {
    const spentCents = spendingByCategory[limit.categoryId] ?? 0;
    return spentCents > limit.amountCents
      ? [{ ...limit, spentCents, overByCents: spentCents - limit.amountCents }]
      : [];
  });
}

export function getMonthlySpendingByCategory(
  transactions: Tx[],
  month: string,
  cards: CardC[],
  invoices: CreditCardInvoice[],
): Record<string, number> {
  return transactions.reduce<Record<string, number>>((totals, transaction) => {
    if (transaction.type !== "despesa") return totals;
    const card = transaction.cardId
      ? cards.find((item) => item.id === transaction.cardId)
      : undefined;
    const transactionMonth =
      card ? transactionInvoiceMonth(transaction, card, invoices) : transaction.date.slice(0, 7);
    if (transactionMonth === month) {
      totals[transaction.categoryId] = (totals[transaction.categoryId] ?? 0) + transaction.amount;
    }
    return totals;
  }, {});
}

export function savingsGoalBalanceCents(
  goal: SavingsGoalRecord,
  movements: SavingsGoalMovement[],
): number {
  return goal.legacyBalanceCents + movements
    .filter((movement) => movement.goalId === goal.id)
    .reduce(
      (total, movement) =>
        total + (movement.type === "aporte" ? movement.amountCents : -movement.amountCents),
      0,
    );
}

export function budgetStatus(progress: number): "normal" | "atencao" | "estourado" {
  if (progress >= 100) return "estourado";
  if (progress >= 80) return "atencao";
  return "normal";
}

export function monthlySavingsSuggestion(
  balanceCents: number,
  targetCents: number,
  deadline: string | null,
  today = new Date(),
): number | null {
  if (!deadline) return null;
  const [yearText, monthText] = deadline.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Invalid goal deadline: ${deadline}`);
  }
  const monthsLeft = Math.max(
    1,
    (year - today.getFullYear()) * 12 + month - (today.getMonth() + 1),
  );
  return Math.max(0, Math.ceil((targetCents - balanceCents) / monthsLeft));
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
