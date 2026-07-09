// Demo data + derivations for the dashboard (Phase 1b runs on mock data;
// Phase 2 swaps these for API calls). Types come from @moneyplant/shared.

import {
  EXPENSE_CATEGORIES,
  INVESTMENT_CATEGORIES,
} from "@moneyplant/shared";

export interface TxRow {
  id: string;
  day: number;
  time: string;
  category: string;
  note: string;
  type: "expense" | "investment";
  amount: number;
}

export interface HoldingRow {
  name: string;
  ticker: string;
  type: "Mutual Fund" | "Stock";
  invested: number;
  current: number;
}

export interface PendingSeed {
  id: string;
  amount: number;
  category: string;
  type: "expense" | "investment";
  message: string;
  totalSec: number;
}

export const expenseCategories = [...EXPENSE_CATEGORIES];
export const investmentCategories = [...INVESTMENT_CATEGORIES];
export const allCategories = [...expenseCategories, ...investmentCategories];

export const CURRENT_MONTH_LABEL = "June 2026";

export const seedTransactions: TxRow[] = [
  { id: "t1", day: 28, time: "8:12 PM", category: "Food & Dining", note: "Dinner at Toit", type: "expense", amount: 1240 },
  { id: "t2", day: 28, time: "9:05 AM", category: "Coffee & Snacks", note: "Blue Tokai flat white", type: "expense", amount: 120 },
  { id: "t3", day: 27, time: "7:30 PM", category: "Groceries", note: "BigBasket weekly", type: "expense", amount: 2380 },
  { id: "t4", day: 26, time: "6:45 PM", category: "Mutual Fund", note: "Mutual Fund SIP — Parag Parikh", type: "investment", amount: 40000 },
  { id: "t5", day: 25, time: "1:15 PM", category: "Transport", note: "Uber to airport", type: "expense", amount: 640 },
  { id: "t6", day: 24, time: "11:20 AM", category: "Electronics & Gadgets", note: "MacBook Air M3", type: "expense", amount: 66000 },
  { id: "t7", day: 23, time: "8:00 PM", category: "Food & Dining", note: "Swiggy — Mexican", type: "expense", amount: 540 },
  { id: "t8", day: 22, time: "10:30 AM", category: "Bills & Utilities", note: "Electricity — June", type: "expense", amount: 2150 },
  { id: "t9", day: 21, time: "3:00 PM", category: "Stocks / Equity", note: "HDFC Bank — 25 shares", type: "investment", amount: 35000 },
  { id: "t10", day: 20, time: "9:40 AM", category: "Coffee & Snacks", note: "Third Wave", type: "expense", amount: 280 },
  { id: "t11", day: 19, time: "7:15 PM", category: "Groceries", note: "Dunzo essentials", type: "expense", amount: 870 },
  { id: "t12", day: 18, time: "8:30 PM", category: "Food & Dining", note: "Dining 400", type: "expense", amount: 400 },
  { id: "t13", day: 17, time: "12:00 PM", category: "Transport", note: "Metro recharge", type: "expense", amount: 500 },
  { id: "t14", day: 16, time: "6:00 PM", category: "Bills & Utilities", note: "Airtel broadband", type: "expense", amount: 1199 },
];

export const seedHoldings: HoldingRow[] = [
  { name: "Parag Parikh Flexi Cap", ticker: "PPFAS · Direct Growth", type: "Mutual Fund", invested: 240000, current: 298400 },
  { name: "Nifty 50 Index Fund", ticker: "UTI · Direct Growth", type: "Mutual Fund", invested: 120000, current: 133900 },
  { name: "SBI Small Cap", ticker: "SBI · Direct Growth", type: "Mutual Fund", invested: 60000, current: 71200 },
  { name: "HDFC Bank", ticker: "HDFCBANK · NSE", type: "Stock", invested: 35000, current: 37650 },
  { name: "Infosys", ticker: "INFY · NSE", type: "Stock", invested: 48000, current: 42300 },
];

export const seedPending: PendingSeed[] = [
  { id: "p1", amount: 400, category: "Food & Dining", type: "expense", message: "Dining 400", totalSec: 252 },
  { id: "p2", amount: 40000, category: "Mutual Fund", type: "investment", message: "40k mutual fund", totalSec: 138 },
];

// Last month's expense for the overview delta.
export const LAST_MONTH_EXPENSE = 68200;

// Static 6-month series for the trend charts (Jan–Jun). Jun ~ matches computed.
export const sixMonthSpend = [
  { label: "Jan", value: 52300 },
  { label: "Feb", value: 47800 },
  { label: "Mar", value: 61200 },
  { label: "Apr", value: 58400 },
  { label: "May", value: 68200 },
  { label: "Jun", value: 76319 },
];
export const sixMonthInvest = [
  { label: "Jan", value: 50000 },
  { label: "Feb", value: 50000 },
  { label: "Mar", value: 60000 },
  { label: "Apr", value: 55000 },
  { label: "May", value: 65000 },
  { label: "Jun", value: 75000 },
];

// Months available in the month-selector (Spending / Insights). Only the current
// month (June) has detail in this mock; earlier months render the empty state.
export const months = [
  { key: "2026-01", label: "January 2026", hasData: false },
  { key: "2026-02", label: "February 2026", hasData: false },
  { key: "2026-03", label: "March 2026", hasData: false },
  { key: "2026-04", label: "April 2026", hasData: false },
  { key: "2026-05", label: "May 2026", hasData: false },
  { key: "2026-06", label: "June 2026", hasData: true },
];
export const CURRENT_MONTH_IDX = months.length - 1;

const CATEGORY_PALETTE = [
  "#B06A2C",
  "#2E5D45",
  "#C68A3A",
  "#7B9B6E",
  "#A06628",
  "#5E7C66",
  "#9C8F6E",
];

export function categoryColor(rank: number): string {
  return CATEGORY_PALETTE[rank % CATEGORY_PALETTE.length] ?? "#9C8F6E";
}

export interface CategoryAgg {
  category: string;
  amount: number;
  pct: number; // share of total
  barW: number; // share of max (for bar width)
  color: string;
}

export function expenseByCategory(txs: TxRow[]): CategoryAgg[] {
  const totals = new Map<string, number>();
  let total = 0;
  for (const t of txs) {
    if (t.type !== "expense") continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
    total += t.amount;
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] ?? 1;
  return sorted.map(([category, amount], i) => ({
    category,
    amount,
    pct: total ? (amount / total) * 100 : 0,
    barW: max ? (amount / max) * 100 : 0,
    color: categoryColor(i),
  }));
}

export function sum(txs: TxRow[], type: "expense" | "investment"): number {
  return txs.filter((t) => t.type === type).reduce((a, t) => a + t.amount, 0);
}

export interface DailyBar {
  day: number;
  value: number;
  h: number; // percent height
  color: string;
  outlier: boolean;
  outLabel?: string;
}

export function dailyBars(txs: TxRow[], cap = 4000): DailyBar[] {
  const byDay = new Map<number, number>();
  for (const t of txs) {
    if (t.type !== "expense") continue;
    byDay.set(t.day, (byDay.get(t.day) ?? 0) + t.amount);
  }
  const days: DailyBar[] = [];
  for (let day = 16; day <= 29; day++) {
    const value = byDay.get(day) ?? 0;
    const outlier = value > cap;
    const frac = value > 0 ? Math.max(6, (Math.min(value, cap) / cap) * 100) : 3;
    days.push({
      day,
      value,
      h: frac,
      color: outlier ? "#B06A2C" : "#7B9B6E",
      outlier,
      outLabel: outlier ? `₹${Math.round(value / 1000)}k` : undefined,
    });
  }
  return days;
}

export function biggestExpenses(txs: TxRow[], n = 3): TxRow[] {
  return txs
    .filter((t) => t.type === "expense")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}

// ── Adapters: server analytics → the view shapes above ─────────────────────
// These let the existing charts render real API data unchanged.
export function catAggFromSlices(
  slices: Array<{ category: string; amount: number; pct: number }>,
): CategoryAgg[] {
  const max = slices[0]?.amount ?? 1;
  return slices.map((s, i) => ({
    category: s.category,
    amount: s.amount,
    pct: s.pct,
    barW: max ? (s.amount / max) * 100 : 0,
    color: categoryColor(i),
  }));
}

export function barsFromDaily(
  points: Array<{ day: number; value: number }>,
  cap = 4000,
): DailyBar[] {
  return points.map(({ day, value }) => {
    const outlier = value > cap;
    const frac = value > 0 ? Math.max(6, (Math.min(value, cap) / cap) * 100) : 3;
    return {
      day,
      value,
      h: frac,
      color: outlier ? "#B06A2C" : "#7B9B6E",
      outlier,
      outLabel: outlier ? `₹${Math.round(value / 1000)}k` : undefined,
    };
  });
}
