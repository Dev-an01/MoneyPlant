// The ingestion pipeline (PRD §6.3): raw chat text → structured transaction draft.
//   1. Deterministic amount parse (never the AI's job).
//   2. Mask the amount so it never leaves our infra.
//   3. Categorize via the cascade: keyword map (free) → AI fallback (ambiguous only).
// Used by both the bot and the dashboard "quick add".

import type { TxnType } from "@moneyplant/shared";
import { parseAmount, maskAmount } from "./amount";
import { categorizeCascade, type CategorizeProvider } from "./categorize";
import { createAnthropicProvider } from "./anthropic";

export interface IngestResult {
  /** Rupees (major units); null when no amount could be parsed. */
  amount: number | null;
  /** Amount-masked text that was sent to categorization. */
  maskedText: string;
  category: string;
  type: TxnType;
  subtype?: string;
  /** 0..1 */
  confidence: number;
  stage: "keyword" | "ai" | "manual";
  /** Human note for the transaction (the description minus the amount). */
  note: string;
}

export async function ingestMessage(
  text: string,
  provider: CategorizeProvider,
): Promise<IngestResult> {
  const trimmed = text.trim();
  const parsed = parseAmount(trimmed);
  const masked = parsed ? maskAmount(trimmed, parsed) : trimmed;

  const result = await categorizeCascade(masked, provider);

  // Note = the masked description without the placeholder; fall back to the category.
  const note = masked.replace(/<AMT>/g, "").replace(/\s{2,}/g, " ").trim() || result.category;

  return {
    amount: parsed ? parsed.amount : null,
    maskedText: masked,
    category: result.category,
    type: result.type,
    subtype: result.subtype,
    confidence: result.confidence,
    stage: result.stage,
    note,
  };
}

// AI fallback when the keyword map misses. With no provider key configured we use
// a conservative stub (low confidence, "Other / Misc") so the pipeline still
// produces a reviewable pending entry — the user corrects the category in-app.
// Swapping in a real provider (Anthropic/OpenAI/local) is a one-file change here.
export const stubProvider: CategorizeProvider = {
  async categorize() {
    // Everything the keyword map didn't recognize lands here for the user to fix.
    return { category: "Other / Misc", type: "expense", confidence: 0.3, stage: "ai" };
  },
};

// The provider the app uses: real Claude categorization when ANTHROPIC_API_KEY is
// configured, else the conservative stub. Memoized so the SDK client is reused.
let _default: CategorizeProvider | null = null;
export function defaultProvider(): CategorizeProvider {
  if (_default) return _default;
  _default = process.env.ANTHROPIC_API_KEY ? createAnthropicProvider() : stubProvider;
  return _default;
}
