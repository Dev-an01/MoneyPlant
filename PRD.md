# MoneyPlant — Product Requirements Document (PRD)

**Version:** 1.0 (MVP)
**Status:** Draft for build
**Owner:** developer.atf.anand@gmail.com
**Last updated:** 2026-06-29

---

## 1. Overview

**MoneyPlant** is a personal finance tracker — expenses **and** investment portfolio — operated almost entirely through a **Telegram chat bot**, backed by a clean web dashboard for review and editing.

A user texts the bot in plain language (`Dining 400`, `laptop 66k`, `40k mutual fund`, `35k stock`). The system parses the amount, category, and type (expense vs investment), uses the message's own timestamp as the transaction time, and replies instantly for confirmation. A 5-minute grace window lets the user fix mistakes before the entry is committed. Everything is visible and editable on the dashboard.

The product's differentiator is **honest, verifiable privacy**: monetary amounts are masked before any AI call and never leave our infrastructure in plaintext to a third party; all data is encrypted and isolated per user; admins cannot read user data.

### 1.1 Problem
Most expense trackers require opening an app and filling forms — high friction, so people stop logging. Investment tracking lives in a separate tool. Privacy-conscious users distrust finance apps that ship their data to opaque backends.

### 1.2 Vision
Logging money should be as easy as sending a text. One place for spending and investments. A trust model the user can actually verify, not just take on faith.

---

## 2. Goals & Non-Goals

### 2.1 Goals (v1)
- G1 — Log an expense or investment via a single Telegram message in < 5 seconds, hands-free of any app.
- G2 — Accurate parsing of Indian money formats (`400`, `66k`, `1.5L`, `40k`) and correct category/type inference.
- G3 — A 5-minute correction window before any entry is committed.
- G4 — A clean, designer-grade dashboard to review, edit, recategorize, and delete entries.
- G5 — A basic investment portfolio view (invested vs current value, simple P&L).
- G6 — Per-user data isolation + encryption + amount-masking before AI, documented transparently.
- G7 — 24/7 availability of the bot and API.
- G8 — Cost discipline: one cheap AI call per message; heavy work batched.

### 2.2 Non-Goals (v1)
- WhatsApp support (Phase 2).
- Automatic bank / UPI / card import.
- True end-to-end (client-held-key) encryption.
- Multi-currency / multi-language.
- Payments, subscriptions, or billing.
- Tax reports, financial advice, or forecasting.

---

## 3. Target Users & Personas

- **Persona A — "The texter" (primary):** Young Indian professional, lives in chat apps, wants frictionless logging and a quick monthly picture. Abandons form-based apps.
- **Persona B — "The privacy-minded saver":** Wants to track money but distrusts finance apps with their data. Needs a clear, honest answer to "who can see my numbers?"
- **Persona C — "The light investor":** Holds a few mutual funds and stocks; wants one place to see spending + portfolio without a spreadsheet.

Beta scope: a small, invite-only group (tens of users), not public scale.

---

## 4. Success Metrics

| Metric | Target (beta) |
|---|---|
| Median time to log a transaction | < 5 s |
| Parse accuracy (category + amount correct, no edit needed) | ≥ 90% |
| % entries corrected within the 5-min window | tracked (health signal) |
| Weekly active loggers | ≥ 60% of beta users |
| AI cost per active user / month | < target ₹ threshold |
| Bot uptime | ≥ 99.5% |
| Cross-user data leakage incidents | 0 (hard requirement) |

---

## 5. Scope — MVP Feature List

1. Onboarding & phone verification
2. Telegram message ingestion (webhook)
3. Deterministic amount parsing + AI categorization (amount masked)
4. Instant confirmation reply
5. 5-minute grace / undo window (pending → committed state machine)
6. Noise filtering (ignore non-transactions)
7. Expense tracking + editing
8. Investment / portfolio tracking + valuation (batched)
9. Web dashboard (overview, transactions, portfolio, pending, privacy)
10. Edit-by-reply in chat
11. Batched enrichment (summaries, valuation refresh)
12. Privacy & trust page + data export

---

## 6. Functional Requirements (User Stories + Acceptance Criteria)

### 6.1 Onboarding & Identity
**Story:** As a new user, I register with my mobile number so my account is tied to me.

- FR-1.1 User starts the bot; bot requests phone verification.
- FR-1.2 Verification via OTP (Supabase Auth / Twilio Verify) **or** Telegram's *share-contact* button to capture the verified phone number.
- FR-1.3 Account is bound to the verified number. The same Telegram identity is linked to that account.
- FR-1.4 User can change the linked number later through a re-verification flow.
- **Note / risk:** Telegram does not always expose a user's phone number automatically — onboarding MUST include an explicit *share contact* step. Do not assume `from.phone` is present.
- **Acceptance:** A user cannot log transactions until phone verification succeeds; one phone number maps to exactly one account.

### 6.2 Message Ingestion
**Story:** As a user, my messages reach the system instantly.

- FR-2.1 Bot runs in **webhook** mode (push). No polling. The "ping every 5 min" idea is explicitly rejected — Telegram delivers messages instantly and for free.
- FR-2.2 Every inbound message is timestamped using Telegram's message `date` as the **transaction time**.
- **Acceptance:** A sent message produces a bot response within ~2 s under normal load.

### 6.3 Parsing & Categorization (Cascade: deterministic → keyword → AI fallback, amount-masked)
**Story:** As a user, I type natural language and the system figures out amount, category, and type — cheaply, and ideally without any AI call at all.

The pipeline is a **3-stage cascade** so the majority of messages never reach the AI (cost + privacy win):

- FR-3.1 **Stage 1 — Deterministic amount parsing (code, free).** Parse `400`, `66k`, `1.5L`, `40k`, `35,000`, `1.2 cr` locally with a tested parser. The AI never does arithmetic.
- FR-3.2 **Stage 2 — Keyword → category map (code, free).** A curated lookup resolves the common 70–80% of cases (`dining`/`coffee`/`zomato` → Food; `mutual fund`/`sip` → Investment:MutualFund; `stock`/`shares` → Investment:Stock). If matched with high confidence, **no AI call is made**.
- FR-3.3 **Stage 3 — AI fallback (only when ambiguous).** For unmatched/ambiguous text: **mask the amount first** (e.g. `Dining <AMT>`), send only the masked description to a **provider-agnostic categorization client**, which returns **structured output** `{ category, type: expense|investment, subtype?, confidence }`.
  - **Provider abstraction (required):** all AI access goes through one `categorize(text)` interface in `packages/core`. Swapping providers (free → local → paid) must be a one-file change.
  - **Dev/beta provider:** Gemini Flash **free tier** (rate-limited). **Disclosed limitation:** free tiers may use prompts to improve the provider's products (not zero-retention).
  - **Prod provider:** a **zero-retention paid tier** (e.g. Claude Haiku / Gemini Flash paid) **or a local open model** (Ollama, e.g. Llama 3.x) for full privacy.
- FR-3.4 **Re-attach the real amount server-side** after categorization. The plaintext amount never leaves our infrastructure in any stage.
- FR-3.5 **Low-confidence handoff:** if confidence is below a threshold, the bot asks one clarifying question instead of guessing.
- **Privacy disclosure (must be stated to users):** when the AI stage runs, the *description* text (e.g. "Dining", "mutual fund") is sent to the AI; the *amount* is never sent. During beta the AI provider's free tier may retain/train on that text — stated openly. Most messages resolve at Stage 1–2 with no AI call at all.
- **Acceptance:** `40k mutual fund` → `{amount: 40000, type: investment, category: "Mutual Fund"}` resolved at Stage 2 (no AI call); the string `40000`/`40k` is never present in any AI request payload; switching AI provider touches only `packages/core`.

### 6.4 Instant Confirmation
- FR-4.1 Bot replies immediately, e.g.:
  `✅ Logged: ₹400 · Dining · Expense · 7:42 PM`
  `Reply EDIT to fix · UNDO to cancel (5 min)`
- **Acceptance:** Confirmation includes amount, category, type, and time, plus edit/undo affordances.

### 6.5 5-Minute Grace / Undo Window
**Story:** As a user, I can correct a mistake before it lands on my dashboard.

- FR-5.1 New entries enter a **`pending`** state for 5 minutes.
- FR-5.2 During the window the user can `UNDO` (→ `cancelled`) or `EDIT <field> <value>` (→ `edited`, window may reset).
- FR-5.3 After 5 minutes with no action, the entry auto-commits (→ `committed`) and appears in dashboard analytics.
- FR-5.4 Pending entries are visible on the dashboard in a dedicated "Pending" area and are also editable there.
- See the state machine in §9.
- **Acceptance:** No `pending` or `cancelled` entry is ever included in committed totals; commit happens exactly once.

### 6.6 Noise Filtering
- FR-6.1 Messages that don't parse as a transaction (greetings, random chat) are **not** logged.
- FR-6.2 The system replies with a short, friendly nudge only when it's ambiguous ("I didn't catch a transaction — try `Coffee 120`"). Pure chit-chat is ignored.
- **Acceptance:** "hello", "how are you" produce no transaction record.

### 6.7 Expense Tracking
- FR-7.1 Store amount, category, type, timestamp, optional note, source message id.
- FR-7.2 Fully editable and deletable from the dashboard and (key fields) by chat reply.

### 6.8 Investment / Portfolio Tracking
- FR-8.1 Log holdings (mutual funds, stocks) with amount and date via the same chat flow.
- FR-8.2 A **batched** job refreshes current value from a market-data source (AMFI for MF NAV, NSE for stocks).
- FR-8.3 Portfolio view shows invested value, current value, and simple per-holding and overall P&L.
- **Acceptance:** Portfolio value updates on the batch schedule, not per message; logging an investment is instant.

### 6.9 Dashboard (Web)
- FR-9.1 **Overview:** month spend, top categories, portfolio value & P&L at a glance.
- FR-9.2 **Transactions:** fast, inline-editable table (edit category/amount/note, delete), filter, search.
- FR-9.3 **Portfolio:** holdings with invested vs current value and P&L.
- FR-9.4 **Pending:** entries in the 5-minute window, easy to fix/cancel.
- FR-9.5 **Privacy & Trust:** plain-language data-flow page (what is sent to AI, stored, never seen) + data export (CSV).
- FR-9.6 Authenticated; a user sees only their own data.

### 6.10 Edit-by-Reply
- FR-10.1 `EDIT category Groceries`, `EDIT amount 450`, `UNDO` work as replies to a confirmation in chat.
- **Acceptance:** Common corrections need no dashboard visit.

### 6.11 Batched Enrichment (Cost Control)
- FR-11.1 A scheduled job (e.g. every few hours) computes analytics/summaries and refreshes portfolio valuations.
- FR-11.2 Optional weekly/monthly digest pushed to the user in Telegram.
- FR-11.3 No per-message heavy AI usage; per-message AI = one Haiku classification only.

---

## 7. Non-Functional Requirements

- **NFR-1 Privacy:** Amounts masked before AI; data encrypted in transit (TLS) and at rest (per-user envelope encryption); AI under zero-retention/no-training terms.
- **NFR-2 Isolation:** Per-user data isolation enforced at the DB layer via Row-Level Security, not only app code.
- **NFR-3 Admin boundary:** Admins cannot read user financial data; an admin sees only their own account. No plaintext amounts in logs or third-party tooling.
- **NFR-4 Verifiable trust:** Public, plain-language data-flow doc; auditable codebase; claims limited to what is actually true. (Stretch: open-source the core.)
- **NFR-5 Availability:** 24/7 bot webhook + API as always-on services; health checks + alerting.
- **NFR-6 Cost:** ≤ 1 small AI call per message; batch everything heavy; cache market data.
- **NFR-7 Performance:** Confirmation reply < 2 s p95; dashboard interactions optimistic/instant.
- **NFR-8 Accessibility:** WCAG AA contrast, keyboard navigation, responsive (mobile-first).
- **NFR-9 Reliability:** Idempotent message handling (Telegram may redeliver); exactly-once commit.

---

## 8. System Architecture

```
Telegram  ──webhook──▶  apps/bot (grammY, Bun)
                              │
                              ▼
        ┌───────────────────────────────────────────┐
        │  apps/api (Hono, Bun)                      │
        │  - amount parser (deterministic)           │
        │  - cascade: keyword map → AI fallback      │
        │    (mask → categorize() → unmask)          │
        │  - provider-agnostic AI client             │
        │    (dev: Gemini free · prod: paid/local)   │
        │  - pending/commit state machine            │
        │  - per-user envelope encryption            │
        └───────────────────────────────────────────┘
              │                         │
              ▼                         ▼
   PostgreSQL (Neon/Supabase)     Scheduled jobs
   - RLS per user                 - portfolio valuation
   - encrypted amount fields      - analytics/digests
              ▲                         │
              │                         ▼
        apps/web (Next.js) ◀──── market data (AMFI/NSE)
```

**Monorepo layout (Turborepo + Bun workspaces):**
```
moneyplant/
├─ apps/
│  ├─ bot/        # grammY Telegram webhook service
│  ├─ api/        # Hono API + parsing/AI/state machine
│  └─ web/        # Next.js dashboard
├─ packages/
│  ├─ db/         # Drizzle schema, migrations, RLS policies
│  ├─ core/       # amount parser, masking, categorization client
│  └─ shared/     # shared TS types/contracts
└─ turbo.json
```

---

## 9. Transaction State Machine (5-min undo)

```
            create (parsed)
                │
                ▼
            ┌─────────┐   UNDO            ┌───────────┐
            │ pending │ ────────────────▶ │ cancelled │
            └─────────┘                   └───────────┘
                │  │ EDIT <field>
                │  └──────────────┐
   5 min elapse │                 ▼
                │            ┌─────────┐  (window resets)
                │            │  edited │ ──┐
                ▼            └─────────┘   │
            ┌───────────┐                  │
            │ committed │ ◀────────────────┘ (auto-commit after window)
            └───────────┘
                │ later
                ▼ (dashboard)
            edited / deleted
```
- Only `committed` entries count in analytics/portfolio totals.
- Commit is idempotent (guard against duplicate timer fires / webhook redelivery).
- `edited` during the window may reset or continue the 5-min timer (decide in build — default: reset).

---

## 10. Data Model (initial)

**users**
| field | type | notes |
|---|---|---|
| id | uuid pk | |
| phone | text unique | verified |
| telegram_user_id | bigint unique | |
| created_at | timestamptz | |

**transactions**
| field | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk | RLS key |
| type | enum | expense \| investment |
| category | text | |
| subtype | text null | e.g. stock, mutual_fund |
| amount_enc | bytea | encrypted (envelope) |
| currency | text | default INR |
| note | text null | |
| status | enum | pending \| committed \| cancelled |
| txn_time | timestamptz | from Telegram message date |
| source_message_id | bigint | idempotency |
| ai_confidence | numeric null | |
| created_at | timestamptz | |
| committed_at | timestamptz null | |

**holdings** (portfolio positions, derived/maintained)
| field | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk | RLS key |
| instrument | text | MF/stock identifier |
| invested_amount_enc | bytea | encrypted |
| current_value | numeric | from batch valuation |
| last_valued_at | timestamptz | |

**Security:** RLS policy `user_id = auth.uid()` on every user-data table. Amounts stored encrypted with a per-user data key wrapped by a KMS master key.

---

## 11. Privacy, Security & Trust Design

- **Amount masking:** parsed amount removed from text before any AI request; re-attached server-side only.
- **Encryption at rest:** per-user envelope encryption on amount fields; KMS-managed master key.
- **Encryption in transit:** TLS everywhere; Telegram webhook over HTTPS with secret token.
- **Isolation:** Postgres RLS so one user can never query another's rows.
- **Admin boundary:** no admin path to decrypt or read user amounts; admins are ordinary users for their own data.
- **AI provider terms (dev vs prod — disclosed honestly):**
  - **Dev/beta:** Gemini Flash **free tier**. The free tier may use prompts to improve the provider's products (not zero-retention). Only masked descriptions are sent; never amounts. This limitation is stated openly to beta users.
  - **Prod:** migrate to a **zero-retention paid tier** or a **local open model** (Ollama) so descriptions are no longer retained by a third party. Provider swap is a one-file change (`packages/core` `categorize()` interface).
- **Minimized AI exposure:** the keyword-first cascade means most messages never reach any AI provider at all (Stage 1–2 resolve in code).
- **Logging hygiene:** never log plaintext amounts or full descriptions in third-party log services.
- **Verifiability:** public data-flow document ("sent to AI / stored / never seen", and which messages skip AI entirely); auditable code; honest scope statement. Stretch goal: open-source core + reproducible builds for true verifiability.
- **Honest limitation (documented):** when the AI fallback runs, transaction descriptions are processed to categorize them; amounts never are. During beta the free-tier provider may retain that text. This is a strong, honest stance — not "AI sees nothing."

---

## 12. Telegram Bot Command / Interaction Spec

| Input | Behavior |
|---|---|
| `Dining 400` | Parse → mask → AI → confirm → pending |
| `40k mutual fund` | Investment entry |
| `UNDO` (reply) | Cancel pending entry |
| `EDIT category Groceries` | Update category of referenced entry |
| `EDIT amount 450` | Update amount (re-parsed locally) |
| `/start` | Onboarding + phone verification |
| `/help` | Usage examples |
| `/summary` | On-demand spend snapshot |
| random chat | Ignored (or one-line nudge if ambiguous) |

---

## 13. API Surface (high level)

- `POST /telegram/webhook` — inbound updates (secret-token protected).
- `GET /transactions` — list (auth, RLS, paginated/filterable).
- `PATCH /transactions/:id` — edit.
- `DELETE /transactions/:id` — delete.
- `POST /transactions/:id/undo` — cancel pending.
- `GET /portfolio` — holdings + valuation.
- `GET /export` — CSV export.
- Internal scheduled jobs: `valuation-refresh`, `digest`, `analytics`.

---

## 14. Milestones / Phasing

**Phase 0 — Foundation (week 1)**
Turborepo + Bun scaffold; Postgres + Drizzle + RLS; encryption helpers; CI.

**Phase 1 — Core loop (weeks 2–3)**
Telegram webhook; deterministic amount parser; mask → Haiku → unmask; confirmation; pending/commit state machine; idempotency.

**Phase 2 — Dashboard (weeks 3–4)**
Auth; transactions table (inline edit/delete); overview; pending view; privacy page; CSV export.

**Phase 3 — Portfolio + batch (week 5)**
Holdings; market-data integration; batched valuation + digests.

**Phase 4 — Beta hardening (week 6)**
Edit-by-reply; low-confidence handoff; noise filtering polish; uptime/alerting; trust doc; invite beta.

---

## 15. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| "AI can't read data" over-promise | Scope claim to amount-masking + zero-retention; document honestly |
| Telegram phone not auto-exposed | Explicit *share-contact* step at onboarding |
| Indian number parsing errors (`1.5L`, `k`, `cr`) | Deterministic, unit-tested parser; AI never does math |
| Double-counting / webhook redelivery | Idempotent commit keyed on source_message_id |
| Market-data cost/accuracy | Pick AMFI/NSE source early; cache; batch refresh |
| AI cost creep | Keyword-first cascade (most messages skip AI); free tier in dev; batch heavy work; monitor cost/user |
| Free-tier provider retains/trains on data | Mask amounts always; disclose openly in beta; migrate to zero-retention paid tier or local model for prod |
| Race conditions in undo window | Explicit state machine; single commit guard |

---

## 16. Open Questions

1. OTP provider: Supabase Auth vs Twilio Verify — pick on cost/DX.
2. Exact batch cadence for valuation/digests (3h? 6h? daily?).
3. Does `EDIT` during the window reset or continue the 5-min timer? (default: reset)
4. Market-data source/licensing for MF + stocks in India.
5. Category taxonomy — fixed list vs AI-open categories (recommend a curated base list the AI maps into).

---

## 17. Out of Scope / Future

- WhatsApp interface (Phase 2 — Business API, provider cost, templates).
- Bank / UPI auto-import.
- True end-to-end (client-key) encryption.
- Multi-currency, multi-language.
- Budgets, recurring expenses, alerts (fast-follow candidates).
- Open-source release + reproducible builds for full verifiability.

---

## 18. Expense Tracker — Researched Page & Feature Plan

This section is the result of researching how mature expense/finance trackers (Monarch, Copilot, YNAB, Mint-successors, Expensify, NerdWallet's surveyed apps) structure their product, what users actually use most, and how finance dashboards are laid out. It defines the **pages** for MoneyPlant's dashboard and which features belong in v1 vs later.

### 18.1 The sections a "complete" expense tracker has

Across the market, expense trackers converge on these sections:

1. **Overview / Home** — the at-a-glance snapshot: this month's spend vs last, cash-flow (in vs out), top spending categories, net worth / portfolio value, recent activity, and anything needing attention. Research is clear that users expect the most relevant info the moment they open the app, without navigating.
2. **Transactions** — the searchable, filterable, editable ledger. The single most-used screen after Overview.
3. **Categories / Spending breakdown** — where the money goes, by category, over a period; the "am I overspending here?" view.
4. **Budgets** — set limits per category, track progress, get alerted before/when exceeded. One of the most-used and most-requested features.
5. **Recurring & Bills / Subscriptions** — auto-detected or tagged recurring charges, organized by due date, with upcoming-payment alerts.
6. **Goals / Savings** — set a target (emergency fund, trip), track progress.
7. **Reports / Insights** — trends over time, month-over-month, income vs expense, exportable.
8. **Accounts / Portfolio** — balances and holdings; for MoneyPlant this is the investment portfolio.
9. **Settings / Profile** — account, linked number, categories, privacy, export.

### 18.2 Most commonly used features (ranked by what drives retention)

In order of how heavily users rely on them:

1. **Low-friction capture** — the easier it is to log, the more people stick. (MoneyPlant's whole thesis: log by text. This is our strongest position.)
2. **Automatic categorization** — assign a category without the user thinking. (We do this via the parsing cascade.)
3. **Search & filter on transactions** — find and fix entries fast.
4. **Budgets + overspending alerts** — the #1 reason people open a tracker repeatedly.
5. **Spending breakdown by category** — the core insight.
6. **Recurring/subscription tracking + bill reminders** — high perceived value.
7. **Savings goals** — engagement and motivation.
8. **Reports / month-over-month trends.**
9. **Data export (CSV) & shared visibility.**

> Note: bank/card auto-sync is the single biggest retention driver in mainstream apps (~68% higher retention) — but it is an explicit **non-goal** for MoneyPlant v1. Our substitute for that friction-reduction is the Telegram chat capture, which is why capture quality and the dashboard's edit experience must be excellent.

### 18.3 MoneyPlant page plan (what we build, and when)

**v1 dashboard pages (build now):**

| Page | Purpose | Key contents |
|---|---|---|
| **Overview** | Daily-open snapshot | Month spend vs last month, cash-flow strip (expenses vs investments this month), top categories, portfolio value + P&L, recent activity, pending count. |
| **Transactions** | The ledger | Inline-editable table; filters (type, category, date); search; delete; CSV export entry point. |
| **Spending** *(new, recommended)* | Where money goes | Category breakdown for a chosen period (month picker), with proportion visual and per-category drill-down into transactions. Lightweight — derives from existing data, no new backend concepts. |
| **Portfolio** | Investments | Invested vs current, per-holding + overall P&L, batch-refresh timestamp. |
| **Pending** | 5-min grace window | Cards with live countdown, edit/cancel. |
| **Privacy & Trust** | The differentiator | Data-flow explainer, honest limitation, CSV export. |
| **Settings** *(new, recommended)* | Account & control | Linked phone/Telegram, manage category list, export, danger zone. |

**Fast-follow (v1.x, not now — flagged so design can leave room):**

- **Budgets** + overspending alerts (per PRD §17 budgets are a fast-follow; design the nav so a "Budgets" item can slot in).
- **Recurring / Subscriptions** view with bill reminders.
- **Savings Goals.**
- **Reports** (month-over-month trends, deeper than the Overview).

**Out of scope (per §2.2 / §17):** bank/UPI auto-import, multi-currency, multi-language, tax reports.

### 18.4 UX principles for MoneyPlant (from research)

- **A dashboard is a decision tool, not a data dump.** Lead with the one or two numbers that change behavior (this-month spend, P&L), not every metric at once.
- **Cash-flow framing:** show money in vs out for the period so the user sees the balance, not just a spend total.
- **Drill-down everywhere:** a category or stat should be clickable through to the underlying transactions.
- **Make correction effortless:** inline edit, optimistic updates, and the chat `EDIT`/`UNDO` path are the trust-builders that replace bank-sync accuracy.
- **Progressive disclosure:** Overview is calm and shallow; depth lives one click away on Transactions/Spending.
- **Empty, loading, and error states are first-class**, not afterthoughts.
- **Mobile-first:** most logging happens on a phone; the dashboard is checked on a phone.

---

## 19. Monthly Tracking & Analytics

Money is lived month-to-month: salary lands, bills repeat, budgets reset. MoneyPlant treats **the month as the primary lens**. Every analytical view is scoped to a selectable month, and spending and investing are reported **separately** (they are different mental buckets) and then reconciled into one cash-flow picture.

### 19.1 Core idea

- A **global month selector** in the dashboard header (e.g. `‹ June 2026 ›`, with "This month" shortcut). Changing it re-scopes Overview, Spending, Portfolio contributions, and the Monthly Insights page to that month. Current selection persists across navigation.
- A dedicated **Monthly Insights** page that is the deep, single-month report — distinct from the calm Overview snapshot.
- **Spend and Invest are analyzed separately**, never blended into one "spending" number. A month has a *spending* story and an *investing* story, shown side by side, then netted.

### 19.2 What each month shows

**Spending analytics (for the selected month):**
- Total spent; vs previous month (₹ and %); vs the user's recent monthly average.
- Category breakdown for the month (ranked + proportion), each drilling into that month's transactions.
- Daily spend trend within the month (spot spikes).
- Biggest individual expenses that month.
- Number of transactions / logging activity (health signal).

**Investing analytics (for the selected month):**
- Total invested *this month* (new contributions logged in the month) — separate from portfolio value.
- Contributions split by type (Mutual Fund vs Stock vs other).
- Optional: portfolio value change over the month (note this mixes contributions + market movement; label honestly).

**Combined / cash-flow (reconciliation):**
- Money out = spending + investing for the month; a simple in/out/net strip.
- Savings/invest rate if income is known later (income is out of v1 scope — leave room).

**Month-over-month:**
- A trailing view (e.g. last 6 months) of spend and of invested, as small bar/line charts, so the user sees direction, not just one month.

### 19.3 Functional requirements

- **FR-12.1 Month selector:** dashboard header control to pick any month with data; defaults to current month; "This month" shortcut; remembers last selection in-session.
- **FR-12.2 Month-scoped queries:** Overview, Spending, and Monthly Insights compute strictly from `committed` transactions whose `txn_time` falls in the selected month (user's timezone). Pending/cancelled excluded (per §6.5).
- **FR-12.3 Separated reporting:** spending totals and investment-contribution totals are computed and displayed as distinct figures; never summed into a single "spend" number.
- **FR-12.4 Month-over-month series:** provide a trailing N-month series (default 6) for spend and for invested, for the trend charts.
- **FR-12.5 Monthly digest (ties to §6.11):** at month end (or on the batch cadence), generate a month summary the user can view on the page and optionally receive in Telegram — top categories, total spend, total invested, vs last month.
- **FR-12.6 Empty months:** a month with no data shows a clear empty state, not a broken/zeroed chart.
- **Acceptance:** switching the month selector updates every scoped figure consistently; spend and invest are always reported as separate numbers; only committed entries in the selected month are counted.

### 19.4 Page-plan update

Add to the v1 dashboard pages (§18.3):

| Page | Purpose | Key contents |
|---|---|---|
| **Monthly Insights** | The single-month deep report | Month selector, spending analytics, investing analytics (separated), cash-flow reconciliation, month-over-month trend, this-month digest. |

And: the **global month selector** becomes part of the dashboard shell (header), affecting Overview, Spending, and Monthly Insights. Portfolio current-value stays "as of now" (batch-valued), but *contributions in the month* are month-scoped.

### 19.5 Data / API notes (for Phase 2)

- API needs month-scoped, aggregated endpoints (e.g. `GET /analytics/monthly?month=2026-06` returning `{ spend_total, spend_by_category[], spend_daily[], biggest[], invest_total, invest_by_type[], txn_count, prev_month_deltas }`) plus a trailing-series endpoint (`GET /analytics/trend?metric=spend&months=6`).
- Aggregations are computed server-side over decrypted amounts within our infrastructure (amounts are never sent to AI; §11). Heavy aggregation can be precomputed by the batch job (§6.11) and cached per user per month.
- Respect RLS and per-user isolation on all analytics queries (§NFR-2).
