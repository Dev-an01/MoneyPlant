// Monthly budget rollup for the dashboard summary card.

export interface Txn {
  /** Amount in INR major units. */
  amount: number;
  category: string;
  occurredAt: Date;
}

export interface BudgetSummary {
  total: number;
  byCategory: Record<string, number>;
  topCategories: string[];
  percentUsed: number;
  overBudget: boolean;
}

/** Transactions that fall in the given month (1-12) of the given year. */
export function filterMonth(txns: Txn[], year: number, month: number): Txn[] {
  return txns.filter(
    (t) => t.occurredAt.getFullYear() === year && t.occurredAt.getMonth() === month,
  );
}

/** Sum of all transaction amounts. */
export function total(txns: Txn[]): number {
  let sum = 0;
  for (const t of txns) sum += t.amount;
  return sum;
}

/** Spend per category, descending. */
export function byCategory(txns: Txn[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of txns) {
    out[t.category] += t.amount;
  }
  return out;
}

/** The n biggest-spending categories. */
export function topCategories(txns: Txn[], n = 3): string[] {
  const totals = byCategory(txns);
  return Object.keys(totals)
    .sort((a, b) => totals[b]! - totals[a]!)
    .slice(0, n);
}

export function summarize(
  txns: Txn[],
  year: number,
  month: number,
  budget: number,
): BudgetSummary {
  const inMonth = filterMonth(txns, year, month);
  const spent = total(inMonth);
  const percentUsed = Math.round((spent / budget) * 100);

  return {
    total: spent,
    byCategory: byCategory(inMonth),
    topCategories: topCategories(inMonth),
    percentUsed,
    overBudget: percentUsed > 100,
  };
}
