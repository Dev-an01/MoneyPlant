// Typed client for the MoneyPlant API. Every call is same-origin and relies on
// the Auth.js session cookie, so no tokens are threaded through the UI.
import type { AnalyticsDTO, TxnDTO, PendingDTO, HoldingDTO } from "@moneyplant/shared";
import type { TxRow } from "./data";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json() as Promise<T>;
}

// Map a server transaction to the row shape the table/derivations already use.
export function dtoToRow(d: TxnDTO): TxRow {
  const dt = new Date(d.txnTime);
  return {
    id: d.id,
    day: dt.getUTCDate(),
    time: dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }),
    category: d.category,
    note: d.note ?? "",
    type: d.type,
    amount: d.amount,
  };
}

export const api = {
  async analytics(month?: string): Promise<AnalyticsDTO> {
    const q = month ? `?month=${encodeURIComponent(month)}` : "";
    return json(await fetch(`/api/analytics${q}`, { cache: "no-store" }));
  },
  async transactions(type: "all" | "expense" | "investment" = "all", q = ""): Promise<TxRow[]> {
    const params = new URLSearchParams();
    if (type !== "all") params.set("type", type);
    if (q) params.set("q", q);
    const data = await json<{ transactions: TxnDTO[] }>(
      await fetch(`/api/transactions?${params}`, { cache: "no-store" }),
    );
    return data.transactions.map(dtoToRow);
  },
  async pending(): Promise<PendingDTO[]> {
    const data = await json<{ pending: PendingDTO[] }>(await fetch("/api/pending", { cache: "no-store" }));
    return data.pending;
  },
  async ingest(text: string): Promise<PendingDTO> {
    const data = await json<{ pending: PendingDTO }>(
      await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }),
    );
    return data.pending;
  },
  async patchTxn(id: string, patch: Partial<Pick<TxRow, "category" | "note"> & { amount: number; type: string }>) {
    return json(
      await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    );
  },
  async deleteTxn(id: string) {
    return json(await fetch(`/api/transactions/${id}`, { method: "DELETE" }));
  },
  async resolvePending(id: string, action: "commit" | "cancel") {
    return json(
      await fetch(`/api/pending/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }),
    );
  },
  async seed() {
    return json(await fetch("/api/seed", { method: "POST" }));
  },
  async telegramStatus(): Promise<{ connected: boolean; phone: string | null }> {
    return json(await fetch("/api/telegram/status", { cache: "no-store" }));
  },
  async telegramLinkCode(): Promise<{ code: string; deepLink: string | null; botUsername: string | null; expiresInMin: number }> {
    return json(await fetch("/api/telegram/link-code", { method: "POST" }));
  },
  async valuation(): Promise<{ valued: number; skipped: number; holdings: HoldingDTO[] }> {
    return json(await fetch("/api/valuation", { method: "POST" }));
  },
  async telegramUnlink(): Promise<{ connected: boolean }> {
    return json(
      await fetch("/api/telegram/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlink" }),
      }),
    );
  },
};
