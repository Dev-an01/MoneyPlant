// Deterministic Indian money parser. The AI never does arithmetic (PRD §6.3, FR-3.1).
// Handles: 400, 66k, 1.5L, 40k, 35,000, 1.2cr, ₹2,380, "1.5 lakh".

export interface ParsedAmount {
  /** Amount in INR major units. */
  amount: number;
  /** The exact substring that was interpreted as the amount (for masking). */
  raw: string;
}

const UNIT_MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  l: 100_000,
  lakh: 100_000,
  lakhs: 100_000,
  lac: 100_000,
  m: 1_000_000,
  mn: 1_000_000,
  million: 1_000_000,
  cr: 10_000_000,
  crore: 10_000_000,
  crores: 10_000_000,
};

// number (with optional commas/decimal) optionally followed by a unit word.
// The comma-grouped alternative requires at least one group (`+`) so that a plain
// number like "1450" falls through to the `\d+` branch instead of being clipped
// to its first three digits ("145").
const AMOUNT_RE =
  /₹?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(crores?|cr|lakhs?|lakh|lac|l|thousand|k|million|mn|m)?/i;

/**
 * Parse the first money-like token from a message. Returns null if none found.
 */
export function parseAmount(input: string): ParsedAmount | null {
  const match = AMOUNT_RE.exec(input);
  if (!match) return null;

  const numericRaw = match[1];
  const unitRaw = match[2];
  if (!numericRaw) return null;

  const base = Number(numericRaw.replace(/,/g, ""));
  if (!Number.isFinite(base)) return null;

  const multiplier = unitRaw ? UNIT_MULTIPLIERS[unitRaw.toLowerCase()] ?? 1 : 1;
  const amount = Math.round(base * multiplier);

  return { amount, raw: match[0].trim() };
}

/**
 * Replace the parsed amount with a placeholder so it never reaches an AI provider
 * (PRD §6.3 FR-3.3, §11). e.g. "Dining 400" -> "Dining <AMT>".
 */
export function maskAmount(input: string, parsed: ParsedAmount): string {
  return input.replace(parsed.raw, "<AMT>").replace(/\s{2,}/g, " ").trim();
}
