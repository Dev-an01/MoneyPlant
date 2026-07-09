"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { Icon, PlantLogo } from "./icons";
import { fmt, pct, mmss } from "@/lib/format";
import * as D from "@/lib/data";
import { api } from "@/lib/api";
import type { AnalyticsDTO, PendingDTO } from "@moneyplant/shared";

type Screen =
  | "overview"
  | "transactions"
  | "spending"
  | "insights"
  | "portfolio"
  | "pending"
  | "privacy"
  | "settings";

interface PendingState {
  id: string;
  amount: number;
  category: string;
  type: "expense" | "investment";
  message: string;
  endsAt: number;
  totalSec: number;
  editing: boolean;
  draftCategory: string;
  draftAmount: string;
}

function toPendingState(p: PendingDTO): PendingState {
  return { ...p, editing: false, draftCategory: p.category, draftAmount: String(p.amount) };
}

const NAV: { key: Screen; label: string; icon: Parameters<typeof Icon>[0]["name"] }[] = [
  { key: "overview", label: "Overview", icon: "overview" },
  { key: "transactions", label: "Transactions", icon: "transactions" },
  { key: "spending", label: "Spending", icon: "spending" },
  { key: "insights", label: "Monthly Insights", icon: "insights" },
  { key: "portfolio", label: "Portfolio", icon: "portfolio" },
  { key: "pending", label: "Pending", icon: "pending" },
  { key: "privacy", label: "Privacy & Trust", icon: "privacy" },
  { key: "settings", label: "Settings", icon: "settings" },
];

const TITLES: Record<Screen, { title: string; sub: string }> = {
  overview: { title: "Overview", sub: "June 2026" },
  transactions: { title: "Transactions", sub: "Your ledger" },
  spending: { title: "Spending", sub: "Where your money goes" },
  insights: { title: "Monthly Insights", sub: "Spend & invest, by month" },
  portfolio: { title: "Portfolio", sub: "Invested vs current value" },
  pending: { title: "Pending", sub: "5-minute grace window" },
  privacy: { title: "Privacy & Trust", sub: "How your data flows" },
  settings: { title: "Settings", sub: "Account & preferences" },
};

function TypeTag({ type }: { type: "expense" | "investment" }) {
  return type === "investment" ? (
    <span className="text-[11px] font-semibold px-2 py-[3px] rounded-md bg-[#EAF0E7] text-brand">
      Investment
    </span>
  ) : (
    <span className="text-[11px] font-semibold px-2 py-[3px] rounded-md bg-[#F1E3D5] text-clay-deep">
      Expense
    </span>
  );
}

export function Dashboard() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "expense" | "investment">("all");
  const [transactions, setTransactions] = useState<D.TxRow[]>([]);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ category: "", note: "", amount: "" });
  const [pending, setPending] = useState<PendingState[]>([]);
  const [now, setNow] = useState(0);
  const [txLoading, setTxLoading] = useState(true);
  const [A, setA] = useState<AnalyticsDTO | null>(null);
  const [spendA, setSpendA] = useState<AnalyticsDTO | null>(null);
  const [insightA, setInsightA] = useState<AnalyticsDTO | null>(null);
  const [spendIdx, setSpendIdx] = useState(0);
  const [insightIdx, setInsightIdx] = useState(0);
  const [expenseCats, setExpenseCats] = useState<string[]>(D.expenseCategories);
  const [investCats, setInvestCats] = useState<string[]>(D.investmentCategories);
  const [newCat, setNewCat] = useState("");
  const [quickAdd, setQuickAdd] = useState("");
  const [tgConnected, setTgConnected] = useState<boolean | null>(null);
  const [tgPhone, setTgPhone] = useState<string | null>(null);
  const [tgLink, setTgLink] = useState<{ code: string; deepLink: string | null; botUsername: string | null; expiresInMin: number } | null>(null);
  const [toast, setToast] = useState<{ text: string; visible: boolean }>({ text: "", visible: false });

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const showToast = useCallback((text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, visible: true });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2600);
  }, []);

  // Load the signed-in user's ledger, pending queue, and analytics from the API.
  const loadAll = useCallback(async () => {
    const [tx, pend, analytics] = await Promise.all([
      api.transactions("all", ""),
      api.pending(),
      api.analytics(),
    ]);
    setTransactions(tx);
    setPending(pend.map(toPendingState));
    setA(analytics);
    setTxLoading(false);
    api
      .telegramStatus()
      .then((s) => {
        setTgConnected(s.connected);
        setTgPhone(s.phone);
      })
      .catch(() => setTgConnected(false));
  }, []);

  const refreshLedger = useCallback(async () => {
    const [tx, analytics] = await Promise.all([api.transactions("all", ""), api.analytics()]);
    setTransactions(tx);
    setA(analytics);
  }, []);

  // mount: load data, run the countdown, and reflect server auto-commits.
  useEffect(() => {
    loadAll().catch(() => setTxLoading(false));
    setNow(Date.now());
    const tick = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const due = pendingRef.current.filter((p) => p.endsAt && p.endsAt <= t);
      if (due.length) {
        // The server auto-commits entries past their window on the next read.
        setPending((prev) => prev.filter((p) => !(p.endsAt && p.endsAt <= t)));
        showToast(`Committed ${fmt(due[0]!.amount)} · ${due[0]!.category}`);
        refreshLedger().catch(() => {});
      }
    }, 1000);
    return () => {
      clearInterval(tick);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [loadAll, refreshLedger, showToast]);

  // Once analytics loads, point the month selectors at the current month.
  const monthKey = A?.month.key;
  useEffect(() => {
    if (!A) return;
    const idx = Math.max(0, A.months.findIndex((m) => m.key === A.month.key));
    setSpendIdx(idx);
    setInsightIdx(idx);
    setSpendA(A);
    setInsightA(A);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  // Fetch per-month analytics for the Spending / Insights month pickers.
  const months = A?.months ?? [];
  const spendKey = months[spendIdx]?.key;
  const insightKey = months[insightIdx]?.key;
  useEffect(() => {
    if (!spendKey) return;
    if (A && spendKey === A.month.key) return setSpendA(A);
    api.analytics(spendKey).then(setSpendA).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spendKey]);
  useEffect(() => {
    if (!insightKey) return;
    if (A && insightKey === A.month.key) return setInsightA(A);
    api.analytics(insightKey).then(setInsightA).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insightKey]);

  // ---------- derived (from server analytics; month-scoped) ----------
  const expenseTotal = A?.expenseTotal ?? 0;
  const investTotal = A?.investTotal ?? 0;
  const invested = A?.portfolio.invested ?? 0;
  const currentValue = A?.portfolio.current ?? 0;
  const portfolioPnl = A?.portfolio.pnl ?? 0;
  const portfolioPnlPct = A?.portfolio.pnlPct ?? 0;
  const holdings = A?.portfolio.holdings ?? [];
  const where = useMemo(() => (A ? D.catAggFromSlices(A.byCategory) : []), [A]);
  const bars = useMemo(() => (A ? D.barsFromDaily(A.daily) : []), [A]);
  const biggest = A?.topExpenses ?? [];
  const expCount = A?.txCount ?? 0;
  const lastMonthExpense = A?.lastMonthExpense ?? 0;
  const monthLabel = A?.month.label ?? "";
  const currentMonthIdx = Math.max(0, months.findIndex((m) => m.key === A?.month.key));

  const filteredTx = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (q && !(`${t.note} ${t.category}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [transactions, filterType, search]);

  // ---------- handlers ----------
  const nav = (s: Screen) => setScreen(s);

  const startEdit = (t: D.TxRow) => {
    setEditingTxId(t.id);
    setDraft({ category: t.category, note: t.note, amount: String(t.amount) });
  };
  const saveEdit = () => {
    const id = editingTxId;
    const amount = Number(draft.amount);
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, category: draft.category, note: draft.note, amount: amount || t.amount } : t,
      ),
    );
    setEditingTxId(null);
    showToast("Saved changes");
    if (id)
      api
        .patchTxn(id, { category: draft.category, note: draft.note, ...(amount ? { amount } : {}) })
        .then(refreshLedger)
        .catch(() => refreshLedger());
  };
  const deleteTx = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    showToast("Entry deleted");
    api.deleteTxn(id).then(refreshLedger).catch(() => refreshLedger());
  };
  const exportCsv = () => {
    window.open("/api/export", "_blank");
    showToast("Exported CSV — check your downloads");
  };

  const pendEdit = (id: string) =>
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, editing: true } : p)));
  const pendSave = (id: string) => {
    const entry = pendingRef.current.find((p) => p.id === id);
    const amount = entry ? Number(entry.draftAmount) : 0;
    setPending((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, editing: false, category: p.draftCategory, amount: amount || p.amount }
          : p,
      ),
    );
    if (entry)
      api.patchTxn(id, { category: entry.draftCategory, ...(amount ? { amount } : {}) }).catch(() => {});
  };
  const pendCancel = (id: string) => {
    setPending((prev) => prev.filter((p) => p.id !== id));
    showToast("Pending entry cancelled");
    api.resolvePending(id, "cancel").catch(() => {});
  };
  const pendCommit = (id: string) => {
    const entry = pendingRef.current.find((p) => p.id === id);
    setPending((prev) => prev.filter((p) => p.id !== id));
    if (entry) showToast(`Committed ${fmt(entry.amount)} · ${entry.category}`);
    api.resolvePending(id, "commit").then(refreshLedger).catch(() => refreshLedger());
  };
  const submitQuickAdd = () => {
    const text = quickAdd.trim();
    if (!text) return;
    setQuickAdd("");
    api
      .ingest(text)
      .then((p) => {
        setPending((prev) => [toPendingState(p), ...prev]);
        setScreen("pending");
        showToast(`Pending · ${p.category} ${fmt(p.amount)}`);
      })
      .catch((e) => showToast(typeof e?.message === "string" ? e.message : "Couldn't add that"));
  };

  const addCat = () => {
    const v = newCat.trim();
    if (!v) return;
    setExpenseCats((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setNewCat("");
    showToast(`Added “${v}”`);
  };

  const [revaluing, setRevaluing] = useState(false);
  const revalue = async () => {
    setRevaluing(true);
    try {
      const r = await api.valuation();
      await refreshLedger();
      showToast(r.valued ? `Repriced ${r.valued} fund${r.valued === 1 ? "" : "s"}` : "No funds to reprice");
    } catch {
      showToast("Couldn’t reach the NAV feed");
    } finally {
      setRevaluing(false);
    }
  };

  const connectTelegram = async () => {
    try {
      const link = await api.telegramLinkCode();
      setTgLink(link);
      if (link.deepLink) window.open(link.deepLink, "_blank", "noopener");
    } catch {
      showToast("Couldn’t generate a connect link");
    }
  };
  const unlinkTelegram = async () => {
    try {
      await api.telegramUnlink();
      setTgConnected(false);
      setTgPhone(null);
      setTgLink(null);
      showToast("Telegram disconnected");
    } catch {
      showToast("Couldn’t disconnect");
    }
  };
  // While a connect code is live, poll until the bot links the chat.
  useEffect(() => {
    if (!tgLink || tgConnected) return;
    const iv = setInterval(() => {
      api
        .telegramStatus()
        .then((s) => {
          if (s.connected) {
            setTgConnected(true);
            setTgPhone(s.phone);
            setTgLink(null);
            showToast("Telegram connected ✓");
          }
        })
        .catch(() => {});
    }, 3000);
    const stop = setTimeout(() => clearInterval(iv), 120_000);
    return () => {
      clearInterval(iv);
      clearTimeout(stop);
    };
  }, [tgLink, tgConnected, showToast]);

  const remainingSec = (p: PendingState) =>
    p.endsAt && now ? Math.max(0, (p.endsAt - now) / 1000) : p.totalSec;

  const t = TITLES[screen];
  const headerSub = screen === "overview" && monthLabel ? monthLabel : t.sub;

  return (
    <div className="min-h-screen bg-paper flex">
      {/* ===== Sidebar (desktop) ===== */}
      <aside className="w-[248px] shrink-0 sticky top-0 h-screen bg-card border-r border-line flex-col pt-[26px] px-[18px] pb-[18px] hidden md:flex">
        <div className="flex items-center gap-[10px] px-2 pb-1">
          <div className="w-[30px] h-[30px] rounded-lg bg-brand flex items-center justify-center shrink-0">
            <PlantLogo />
          </div>
          <div className="font-serif font-semibold text-[19px] tracking-[-0.01em]">MoneyPlant</div>
        </div>

        <nav className="mt-[26px] flex flex-col gap-[2px] flex-1">
          {NAV.map((item) => {
            const active = screen === item.key;
            return (
              <button
                key={item.key}
                onClick={() => nav(item.key)}
                className={`flex items-center gap-3 px-3 py-[9px] rounded-[9px] text-[14px] font-medium text-left w-full transition-colors ${
                  active ? "bg-[#E7DFD0] text-ink" : "text-muted-2 hover:bg-[#EBE3D4]"
                }`}
              >
                <span className={`flex w-[19px] h-[19px] shrink-0 ${active ? "text-brand" : ""}`}>
                  <Icon name={item.icon} size={18} />
                </span>
                <span className="flex-1">{item.label}</span>
                {item.key === "pending" && pending.length > 0 && (
                  <span className="bg-clay text-card text-[11px] font-bold min-w-[19px] h-[19px] rounded-[10px] flex items-center justify-center px-[5px] font-mono">
                    {pending.length}
                  </span>
                )}
              </button>
            );
          })}
          <div className="flex items-center gap-3 px-3 py-[9px] text-[14px] text-faint font-medium cursor-default">
            <span className="flex w-[19px] h-[19px] shrink-0">
              <Icon name="budgets" size={18} strokeWidth={1.7} />
            </span>
            <span className="flex-1">Budgets</span>
            <span className="text-[10.5px] tracking-[0.06em] uppercase text-faint border border-[#DDD3C0] rounded-[5px] px-[6px] py-[2px]">
              Soon
            </span>
          </div>
        </nav>

        <button
          onClick={() => nav("settings")}
          className="border-t border-line pt-[14px] px-[10px] pb-1 flex items-start gap-[10px] text-left w-full hover:opacity-80"
        >
          <span
            className={`w-2 h-2 rounded-full mt-[5px] shrink-0 ${tgConnected ? "bg-gain shadow-[0_0_0_3px_rgba(47,122,79,0.16)]" : "bg-[#C3B9A4]"}`}
          />
          <div className="leading-[1.4]">
            <div className="text-[12.5px] font-semibold text-[#3A362E]">
              {tgConnected ? "Telegram connected" : "Telegram not connected"}
            </div>
            <div className="text-[12px] text-muted">{tgConnected ? "Text the bot to log" : "Settings → Connect"}</div>
          </div>
        </button>
      </aside>

      {/* ===== Main ===== */}
      <main className="flex-1 min-w-0 flex flex-col pb-[72px] md:pb-0">
        <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur border-b border-line px-5 md:px-8 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0 flex items-baseline gap-3">
            <h1 className="m-0 font-serif font-semibold text-[20px] md:text-[24px] tracking-[-0.02em] text-ink whitespace-nowrap">
              {t.title}
            </h1>
            <span className="text-[13px] text-muted whitespace-nowrap hidden sm:inline">{headerSub}</span>
          </div>
          <div className="hidden sm:flex items-center gap-[10px] bg-card border border-line rounded-[9px] px-[11px] py-2 w-[240px] max-w-[300px]">
            <Icon name="search" size={16} strokeWidth={1.8} className="text-muted" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value && screen !== "transactions") setScreen("transactions");
              }}
              placeholder="Search transactions…"
              className="border-0 bg-transparent outline-none text-[14px] w-full text-ink placeholder:text-faint"
            />
          </div>
          <button
            onClick={() => nav("settings")}
            title="Account"
            className="w-9 h-9 rounded-full bg-brand text-card font-semibold text-[14px] flex items-center justify-center shrink-0 font-serif hover:bg-brand-dark"
          >
            AR
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1040px] mx-auto px-5 md:px-8 py-6 md:py-7 animate-mp-rise" key={screen}>
            {screen === "overview" && renderOverview()}
            {screen === "transactions" && renderTransactions()}
            {screen === "spending" && renderSpending()}
            {screen === "insights" && renderInsights()}
            {screen === "portfolio" && renderPortfolio()}
            {screen === "pending" && renderPending()}
            {screen === "privacy" && renderPrivacy()}
            {screen === "settings" && renderSettings()}
          </div>
        </div>
      </main>

      {/* ===== Mobile bottom nav ===== */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-line flex px-[6px] pt-[7px] pb-[calc(7px+env(safe-area-inset-bottom))] justify-around md:hidden">
        {([
          ["overview", "Overview", "overview"],
          ["transactions", "Ledger", "transactions"],
          ["portfolio", "Portfolio", "portfolio"],
          ["pending", "Pending", "pending"],
          ["settings", "Settings", "settings"],
        ] as [Screen, string, Parameters<typeof Icon>[0]["name"]][]).map(([key, label, icon]) => {
          const active = screen === key;
          return (
            <button
              key={key}
              onClick={() => nav(key)}
              className={`flex flex-col items-center gap-[3px] px-3 py-1 rounded-lg ${active ? "text-brand" : "text-muted"}`}
            >
              <span className="relative flex w-[21px] h-[21px]">
                <Icon name={icon} size={21} />
                {key === "pending" && pending.length > 0 && (
                  <span className="absolute -top-[5px] -right-[7px] bg-clay text-card text-[9px] font-bold min-w-[15px] h-[15px] rounded-lg flex items-center justify-center px-[3px] font-mono">
                    {pending.length}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* ===== Toast ===== */}
      {toast.visible && (
        <div className="fixed bottom-[88px] md:bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-ink text-paper rounded-[11px] px-[18px] py-3 flex items-center gap-[10px] shadow-[0_12px_34px_rgba(28,26,22,0.32)] animate-mp-toast text-[13.5px] font-medium">
          <span className="w-2 h-2 rounded-full bg-gain-light shrink-0" />
          {toast.text}
        </div>
      )}
    </div>
  );

  // =================== SCREENS ===================

  function renderOverview() {
    const investShare = expenseTotal + investTotal ? (investTotal / (expenseTotal + investTotal)) * 100 : 0;
    const deltaPct = A?.deltaPct ?? 0;
    const up = deltaPct >= 0;
    const topExpense = biggest[0];
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-stretch">
          <section className="mp-card px-[26px] py-6">
            <div className="mp-eyebrow">{monthLabel} cash flow</div>
            <div className="flex flex-wrap gap-[30px] mt-[18px]">
              <div>
                <div className="text-[12.5px] text-[#857C6B] mb-[5px]">Money out · expenses</div>
                <div className="mp-serif text-[34px] font-semibold tracking-[-0.02em]">{fmt(expenseTotal)}</div>
              </div>
              <div className="border-l border-line pl-[30px]">
                <div className="text-[12.5px] text-[#857C6B] mb-[5px]">Into investments</div>
                <div className="mp-serif text-[34px] font-semibold tracking-[-0.02em] text-brand">{fmt(investTotal)}</div>
              </div>
            </div>
            <div className="mt-5 h-[10px] rounded-md overflow-hidden flex bg-neutral-fill">
              <div className="bg-clay" style={{ width: `${100 - investShare}%` }} />
              <div className="bg-brand" style={{ width: `${investShare}%` }} />
            </div>
            <div className="mt-[11px] text-[13px] text-muted-2 leading-[1.5]">
              You directed <strong className="text-brand">{Math.round(investShare)}%</strong> of this month&apos;s
              outflow into investments. <span className="text-muted">Net out {fmt(expenseTotal)}.</span>
            </div>
          </section>

          <section className="bg-ink text-paper rounded-[14px] px-[26px] py-6 flex flex-col justify-center">
            <div className="text-[12px] tracking-[0.07em] uppercase text-[#9A9281] font-semibold">Spend vs last month</div>
            <div className="mp-serif text-[40px] font-semibold tracking-[-0.02em] mt-[10px]">{fmt(expenseTotal)}</div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-1 font-semibold text-[14px] font-mono ${up ? "text-[#E0A86A]" : "text-gain-light"}`}>
                {up ? "▲" : "▼"} {pct(deltaPct)}
              </span>
              <span className="text-[13px] text-[#9A9281]">vs {fmt(lastMonthExpense)} last month</span>
            </div>
            {topExpense && (
              <div className="mt-[14px] text-[12.5px] text-[#B7AF9D] leading-[1.5] border-t border-[#34302A] pt-3">
                Largest this month — <strong className="text-[#D9A766]">{topExpense.category} {fmt(topExpense.amount)}</strong>.
              </div>
            )}
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
          <section className="mp-card px-6 py-[22px]">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-[15px] font-semibold">Spend over {monthLabel}</div>
              <div className="text-[12px] text-muted">Daily · cap ₹4,000</div>
            </div>
            <div className="flex items-end gap-1 h-[140px] mt-[22px]">
              {bars.map((b) => (
                <div key={b.day} title={`Day ${b.day} · ${fmt(b.value)}`} className="flex-1 flex flex-col items-center justify-end h-full gap-[6px] relative">
                  {b.outlier && (
                    <span className="absolute -top-4 text-[10px] font-semibold text-clay font-mono whitespace-nowrap">{b.outLabel}</span>
                  )}
                  <div className="w-full max-w-[18px] rounded-t" style={{ height: `${b.h}%`, background: b.color }} />
                  <span className="text-[10px] text-faint font-mono">{b.day}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mp-card px-6 py-[22px]">
            <div className="text-[15px] font-semibold mb-1">Where it went</div>
            <div className="text-[12px] text-muted mb-[14px]">Tap a category to see entries</div>
            <div className="flex flex-col">
              {where.slice(0, 6).map((w) => (
                <button
                  key={w.category}
                  onClick={() => {
                    setFilterType("expense");
                    setSearch(w.category);
                    setScreen("transactions");
                  }}
                  className="flex flex-col gap-[7px] py-[11px] border-b border-line-soft text-left w-full hover:opacity-70"
                >
                  <div className="flex justify-between items-baseline gap-[10px]">
                    <span className="text-[13.5px] font-medium text-[#3A362E]">{w.category}</span>
                    <span className="mp-num text-[13px] font-medium">
                      {fmt(w.amount)}
                      <span className="text-faint text-[11.5px] ml-[7px]">{Math.round(w.pct)}%</span>
                    </span>
                  </div>
                  <div className="h-[5px] rounded bg-neutral-fill overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${w.barW}%`, background: w.color }} />
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <section className="mp-card px-6 py-[22px]">
            <div className="flex items-baseline justify-between">
              <div className="text-[15px] font-semibold">Portfolio</div>
              <button onClick={() => nav("portfolio")} className="text-[12.5px] text-brand font-semibold hover:underline">
                View all →
              </button>
            </div>
            <div className="mp-serif text-[36px] font-semibold tracking-[-0.02em] mt-[14px]">{fmt(currentValue)}</div>
            <div className="flex items-center gap-2 mt-[6px]">
              <span className="mp-num font-semibold text-[14px] text-gain">{fmt(portfolioPnl, true)}</span>
              <span className="mp-num text-[13px] text-gain">({pct(portfolioPnlPct)})</span>
              <span className="text-[12.5px] text-muted">all-time</span>
            </div>
            <div className="mt-[14px] text-[12px] text-faint flex items-center gap-[6px]">
              <Icon name="clock" size={13} strokeWidth={1.8} /> Values from batch refresh · updated 2h ago
            </div>
          </section>

          <section className="mp-card px-6 py-[22px]">
            <div className="flex items-center justify-between mb-[6px]">
              <div className="text-[15px] font-semibold">Recent activity</div>
              <button onClick={() => nav("pending")} className="flex items-center gap-[7px] text-[12.5px] font-semibold text-clay hover:opacity-75">
                <span className="w-[7px] h-[7px] rounded-full bg-clay animate-mp-pulse" />
                {pending.length} pending
              </button>
            </div>
            <div>
              {transactions.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center gap-[14px] py-[11px] border-b border-line-soft">
                  <div
                    className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0"
                    style={
                      r.type === "investment"
                        ? { background: "#EAF0E7", color: "#2E5D45" }
                        : { background: "#F1E3D5", color: "#A06628" }
                    }
                  >
                    <Icon name={r.type === "investment" ? "invest" : "expense"} size={17} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium text-ink-soft truncate">{r.note}</div>
                    <div className="text-[12px] text-muted">{r.category} · {r.time}</div>
                  </div>
                  <div className={`mp-num text-[13.5px] font-medium whitespace-nowrap ${r.type === "investment" ? "text-brand" : "text-ink"}`}>
                    {fmt(r.amount)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  function renderTransactions() {
    const filters: { key: typeof filterType; label: string }[] = [
      { key: "all", label: "All" },
      { key: "expense", label: "Expenses" },
      { key: "investment", label: "Investments" },
    ];
    const empty = !txLoading && filteredTx.length === 0;
    return (
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-[18px]">
          <div className="flex bg-[#E7DFD0] rounded-[9px] p-[3px] gap-[2px]">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterType(f.key)}
                className={`text-[13px] font-semibold rounded-[7px] px-[13px] py-[6px] ${
                  filterType === f.key ? "bg-card text-ink shadow-sm" : "text-muted-2 hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {search && (
            <div className="flex items-center gap-2 text-[13px] text-muted-2 bg-[#F1E9D6] border border-[#E0CFA8] rounded-lg px-[10px] py-[6px]">
              Filtered: <strong>{search}</strong>
              <button onClick={() => setSearch("")} className="text-clay font-semibold">clear</button>
            </div>
          )}
          <div className="flex-1" />
          <button
            onClick={exportCsv}
            className="flex items-center gap-[7px] text-[13px] font-semibold text-ink-soft border border-[#D8CFBE] rounded-[9px] px-[13px] py-2 bg-card hover:bg-[#EBE3D4]"
          >
            <Icon name="download" size={15} strokeWidth={1.8} />
            Export CSV
          </button>
        </div>

        <div className="mp-card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-[96px_150px_1fr_110px_130px_84px] gap-[14px] px-[22px] py-[13px] border-b border-line text-[11.5px] tracking-[0.05em] uppercase text-muted font-semibold">
                <span>Time</span>
                <span>Category</span>
                <span>Note</span>
                <span>Type</span>
                <span className="text-right">Amount</span>
                <span />
              </div>

              {txLoading && (
                <div className="px-[22px] py-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="mp-skel h-5 my-[14px]" />
                  ))}
                </div>
              )}

              {empty && (
                <div className="px-[22px] py-16 text-center">
                  <div className="w-[50px] h-[50px] rounded-[13px] bg-[#EBE3D4] flex items-center justify-center mx-auto mb-4 text-faint">
                    <Icon name="search" size={24} strokeWidth={1.7} />
                  </div>
                  <div className="font-serif text-[19px] font-semibold">No matching entries</div>
                  <div className="text-[13.5px] text-muted mt-[5px]">Try a different filter or clear your search.</div>
                  <button
                    onClick={() => {
                      setFilterType("all");
                      setSearch("");
                    }}
                    className="mt-4 text-[13px] font-semibold text-brand border border-[#C7D2C2] rounded-lg px-[14px] py-2 hover:bg-[#ECEFE8]"
                  >
                    Reset filters
                  </button>
                </div>
              )}

              {!txLoading &&
                !empty &&
                filteredTx.map((t) =>
                  editingTxId === t.id ? (
                    <div key={t.id} className="px-[22px] py-[14px] bg-[#F1ECDF] border-l-[3px] border-brand">
                      <div className="flex flex-wrap gap-3 items-end">
                        <label className="flex flex-col gap-[5px] text-[11px] tracking-[0.04em] uppercase text-[#857C6B] font-semibold">
                          Category
                          <select
                            value={draft.category}
                            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                            className="text-[14px] px-[10px] py-2 border border-[#D2C8B5] rounded-lg bg-field min-w-[150px]"
                          >
                            {[...expenseCats, ...investCats].map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-[5px] text-[11px] tracking-[0.04em] uppercase text-[#857C6B] font-semibold flex-1 min-w-[160px]">
                          Note
                          <input
                            value={draft.note}
                            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                            className="text-[14px] px-[10px] py-2 border border-[#D2C8B5] rounded-lg bg-field w-full"
                          />
                        </label>
                        <label className="flex flex-col gap-[5px] text-[11px] tracking-[0.04em] uppercase text-[#857C6B] font-semibold">
                          Amount ₹
                          <input
                            value={draft.amount}
                            inputMode="numeric"
                            onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                            className="text-[14px] px-[10px] py-2 border border-[#D2C8B5] rounded-lg bg-field w-[130px] font-mono"
                          />
                        </label>
                        <div className="flex gap-2 ml-auto">
                          <button onClick={() => setEditingTxId(null)} className="text-[13px] font-semibold text-muted-2 border border-[#D2C8B5] rounded-lg px-[15px] py-[9px] hover:bg-[#EBE3D4]">
                            Cancel
                          </button>
                          <button onClick={saveEdit} className="text-[13px] font-semibold text-card bg-brand rounded-lg px-[17px] py-[9px] hover:bg-brand-dark">
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div key={t.id} className="grid grid-cols-[96px_150px_1fr_110px_130px_84px] gap-[14px] items-center px-[22px] py-[14px] border-b border-line-soft hover:bg-[#F1ECDF]/40">
                      <span className="mp-num text-[12.5px] text-[#857C6B]">
                        {t.time}
                        <span className="text-[#B5AB97]"> · {t.day}</span>
                      </span>
                      <span className="text-[13.5px] font-medium text-[#3A362E] truncate">{t.category}</span>
                      <span className="text-[13.5px] text-[#3A362E] truncate">{t.note}</span>
                      <span><TypeTag type={t.type} /></span>
                      <span className={`mp-num text-[14px] font-medium text-right ${t.type === "investment" ? "text-brand" : "text-ink"}`}>{fmt(t.amount)}</span>
                      <span className="flex gap-1 justify-end">
                        <button onClick={() => startEdit(t)} title="Edit" className="w-[30px] h-[30px] rounded-[7px] flex items-center justify-center text-[#857C6B] hover:bg-[#EBE3D4] hover:text-brand">
                          <Icon name="edit" size={15} strokeWidth={1.8} />
                        </button>
                        <button onClick={() => deleteTx(t.id)} title="Delete" className="w-[30px] h-[30px] rounded-[7px] flex items-center justify-center text-[#857C6B] hover:bg-[#F3E1DE] hover:text-danger">
                          <Icon name="trash" size={15} strokeWidth={1.8} />
                        </button>
                      </span>
                    </div>
                  ),
                )}
            </div>
          </div>
        </div>
        <div className="text-[12.5px] text-muted mt-3 px-1">
          {txLoading ? "Loading…" : `${filteredTx.length} ${filteredTx.length === 1 ? "entry" : "entries"}`}
        </div>
      </div>
    );
  }

  function renderSpending() {
    const sA = spendA ?? A;
    const m = months[spendIdx];
    if (!m) return null;
    const nextDisabled = spendIdx >= currentMonthIdx;
    const spendWhere = sA ? D.catAggFromSlices(sA.byCategory) : [];
    const spendTotal = sA?.expenseTotal ?? 0;
    return (
      <div>
        <div className="flex items-center gap-[14px] mb-[22px]">
          <button onClick={() => setSpendIdx((i) => Math.max(0, i - 1))} aria-label="Previous month" className="w-[34px] h-[34px] rounded-lg border border-[#D8CFBE] flex items-center justify-center text-muted-2 bg-card hover:bg-[#EBE3D4]">
            <Icon name="chevronLeft" size={16} strokeWidth={2} />
          </button>
          <div className="font-serif text-[22px] font-semibold min-w-[160px] text-center">{m.label}</div>
          <button onClick={() => setSpendIdx((i) => Math.min(currentMonthIdx, i + 1))} aria-label="Next month" disabled={nextDisabled} className={`w-[34px] h-[34px] rounded-lg border border-[#D8CFBE] flex items-center justify-center bg-card ${nextDisabled ? "opacity-40 cursor-not-allowed" : "text-muted-2 hover:bg-[#EBE3D4]"}`}>
            <Icon name="chevronRight" size={16} strokeWidth={2} />
          </button>
          <div className="flex-1" />
          {m.hasData && (
            <div className="text-right">
              <div className="text-[12px] text-muted">Total spent</div>
              <div className="mp-serif text-[26px] font-semibold">{fmt(spendTotal)}</div>
            </div>
          )}
        </div>

        {m.hasData ? (
          <section className="mp-card px-[26px] py-6">
            <div className="text-[13px] text-[#857C6B] mb-[14px]">Proportion of spend</div>
            <div className="h-[18px] rounded-[7px] overflow-hidden flex bg-neutral-fill">
              {spendWhere.map((s) => (
                <div key={s.category} title={`${s.category} · ${fmt(s.amount)}`} style={{ width: `${s.pct}%`, background: s.color }} />
              ))}
            </div>
            <div className="mt-[26px] flex flex-col">
              {spendWhere.map((s) => (
                <button
                  key={s.category}
                  onClick={() => {
                    setFilterType("expense");
                    setSearch(s.category);
                    setScreen("transactions");
                  }}
                  className="grid grid-cols-[14px_1fr_120px_70px_18px] gap-[14px] items-center py-[14px] border-b border-line-soft text-left w-full hover:opacity-70"
                >
                  <span className="w-[11px] h-[11px] rounded-[3px]" style={{ background: s.color }} />
                  <span className="text-[14px] font-medium text-ink-soft">{s.category}</span>
                  <span className="mp-num text-[14px] font-medium text-right">{fmt(s.amount)}</span>
                  <span className="mp-num text-[12.5px] text-muted text-right">{Math.round(s.pct)}%</span>
                  <span className="text-[#C3B9A4]"><Icon name="chevronRight" size={15} strokeWidth={2} /></span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <EmptyMonth label={m.label} />
        )}
      </div>
    );
  }

  function renderInsights() {
    const iA = insightA ?? A;
    const m = months[insightIdx];
    if (!m) return null;
    const nextDisabled = insightIdx >= currentMonthIdx;
    const iExpense = iA?.expenseTotal ?? 0;
    const iInvest = iA?.investTotal ?? 0;
    const iWhere = iA ? D.catAggFromSlices(iA.byCategory) : [];
    const iBars = iA ? D.barsFromDaily(iA.daily) : [];
    const iBiggest = iA?.topExpenses ?? [];
    const iCount = iA?.txCount ?? 0;
    const sixSpend = iA?.sixMonthSpend ?? [];
    const sixInvest = iA?.sixMonthInvest ?? [];
    const out = iExpense + iInvest;
    const spendShare = out ? (iExpense / out) * 100 : 0;
    const deltaPct = iA?.deltaPct ?? 0;
    const avg = sixSpend.length ? sixSpend.reduce((a, x) => a + x.value, 0) / sixSpend.length : 0;
    const avgPct = avg ? ((iExpense - avg) / avg) * 100 : 0;
    const mfAmt = iA?.investByCategory.find((s) => s.category === "Mutual Fund")?.amount ?? 0;
    const stockAmt = Math.max(0, iInvest - mfAmt);
    const invSum = iInvest || 1;
    const spendMax = Math.max(1, ...sixSpend.map((x) => x.value));
    const investMax = Math.max(1, ...sixInvest.map((x) => x.value));

    return (
      <div>
        <div className="flex items-center gap-[14px] mb-[22px]">
          <button onClick={() => setInsightIdx((i) => Math.max(0, i - 1))} aria-label="Previous month" className="w-[34px] h-[34px] rounded-lg border border-[#D8CFBE] flex items-center justify-center text-muted-2 bg-card hover:bg-[#EBE3D4]">
            <Icon name="chevronLeft" size={16} strokeWidth={2} />
          </button>
          <div className="font-serif text-[22px] font-semibold min-w-[172px] text-center">{m.label}</div>
          <button onClick={() => setInsightIdx((i) => Math.min(currentMonthIdx, i + 1))} aria-label="Next month" disabled={nextDisabled} className={`w-[34px] h-[34px] rounded-lg border border-[#D8CFBE] flex items-center justify-center bg-card ${nextDisabled ? "opacity-40 cursor-not-allowed" : "text-muted-2 hover:bg-[#EBE3D4]"}`}>
            <Icon name="chevronRight" size={16} strokeWidth={2} />
          </button>
        </div>

        {!m.hasData ? (
          <EmptyMonth label={m.label} insights />
        ) : (
          <div>
            <div className="bg-ink text-paper rounded-[14px] px-6 py-5 mb-6 flex items-start gap-[14px]">
              <span className="shrink-0 mt-[2px] text-[#D9A766]"><Icon name="digest" size={20} strokeWidth={1.8} /></span>
              <div className="font-serif text-[19px] leading-[1.5] tracking-[-0.01em]">
                You spent {fmt(iExpense)} across {iCount} entries in {m.label}. You also moved {fmt(iInvest)} into
                investments.
              </div>
            </div>

            <section className="mp-card px-6 py-5 mb-6">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <div className="mp-eyebrow">Money out this month</div>
                <div className="mp-serif text-[24px] font-semibold">{fmt(out)}</div>
              </div>
              <div className="mt-[14px] h-3 rounded-[7px] overflow-hidden flex bg-neutral-fill">
                <div className="bg-clay" style={{ width: `${spendShare}%` }} />
                <div className="bg-brand" style={{ width: `${100 - spendShare}%` }} />
              </div>
              <div className="mt-[11px] flex gap-[22px] text-[12.5px] text-muted-2 flex-wrap">
                <span className="inline-flex items-center gap-[7px]"><span className="w-[9px] h-[9px] rounded-[2px] bg-clay" />Spent {fmt(iExpense)}</span>
                <span className="inline-flex items-center gap-[7px]"><span className="w-[9px] h-[9px] rounded-[2px] bg-brand" />Invested {fmt(iInvest)} <span className="text-muted">(moved to assets, not gone)</span></span>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Spending story */}
              <section className="mp-card px-[26px] py-6">
                <div className="flex items-center gap-[9px] mb-4">
                  <span className="w-[9px] h-[9px] rounded-full bg-clay" />
                  <span className="text-[12px] tracking-[0.07em] uppercase text-clay-deep font-bold">Spending</span>
                </div>
                <div className="mp-serif text-[40px] font-semibold tracking-[-0.02em] leading-none">{fmt(iExpense)}</div>
                <div className="flex flex-wrap gap-x-[22px] gap-y-2 mt-[14px] text-[13px] text-muted-2">
                  <span>vs last month <strong className={`font-mono ${deltaPct >= 0 ? "text-clay" : "text-gain"}`}>{deltaPct >= 0 ? "▲" : "▼"} {pct(deltaPct)}</strong></span>
                  <span>vs 6-mo avg <strong className="font-mono">{pct(avgPct)}</strong></span>
                  <span><strong className="font-mono">{iCount}</strong> entries</span>
                </div>

                <div className="text-[11.5px] tracking-[0.05em] uppercase text-muted font-semibold mt-6 mb-3">Daily trend</div>
                <div className="flex items-end gap-1 h-[84px]">
                  {iBars.map((b) => (
                    <div key={b.day} title={`Day ${b.day} · ${fmt(b.value)}`} className="flex-1 flex flex-col items-center justify-end h-full relative">
                      {b.outlier && <span className="absolute -top-[15px] text-[9.5px] font-semibold text-clay font-mono">{b.outLabel}</span>}
                      <div className="w-full max-w-[14px] rounded-t-[3px]" style={{ height: `${b.h}%`, background: b.color }} />
                    </div>
                  ))}
                </div>

                <div className="text-[11.5px] tracking-[0.05em] uppercase text-muted font-semibold mt-6 mb-2">By category</div>
                <div className="flex flex-col">
                  {iWhere.slice(0, 6).map((c) => (
                    <button key={c.category} onClick={() => { setFilterType("expense"); setSearch(c.category); setScreen("transactions"); }} className="flex flex-col gap-[7px] py-[10px] border-b border-line-soft text-left w-full hover:opacity-70">
                      <div className="flex justify-between items-baseline gap-[10px]">
                        <span className="text-[13px] font-medium text-[#3A362E]">{c.category}</span>
                        <span className="mp-num text-[12.5px] font-medium">{fmt(c.amount)}<span className="text-faint text-[11px] ml-[7px]">{Math.round(c.pct)}%</span></span>
                      </div>
                      <div className="h-1 rounded-[3px] bg-neutral-fill overflow-hidden"><div className="h-full rounded-[3px]" style={{ width: `${c.barW}%`, background: c.color }} /></div>
                    </button>
                  ))}
                </div>

                <div className="text-[11.5px] tracking-[0.05em] uppercase text-muted font-semibold mt-6 mb-2">Biggest expenses</div>
                <div className="flex flex-col gap-[2px]">
                  {iBiggest.map((b, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-[9px] border-b border-line-soft">
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium text-ink-soft truncate">{b.note ?? b.category}</div>
                        <div className="text-[12px] text-muted">{b.category}</div>
                      </div>
                      <div className="mp-num text-[13.5px] font-medium whitespace-nowrap">{fmt(b.amount)}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Investing story */}
              <section className="mp-card px-[26px] py-6">
                <div className="flex items-center gap-[9px] mb-4">
                  <span className="w-[9px] h-[9px] rounded-full bg-brand" />
                  <span className="text-[12px] tracking-[0.07em] uppercase text-brand font-bold">Investing</span>
                </div>
                <div className="mp-serif text-[40px] font-semibold tracking-[-0.02em] text-brand leading-none">{fmt(iInvest)}</div>
                <div className="text-[13px] text-[#857C6B] mt-[11px] leading-[1.5]">
                  New money contributed this month — <strong>not</strong> your portfolio value.{" "}
                  <button onClick={() => nav("portfolio")} className="text-brand font-semibold hover:underline">See total value →</button>
                </div>

                <div className="text-[11.5px] tracking-[0.05em] uppercase text-muted font-semibold mt-[26px] mb-3">By type</div>
                <div className="h-[14px] rounded-[7px] overflow-hidden flex bg-neutral-fill mb-[18px]">
                  <div className="bg-brand" style={{ width: `${(mfAmt / invSum) * 100}%` }} />
                  <div className="bg-brand-mid" style={{ width: `${(stockAmt / invSum) * 100}%` }} />
                </div>
                <div className="flex flex-col gap-[2px]">
                  <div className="grid grid-cols-[13px_1fr_auto_54px] gap-3 items-center py-[11px] border-b border-line-soft">
                    <span className="w-[11px] h-[11px] rounded-[3px] bg-brand" />
                    <span className="text-[14px] font-medium text-ink-soft">Mutual Fund</span>
                    <span className="mp-num text-[14px] font-medium text-right">{fmt(mfAmt)}</span>
                    <span className="mp-num text-[12.5px] text-muted text-right">{Math.round((mfAmt / invSum) * 100)}%</span>
                  </div>
                  <div className="grid grid-cols-[13px_1fr_auto_54px] gap-3 items-center py-[11px]">
                    <span className="w-[11px] h-[11px] rounded-[3px] bg-brand-mid" />
                    <span className="text-[14px] font-medium text-ink-soft">Stocks / Equity</span>
                    <span className="mp-num text-[14px] font-medium text-right">{fmt(stockAmt)}</span>
                    <span className="mp-num text-[12.5px] text-muted text-right">{Math.round((stockAmt / invSum) * 100)}%</span>
                  </div>
                </div>
                <div className="mt-[22px] bg-[#EEF2EB] border border-[#D5E0CE] rounded-[10px] px-[15px] py-[13px] text-[12.5px] text-[#3F5A48] leading-[1.5]">
                  Contributions are logged the moment you message the bot. Market value updates on the scheduled batch refresh — see{" "}
                  <button onClick={() => nav("portfolio")} className="text-brand font-semibold hover:underline">Portfolio</button>.
                </div>
              </section>
            </div>

            {/* month over month */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 items-start">
              <MoMChart title="Spend · last 6 months" sub="Direction, not just this month" dot="bg-clay" data={sixSpend} max={spendMax} accent="#B06A2C" />
              <MoMChart title="Invested · last 6 months" sub="New money contributed each month" dot="bg-brand" data={sixInvest} max={investMax} accent="#2E5D45" />
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderPortfolio() {
    return (
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
          <div className="mp-card px-[22px] py-5">
            <div className="text-[12px] tracking-[0.06em] uppercase text-muted font-semibold">Invested</div>
            <div className="mp-serif text-[30px] font-semibold mt-[9px]">{fmt(invested)}</div>
          </div>
          <div className="mp-card px-[22px] py-5">
            <div className="text-[12px] tracking-[0.06em] uppercase text-muted font-semibold">Current value</div>
            <div className="mp-serif text-[30px] font-semibold mt-[9px]">{fmt(currentValue)}</div>
          </div>
          <div className="bg-ink text-paper rounded-[14px] px-[22px] py-5">
            <div className="text-[12px] tracking-[0.06em] uppercase text-[#9A9281] font-semibold">Total P&amp;L</div>
            <div className="mp-serif text-[30px] font-semibold mt-[9px] text-gain-light">{fmt(portfolioPnl, true)}</div>
            <div className="mp-num text-[14px] text-gain-light mt-[3px]">{pct(portfolioPnlPct)} all-time</div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[12.5px] text-[#A0967F] mb-3 px-[2px] flex-wrap">
          <span className="flex items-center gap-2">
            <Icon name="refresh" size={14} strokeWidth={1.8} />
            Mutual funds priced from the AMFI NAV feed — not real-time.
          </span>
          <button
            onClick={revalue}
            disabled={revaluing}
            className="text-[12.5px] font-semibold text-brand border border-[#C7D2C2] rounded-lg px-[11px] py-[5px] bg-card hover:bg-[#ECEFE8] disabled:opacity-60"
          >
            {revaluing ? "Repricing…" : "Refresh prices"}
          </button>
        </div>

        <div className="mp-card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[2fr_1fr_1.2fr_1.2fr_1.3fr] gap-[14px] px-6 py-[13px] border-b border-line text-[11.5px] tracking-[0.05em] uppercase text-muted font-semibold">
                <span>Instrument</span>
                <span>Type</span>
                <span className="text-right">Invested</span>
                <span className="text-right">Current</span>
                <span className="text-right">P&amp;L</span>
              </div>
              {holdings.map((h) => {
                const gain = h.pnl >= 0;
                return (
                  <div key={h.id} className="grid grid-cols-[2fr_1fr_1.2fr_1.2fr_1.3fr] gap-[14px] items-center px-6 py-[15px] border-b border-line-soft">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-ink-soft">{h.name}</div>
                      <div className="text-[12px] text-muted">{h.ticker}</div>
                    </div>
                    <div>
                      <span className={`text-[11px] font-semibold px-2 py-[3px] rounded-md ${h.type === "Mutual Fund" ? "bg-[#EAF0E7] text-brand" : "bg-[#EDF1E9] text-brand-mid"}`}>{h.type}</span>
                    </div>
                    <div className="mp-num text-[13.5px] text-right text-muted-2">{fmt(h.invested)}</div>
                    <div className="mp-num text-[13.5px] text-right font-medium">{fmt(h.current)}</div>
                    <div className="text-right">
                      <div className="mp-num text-[13.5px] font-semibold" style={{ color: gain ? "#2F7A4F" : "#B23B36" }}>{fmt(h.pnl, true)}</div>
                      <div className="mp-num text-[12px]" style={{ color: gain ? "#2F7A4F" : "#B23B36" }}>{pct(h.pnlPct)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderPending() {
    return (
      <div>
        <div className="mp-card px-[18px] py-[13px] mb-[18px] flex items-center gap-[10px]">
          <span className="shrink-0 text-brand"><Icon name="send" size={17} strokeWidth={1.8} /></span>
          <input
            value={quickAdd}
            onChange={(e) => setQuickAdd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitQuickAdd()}
            placeholder="Log like you'd text the bot — “dinner 1240”, “40k mutual fund”"
            className="flex-1 text-[14px] bg-transparent outline-none text-ink placeholder:text-faint"
          />
          <button onClick={submitQuickAdd} className="text-[13px] font-semibold text-card bg-brand rounded-[9px] px-[16px] py-[9px] hover:bg-brand-dark">
            Add
          </button>
        </div>
        <div className="bg-[#F4ECDA] border border-[#E5D2A6] rounded-[13px] px-[18px] py-[15px] flex items-start gap-3 mb-[22px]">
          <span className="shrink-0 mt-[1px] text-clay"><Icon name="clock" size={19} strokeWidth={1.8} /></span>
          <div className="text-[13.5px] text-[#6B5A38] leading-[1.5]">
            These entries are in their <strong>5-minute grace window</strong>. They commit automatically when the timer runs out — edit or cancel before then.
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="text-center py-[70px] px-[22px] mp-card">
            <div className="w-[52px] h-[52px] rounded-[14px] bg-[#E7EFE5] flex items-center justify-center mx-auto mb-4 text-brand">
              <Icon name="check" size={26} strokeWidth={1.7} />
            </div>
            <div className="font-serif text-[20px] font-semibold">All caught up</div>
            <div className="text-[13.5px] text-muted mt-[5px]">Nothing pending. New entries from Telegram appear here for 5 minutes.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
            {pending.map((p) => {
              const rem = remainingSec(p);
              const barW = Math.max(0, (rem / p.totalSec) * 100);
              return (
                <div key={p.id} className="bg-card border border-[#E5D2A6] rounded-[14px] px-[22px] py-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#EFE0BE]">
                    <div className="h-full bg-[#C68A3A] transition-[width] duration-1000 ease-linear" style={{ width: `${barW}%` }} />
                  </div>
                  <div className="flex items-start justify-between gap-3 mt-[6px]">
                    <div>
                      <div className="mp-serif text-[30px] font-semibold leading-none">{fmt(p.amount)}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-ink-soft">{p.category}</span>
                        <TypeTag type={p.type} />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="mp-num text-[20px] font-semibold text-[#A9701F] leading-none">{mmss(rem)}</div>
                      <div className="text-[11px] text-[#B08A4C] tracking-[0.04em] uppercase mt-1">left</div>
                    </div>
                  </div>

                  <div className="mt-4 bg-[#F1EBDD] border border-[#E7DECB] rounded-[9px] px-3 py-[10px] flex items-center gap-[9px]">
                    <span className="shrink-0 text-[#7E96D9]"><Icon name="send" size={15} strokeWidth={1.8} /></span>
                    <span className="font-mono text-[13px] text-[#5C5446]">&ldquo;{p.message}&rdquo;</span>
                  </div>

                  {p.editing ? (
                    <div className="mt-[14px] flex flex-wrap gap-[10px] items-end">
                      <label className="flex flex-col gap-[5px] text-[10.5px] tracking-[0.04em] uppercase text-[#857C6B] font-semibold">
                        Category
                        <select value={p.draftCategory} onChange={(e) => setPending((prev) => prev.map((x) => (x.id === p.id ? { ...x, draftCategory: e.target.value } : x)))} className="text-[13.5px] px-[9px] py-[7px] border border-[#D2C8B5] rounded-[7px] bg-field">
                          {[...expenseCats, ...investCats].map((c) => (<option key={c} value={c}>{c}</option>))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-[5px] text-[10.5px] tracking-[0.04em] uppercase text-[#857C6B] font-semibold">
                        Amount ₹
                        <input value={p.draftAmount} inputMode="numeric" onChange={(e) => setPending((prev) => prev.map((x) => (x.id === p.id ? { ...x, draftAmount: e.target.value } : x)))} className="text-[13.5px] px-[9px] py-[7px] border border-[#D2C8B5] rounded-[7px] bg-field w-[110px] font-mono" />
                      </label>
                      <button onClick={() => pendSave(p.id)} className="text-[13px] font-semibold text-card bg-brand rounded-[7px] px-[15px] py-2 ml-auto hover:bg-brand-dark">Save</button>
                    </div>
                  ) : (
                    <div className="mt-4 flex gap-[10px]">
                      <button onClick={() => pendCommit(p.id)} className="flex-1 text-[13.5px] font-semibold text-card bg-brand rounded-[9px] py-[10px] flex items-center justify-center gap-[7px] hover:bg-brand-dark">
                        <Icon name="check" size={15} strokeWidth={1.8} />Commit
                      </button>
                      <button onClick={() => pendEdit(p.id)} className="text-[13.5px] font-semibold text-ink-soft border border-[#D8CFBE] rounded-[9px] px-[14px] py-[10px] bg-card flex items-center justify-center gap-[7px] hover:bg-[#EBE3D4]">
                        <Icon name="edit" size={15} strokeWidth={1.8} />Edit
                      </button>
                      <button onClick={() => pendCancel(p.id)} className="text-[13.5px] font-semibold text-danger border border-[#E3C4BF] rounded-[9px] px-[14px] py-[10px] bg-card flex items-center justify-center gap-[7px] hover:bg-[#F3E1DE]">
                        <Icon name="close" size={15} strokeWidth={1.8} />Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderPrivacy() {
    const steps = [
      { num: "01", title: "What we send to AI", body: "Only the description text — “Dining”, “mutual fund” — and only when our keyword match isn’t confident. Most messages are categorised in code and never touch an AI provider.", tag: "sent · description only" },
      { num: "02", title: "What we store", body: "Your amounts are encrypted per-user at rest, isolated by row-level security. No other user — and no admin — can read them.", tag: "stored · encrypted + isolated" },
      { num: "03", title: "What never leaves us", body: "The amount is masked before any AI call and re-attached on our servers. Plaintext amounts never reach a third party.", tag: "never sent · amounts" },
    ];
    return (
      <div className="max-w-[760px]">
        <p className="font-serif text-[22px] leading-[1.45] text-ink-soft m-0 mb-2 tracking-[-0.01em]">How your money data flows — in plain language.</p>
        <p className="text-[14.5px] text-muted-2 leading-[1.6] m-0 mb-[34px]">No dark patterns, no buried clauses. Here is exactly what happens to a message after you send it.</p>

        <div className="flex flex-col">
          {steps.map((s) => (
            <div key={s.num} className="grid grid-cols-[46px_1fr] gap-5 py-6 border-t border-line">
              <div className="font-serif text-[24px] font-semibold text-[#C3B9A4] leading-none">{s.num}</div>
              <div>
                <div className="text-[16px] font-bold text-ink mb-[7px]">{s.title}</div>
                <div className="text-[14.5px] text-[#544D42] leading-[1.62]">{s.body}</div>
                <div className="mt-[11px] inline-flex items-center gap-[7px] font-mono text-[12.5px] text-brand bg-[#E9EFE6] rounded-[7px] px-[10px] py-[6px]">{s.tag}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[30px] bg-[#F4ECDA] border border-[#E5D2A6] rounded-[13px] px-[22px] py-5">
          <div className="flex items-center gap-[9px] text-[13px] font-bold text-[#8A5A1E] tracking-[0.02em] uppercase mb-[9px]">
            <Icon name="alert" size={16} strokeWidth={1.9} />An honest limitation
          </div>
          <div className="text-[14px] text-[#6B5A38] leading-[1.62]">
            During beta, the AI fallback provider may retain description text for a short window on their side.{" "}
            <strong>Amounts are never sent — masked before the call, re-attached on our servers.</strong> Production moves to a zero-retention tier or an on-device model. We&apos;ll tell you the day it changes.
          </div>
        </div>

        <div className="mt-5 mp-card px-[22px] py-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[15px] font-bold">Your data is yours</div>
            <div className="text-[13.5px] text-muted mt-[3px]">Export everything as a CSV, any time. No lock-in.</div>
          </div>
          <button onClick={exportCsv} className="flex items-center gap-2 text-[13.5px] font-semibold text-card bg-brand rounded-[9px] px-[18px] py-[11px] hover:bg-brand-dark">
            <Icon name="download" size={16} strokeWidth={1.8} />Download CSV
          </button>
        </div>
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className="max-w-[720px]">
        <section className="mp-card px-[26px] py-6 mb-5">
          <div className="text-[15px] font-bold mb-[18px]">Account</div>
          <div className="flex items-center justify-between gap-[14px] py-[13px] border-b border-line-soft">
            <div>
              <div className="text-[13.5px] font-medium">Phone number</div>
              <div className="text-[12.5px] text-muted">
                {tgPhone ? "Verified via Telegram" : "Verify by tapping “📱 Verify my phone” in the bot"}
              </div>
            </div>
            <div className={`mp-num text-[14px] ${tgPhone ? "text-[#3A362E]" : "text-faint"}`}>
              {tgPhone ?? "Not verified"}
            </div>
          </div>
          <div className="py-[13px] border-b border-line-soft">
            <div className="flex items-center justify-between gap-[14px]">
              <div>
                <div className="text-[13.5px] font-medium">Telegram</div>
                <div className="text-[12.5px] text-muted">Log spending by texting your bot</div>
              </div>
              {tgConnected === null ? (
                <span className="text-[12.5px] text-faint">…</span>
              ) : tgConnected ? (
                <div className="flex items-center gap-2">
                  <span className="w-[7px] h-[7px] rounded-full bg-gain" />
                  <span className="text-[13px] font-semibold text-brand">Connected</span>
                  <button
                    onClick={unlinkTelegram}
                    className="text-[12.5px] font-semibold text-danger border border-[#E3C4BF] rounded-lg px-[10px] py-[5px] hover:bg-[#F3E1DE] ml-1"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={connectTelegram}
                  className="text-[13px] font-semibold text-card bg-brand rounded-lg px-[14px] py-2 hover:bg-brand-dark"
                >
                  Connect Telegram
                </button>
              )}
            </div>
            {tgLink && !tgConnected && (
              <div className="mt-3 bg-[#F1EBDD] border border-[#E7DECB] rounded-[9px] px-[13px] py-[11px] text-[12.5px] text-[#5C5446] leading-[1.55]">
                {tgLink.deepLink ? (
                  <>
                    Tap to open your bot:{" "}
                    <a href={tgLink.deepLink} target="_blank" rel="noreferrer" className="text-brand font-semibold underline break-all">
                      {tgLink.deepLink}
                    </a>
                    <div className="mt-1 text-muted">Press Start in Telegram — I’ll connect automatically. Code expires in {tgLink.expiresInMin} min.</div>
                  </>
                ) : (
                  <>
                    Open your bot and send: <span className="font-mono font-semibold text-ink">/link {tgLink.code}</span>
                    <div className="mt-1 text-muted">Tip: set <span className="font-mono">NEXT_PUBLIC_BOT_USERNAME</span> for a one-tap link. Expires in {tgLink.expiresInMin} min.</div>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-[14px] py-[13px]">
            <div>
              <div className="text-[13.5px] font-medium">Session</div>
              <div className="text-[12.5px] text-muted">Sign out of this device</div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-[13px] font-semibold text-ink-soft border border-[#D8CFBE] rounded-lg px-[14px] py-2 bg-card hover:bg-[#EBE3D4]"
            >
              Sign out
            </button>
          </div>
        </section>

        <section className="mp-card px-[26px] py-6 mb-5">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[15px] font-bold">Categories</div>
            <div className="text-[12.5px] text-muted">{expenseCats.length + investCats.length} total</div>
          </div>
          <div className="text-[12.5px] text-muted mb-4">The curated list the parser matches against — unmatched messages fall to “Other / Misc” or the AI fallback.</div>

          <div className="flex items-baseline gap-2 mb-[11px]">
            <span className="text-[11px] tracking-[0.06em] uppercase text-[#857C6B] font-bold">Expenses</span>
            <span className="mp-num text-[11.5px] text-faint">{expenseCats.length}</span>
          </div>
          <div className="flex flex-wrap gap-[9px] mb-[22px]">
            {expenseCats.map((c) => (
              <span key={c} className="inline-flex items-center gap-2 text-[13px] font-medium text-[#3A362E] border border-[#DDD3C0] rounded-lg px-[11px] py-[7px] bg-field">
                {c}
                <button onClick={() => setExpenseCats((prev) => prev.filter((x) => x !== c))} aria-label="Remove" className="text-faint flex hover:text-danger">
                  <Icon name="close" size={13} strokeWidth={2.1} />
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-baseline gap-2 mb-[11px]">
            <span className="text-[11px] tracking-[0.06em] uppercase text-brand font-bold">Investments</span>
            <span className="mp-num text-[11.5px] text-faint">{investCats.length}</span>
          </div>
          <div className="flex flex-wrap gap-[9px] mb-5">
            {investCats.map((c) => (
              <span key={c} className="inline-flex items-center gap-2 text-[13px] font-medium text-[#214333] border border-[#CBD8C4] rounded-lg px-[11px] py-[7px] bg-[#EEF2EB]">
                {c}
                <button onClick={() => setInvestCats((prev) => prev.filter((x) => x !== c))} aria-label="Remove" className="text-[#9DB39A] flex hover:text-danger">
                  <Icon name="close" size={13} strokeWidth={2.1} />
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-[9px]">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCat()} placeholder="Add an expense category…" className="flex-1 text-[13.5px] px-3 py-[9px] border border-[#D8CFBE] rounded-[9px] bg-field outline-none" />
            <button onClick={addCat} className="text-[13.5px] font-semibold text-card bg-brand rounded-[9px] px-[18px] py-[9px] hover:bg-brand-dark">Add</button>
          </div>
        </section>

        <section className="mp-card px-[26px] py-5 mb-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[15px] font-bold">Export your data</div>
            <div className="text-[13px] text-muted mt-[3px]">All transactions and holdings as CSV.</div>
          </div>
          <button onClick={exportCsv} className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-soft border border-[#D8CFBE] rounded-[9px] px-4 py-[10px] bg-card hover:bg-[#EBE3D4]">
            <Icon name="download" size={15} strokeWidth={1.8} />Download CSV
          </button>
        </section>

        <section className="border border-[#E3C4BF] rounded-[14px] px-[26px] py-6 bg-[#FAF1EF]">
          <div className="text-[13px] font-bold text-[#A33731] tracking-[0.03em] uppercase mb-4">Danger zone</div>
          <div className="flex items-center justify-between gap-[14px] py-[11px] border-b border-[#ECD7D3]">
            <div>
              <div className="text-[13.5px] font-medium">Change phone number</div>
              <div className="text-[12.5px] text-[#A88]">Re-verification required via Telegram.</div>
            </div>
            <button className="text-[13px] font-semibold text-[#A33731] border border-[#E3C4BF] rounded-lg px-[14px] py-2 hover:bg-[#F3E1DE]">Change</button>
          </div>
          <div className="flex items-center justify-between gap-[14px] py-[11px]">
            <div>
              <div className="text-[13.5px] font-medium">Delete account</div>
              <div className="text-[12.5px] text-[#A88]">Permanently erases all encrypted data.</div>
            </div>
            <button className="text-[13px] font-semibold text-card bg-danger rounded-lg px-[14px] py-2 hover:bg-danger-dark">Delete</button>
          </div>
        </section>
      </div>
    );
  }
}

// ---------- small presentational helpers ----------

function EmptyMonth({ label, insights }: { label: string; insights?: boolean }) {
  return (
    <div className="text-center py-[74px] px-[22px] mp-card">
      <div className="w-[52px] h-[52px] rounded-[14px] bg-[#EBE3D4] flex items-center justify-center mx-auto mb-4 text-faint">
        <Icon name="insights" size={26} strokeWidth={1.7} />
      </div>
      <div className="font-serif text-[21px] font-semibold">Nothing logged in {label} yet</div>
      <div className="text-[13.5px] text-muted mt-[6px] max-w-[340px] mx-auto leading-[1.5]">
        {insights
          ? "Once you text a few expenses or investments this month, your full report appears here."
          : "Pick another month, or start logging — entries will show up here."}
      </div>
    </div>
  );
}

function MoMChart({
  title,
  sub,
  dot,
  data,
  max,
  accent,
}: {
  title: string;
  sub: string;
  dot: string;
  data: { label: string; value: number }[];
  max: number;
  accent: string;
}) {
  return (
    <section className="mp-card px-6 py-[22px]">
      <div className="flex items-center gap-[9px] mb-1">
        <span className={`w-2 h-2 rounded-[2px] ${dot}`} />
        <div className="text-[14px] font-semibold">{title}</div>
      </div>
      <div className="text-[12px] text-muted mb-[18px]">{sub}</div>
      <div className="flex items-end gap-[10px] h-[120px]">
        {data.map((m, i) => {
          const current = i === data.length - 1;
          return (
            <div key={m.label} title={`${m.label} · ₹${m.value.toLocaleString("en-IN")}`} className="flex-1 flex flex-col items-center justify-end h-full gap-2">
              <div className="w-full max-w-[34px] rounded-t-[5px]" style={{ height: `${Math.max(6, (m.value / max) * 100)}%`, background: current ? accent : "#D8CFBE" }} />
              <span className="text-[11px] font-mono font-medium" style={{ color: current ? accent : "#A89E8B" }}>{m.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
