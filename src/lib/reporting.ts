import { monthKey, monthTotals, type Tx } from "@/lib/store";

export interface PeriodComparison {
  current: ReturnType<typeof monthTotals>;
  previous: ReturnType<typeof monthTotals>;
  incomeChange: number | null;
  expenseChange: number | null;
  balanceChange: number;
  previousMonth: string;
}

export function previousMonthKey(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new RangeError(`Invalid month key: ${month}`);
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) throw new RangeError(`Invalid month key: ${month}`);
  return monthKey(new Date(year, monthNumber - 2, 1));
}

function percentageChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function compareMonthlyPeriods(
  transactions: Tx[],
  selectedMonth: string,
  bankId?: string,
): PeriodComparison {
  const previousMonth = previousMonthKey(selectedMonth);
  const current = monthTotals(transactions, selectedMonth, bankId);
  const previous = monthTotals(transactions, previousMonth, bankId);
  return {
    current,
    previous,
    incomeChange: percentageChange(current.income, previous.income),
    expenseChange: percentageChange(current.expense, previous.expense),
    balanceChange: current.balance - previous.balance,
    previousMonth,
  };
}
