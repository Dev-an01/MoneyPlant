// Shared domain types & contracts for MoneyPlant.
// Single source of truth used by web, api, and bot.

export type TxnType = "expense" | "investment";

export type TxnStatus = "pending" | "committed" | "cancelled";

export interface Transaction {
  id: string;
  type: TxnType;
  category: string;
  subtype?: string | null;
  /** Amount in INR (major units). Stored encrypted server-side; plaintext only in transit within our infra. */
  amount: number;
  currency: string; // default "INR"
  note?: string | null;
  status: TxnStatus;
  /** Transaction time, from the Telegram message date. ISO string. */
  txnTime: string;
  sourceMessageId?: number | null;
  aiConfidence?: number | null;
  createdAt: string;
  committedAt?: string | null;
}

export interface Holding {
  id: string;
  name: string;
  ticker: string;
  type: "Mutual Fund" | "Stock" | string;
  invested: number;
  current: number;
  lastValuedAt?: string | null;
}

export interface PendingEntry {
  id: string;
  amount: number;
  category: string;
  type: TxnType;
  /** Original chat message that produced this entry. */
  message: string;
  /** Epoch ms when the 5-minute grace window ends. */
  endsAt: number;
  totalSec: number;
}

// Curated base taxonomy (mirrors CATEGORIES.md / PRD §18, §16.5).
export const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Coffee & Snacks",
  "Groceries",
  "Transport",
  "Shopping",
  "Electronics & Gadgets",
  "Bills & Utilities",
  "Rent & Housing",
  "EMI & Loans",
  "Health & Medical",
  "Fitness & Wellness",
  "Entertainment",
  "Subscriptions",
  "Education",
  "Travel",
  "Personal Care",
  "Household & Home",
  "Gifts & Donations",
  "Insurance",
  "Taxes & Fees",
  "Kids & Family",
  "Pets",
  "Other / Misc",
] as const;

export const INVESTMENT_CATEGORIES = [
  "Mutual Fund",
  "Stocks / Equity",
  "Gold",
  "Fixed Deposit / RD",
  "PPF / EPF / NPS",
  "Bonds",
  "Crypto",
  "Real Estate",
] as const;

export const GRACE_WINDOW_SEC = 5 * 60;

// ── Money ────────────────────────────────────────────────────────────────
// Stored as integer paise everywhere server-side; rupees only at the boundary.
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

// ── API DTOs (server → client contracts) ──────────────────────────────────
export interface TxnDTO {
  id: string;
  type: TxnType;
  category: string;
  note: string | null;
  /** Rupees (major units). */
  amount: number;
  status: TxnStatus;
  /** ISO timestamp. */
  txnTime: string;
  aiConfidence?: number | null;
  stage?: string | null;
}

export interface PendingDTO {
  id: string;
  amount: number;
  category: string;
  type: TxnType;
  message: string;
  /** Epoch ms when the grace window ends. */
  endsAt: number;
  totalSec: number;
}

export interface HoldingDTO {
  id: string;
  name: string;
  ticker: string;
  type: string;
  invested: number;
  current: number;
  pnl: number;
  pnlPct: number;
  lastValuedAt?: string | null;
}

export interface MonthPoint {
  key: string; // "2026-06"
  label: string; // "June 2026"
  value: number; // rupees
  hasData: boolean;
}

export interface CategorySlice {
  category: string;
  amount: number;
  pct: number;
}

export interface DayPoint {
  day: number;
  value: number;
}

export interface AnalyticsDTO {
  month: { key: string; label: string };
  expenseTotal: number;
  investTotal: number;
  lastMonthExpense: number;
  deltaPct: number;
  txCount: number;
  savingsRatePct: number;
  byCategory: CategorySlice[];
  investByCategory: CategorySlice[];
  daily: DayPoint[];
  topExpenses: Array<{ category: string; note: string | null; amount: number }>;
  sixMonthSpend: MonthPoint[];
  sixMonthInvest: MonthPoint[];
  months: MonthPoint[];
  portfolio: {
    invested: number;
    current: number;
    pnl: number;
    pnlPct: number;
    holdings: HoldingDTO[];
  };
}
