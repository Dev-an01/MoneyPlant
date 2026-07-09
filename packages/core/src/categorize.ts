// Provider-agnostic categorization (PRD §6.3). All AI access goes through this one
// interface so swapping providers (free -> local -> paid) is a one-file change.

import type { TxnType } from "@moneyplant/shared";

export interface CategorizeResult {
  category: string;
  type: TxnType;
  subtype?: string;
  /** 0..1 */
  confidence: number;
  /** Which cascade stage resolved it. */
  stage: "keyword" | "ai";
}

export interface CategorizeProvider {
  /** Input is ALREADY amount-masked (e.g. "Dining <AMT>"). Never pass plaintext amounts. */
  categorize(maskedText: string): Promise<CategorizeResult>;
}

// Stage 2 — keyword -> category map (code, free). Resolves the common 70-80% with no AI call.
const KEYWORD_MAP: Array<{ words: string[]; category: string; type: TxnType }> = [
  { words: ["mutual fund", "mf", "sip", "elss", "index fund"], category: "Mutual Fund", type: "investment" },
  { words: ["stock", "share", "shares", "equity", "nse", "bse"], category: "Stocks / Equity", type: "investment" },
  { words: ["gold", "sgb", "sovereign"], category: "Gold", type: "investment" },
  { words: ["fd", "fixed deposit", "rd", "recurring deposit"], category: "Fixed Deposit / RD", type: "investment" },
  { words: ["ppf", "epf", "nps"], category: "PPF / EPF / NPS", type: "investment" },
  { words: ["crypto", "bitcoin", "btc", "eth", "ethereum"], category: "Crypto", type: "investment" },
  { words: ["dining", "restaurant", "lunch", "dinner", "zomato", "swiggy", "biryani", "pizza"], category: "Food & Dining", type: "expense" },
  { words: ["coffee", "tea", "starbucks", "cafe", "café", "chai", "snacks"], category: "Coffee & Snacks", type: "expense" },
  { words: ["groceries", "bigbasket", "blinkit", "zepto", "instamart", "vegetables", "kirana", "dunzo"], category: "Groceries", type: "expense" },
  { words: ["uber", "ola", "auto", "rapido", "petrol", "diesel", "fuel", "metro", "bus", "train", "cab", "parking", "toll", "fastag"], category: "Transport", type: "expense" },
  { words: ["laptop", "phone", "mobile", "headphones", "charger", "gadget", "appliance", "macbook", "electronics"], category: "Electronics & Gadgets", type: "expense" },
  { words: ["electricity", "water", "broadband", "wifi", "internet", "recharge", "dth", "airtel", "bill"], category: "Bills & Utilities", type: "expense" },
  { words: ["rent", "maintenance", "society"], category: "Rent & Housing", type: "expense" },
  { words: ["emi", "loan", "credit card"], category: "EMI & Loans", type: "expense" },
  { words: ["pharmacy", "medicine", "doctor", "hospital", "apollo", "clinic"], category: "Health & Medical", type: "expense" },
  { words: ["netflix", "spotify", "prime", "hotstar", "subscription"], category: "Subscriptions", type: "expense" },
  { words: ["flight", "hotel", "makemytrip", "irctc", "trip", "vacation"], category: "Travel", type: "expense" },
  { words: ["clothes", "myntra", "ajio", "shoes", "shopping", "amazon", "flipkart"], category: "Shopping", type: "expense" },
];

export interface KeywordMatch {
  category: string;
  type: TxnType;
  confidence: number;
}

/** Stage 2 lookup. Returns null when nothing matches (hand off to AI fallback). */
export function keywordMatch(maskedText: string): KeywordMatch | null {
  const text = maskedText.toLowerCase();
  for (const entry of KEYWORD_MAP) {
    if (entry.words.some((w) => text.includes(w))) {
      return { category: entry.category, type: entry.type, confidence: 0.95 };
    }
  }
  return null;
}

/**
 * The cascade: keyword map (free) -> AI fallback (only when ambiguous).
 * `maskedText` MUST already have the amount masked.
 */
export async function categorizeCascade(
  maskedText: string,
  aiProvider: CategorizeProvider,
): Promise<CategorizeResult> {
  const kw = keywordMatch(maskedText);
  if (kw) return { ...kw, stage: "keyword" };
  return aiProvider.categorize(maskedText);
}
