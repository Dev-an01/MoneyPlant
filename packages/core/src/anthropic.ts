// Claude-backed categorization provider (PRD §6.3 stage 3 — the AI fallback).
// Receives ONLY amount-masked text (the deterministic parser strips the amount
// first, PRD §11), returns a category + type constrained to our taxonomy.
// Activates when ANTHROPIC_API_KEY is set; otherwise the pipeline uses the stub.
import Anthropic from "@anthropic-ai/sdk";
import { EXPENSE_CATEGORIES, INVESTMENT_CATEGORIES, type TxnType } from "@moneyplant/shared";
import type { CategorizeProvider, CategorizeResult } from "./categorize";

// Default to the most capable model; override for a cheaper/faster classifier
// with MONEYPLANT_AI_MODEL (e.g. claude-haiku-4-5).
const MODEL = process.env.MONEYPLANT_AI_MODEL || "claude-opus-4-8";

const EXPENSE = new Set<string>(EXPENSE_CATEGORIES);
const INVESTMENT = new Set<string>(INVESTMENT_CATEGORIES);

const SYSTEM =
  "You categorize a personal-finance transaction from a short description. The monetary amount " +
  "has been removed and replaced with the token <AMT> — never ask for or infer it.\n\n" +
  "Reply with ONLY a JSON object (no prose, no code fence): " +
  `{"category": <one of the allowed categories>, "type": "expense" | "investment", "confidence": <0..1>}.\n\n` +
  `Expense categories: ${EXPENSE_CATEGORIES.join(", ")}.\n` +
  `Investment categories (money moved into an asset): ${INVESTMENT_CATEGORIES.join(", ")}.\n\n` +
  'If genuinely unclear, use "Other / Misc" with low confidence.';

export function createAnthropicProvider(client = new Anthropic()): CategorizeProvider {
  return {
    async categorize(maskedText: string): Promise<CategorizeResult> {
      try {
        const res = await client.messages.create({
          model: MODEL,
          max_tokens: 200,
          system: SYSTEM,
          messages: [{ role: "user", content: maskedText }],
        });
        if (res.stop_reason === "refusal") return fallback();
        const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
        if (!text) return fallback();

        const parsed = JSON.parse(extractJson(text)) as {
          category?: string;
          type?: string;
          confidence?: number;
        };
        return validate(parsed);
      } catch {
        // Never let the tracker fail because the AI is unavailable — degrade gracefully.
        return fallback();
      }
    },
  };
}

// Tolerate a stray code fence or surrounding text by grabbing the first {...}.
function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

function validate(p: { category?: string; type?: string; confidence?: number }): CategorizeResult {
  const category = p.category ?? "";
  const isExpense = EXPENSE.has(category);
  const isInvestment = INVESTMENT.has(category);
  if (!isExpense && !isInvestment) return fallback();
  const type: TxnType = isInvestment ? "investment" : "expense";
  const confidence = typeof p.confidence === "number" ? Math.max(0, Math.min(1, p.confidence)) : 0.6;
  return { category, type, confidence, stage: "ai" };
}

function fallback(): CategorizeResult {
  return { category: "Other / Misc", type: "expense", confidence: 0.3, stage: "ai" };
}
