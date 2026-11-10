import { monthKey, type Tx } from "@/lib/store";

export interface ReportSource {
  type: "bank" | "card";
  id: string;
}

function periodTotals(transactions: Tx[], month: string, source?: ReportSource) {
  const list = transactions.filter(
    (transaction) =>
      transaction.date.startsWith(month) &&
      (!source ||
        (source.type === "bank"
          ? transaction.bankId === source.id
          : transaction.cardId === source.id)),
  );
  const income = list
    .filter((transaction) => transaction.type === "receita")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expense = list
    .filter((transaction) => transaction.type === "despesa")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  return { list, income, expense, balance: income - expense };
}

export interface PeriodComparison {
  current: ReturnType<typeof periodTotals>;
  previous: ReturnType<typeof periodTotals>;
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
  source?: ReportSource,
): PeriodComparison {
  const previousMonth = previousMonthKey(selectedMonth);
  const current = periodTotals(transactions, selectedMonth, source);
  const previous = periodTotals(transactions, previousMonth, source);
  return {
    current,
    previous,
    incomeChange: percentageChange(current.income, previous.income),
    expenseChange: percentageChange(current.expense, previous.expense),
    balanceChange: current.balance - previous.balance,
    previousMonth,
  };
}

export function reportMonthTotals(
  transactions: Tx[],
  month: string,
  source?: ReportSource,
) {
  return periodTotals(transactions, month, source);
}
