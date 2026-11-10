export interface InvestmentPosition {
  asset_type: string;
  quantity: number;
  average_price_cents: number;
  current_price_cents: number;
}

export interface PortfolioSummary {
  investedCents: number;
  currentCents: number;
  dividendsCents: number;
  accumulatedReturnCents: number;
  returnPercent: number;
  allocation: { type: string; value: number }[];
}

export function calculatePortfolioSummary(
  positions: InvestmentPosition[],
  dividendsCents: number,
): PortfolioSummary {
  if (!Number.isFinite(dividendsCents) || dividendsCents < 0) {
    throw new RangeError("Dividend total must be a non-negative number.");
  }
  const allocation = new Map<string, number>();
  const totals = positions.reduce(
    (result, position) => {
      if (
        !Number.isFinite(position.quantity) ||
        position.quantity < 0 ||
        !Number.isFinite(position.average_price_cents) ||
        position.average_price_cents < 0 ||
        !Number.isFinite(position.current_price_cents) ||
        position.current_price_cents < 0
      ) {
        throw new RangeError("Investment positions must have non-negative finite values.");
      }
      const currentValue = position.quantity * position.current_price_cents;
      allocation.set(position.asset_type, (allocation.get(position.asset_type) ?? 0) + currentValue);
      return {
        investedCents: result.investedCents + position.quantity * position.average_price_cents,
        currentCents: result.currentCents + currentValue,
      };
    },
    { investedCents: 0, currentCents: 0 },
  );
  const accumulatedReturnCents =
    totals.currentCents - totals.investedCents + dividendsCents;
  return {
    ...totals,
    dividendsCents,
    accumulatedReturnCents,
    returnPercent: totals.investedCents
      ? (accumulatedReturnCents / totals.investedCents) * 100
      : 0,
    allocation: [...allocation].map(([type, value]) => ({ type, value })),
  };
}
