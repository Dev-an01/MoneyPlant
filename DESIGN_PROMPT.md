# MoneyPlant — Design Prompt (for Claude design)

> Paste the **PROMPT** block into Claude design. It is written to produce a clickable, multi-screen dashboard that looks like a deliberately designed product — **not** an AI/template default. The "What to avoid" section is doing real work; keep it.

---

## PROMPT

Design a clickable, high-fidelity, multi-screen web dashboard for **MoneyPlant**, a personal finance + investment tracker. People log expenses and investments by texting a Telegram bot in plain language (`Dining 400`, `40k mutual fund`); this dashboard is where they review, correct, and trust their data. Deliver one self-contained, navigable React artifact with realistic Indian-rupee (₹) sample data. This is a finance product for real money — it must feel precise, calm, and credible, with a clear point of view.

### Design with a deliberate point of view (read first)
I do **not** want the generic "AI-generated dashboard" look. Before laying anything out, commit to an opinionated visual identity inspired by best-in-class finance/product design (think the restraint of **Monarch Money, Copilot Money, Mercury, Ramp, Stripe dashboard, Linear**) — editorial, confident, and a little distinctive. State the identity you chose (palette, type, spacing system) at the top, then design every screen to it consistently.

### What to AVOID (these are the tells of templated/AI design — do not do them)
- **No shadcn/ui default styling** and **no glassmorphism** (no frosted blur panels). These are the two biggest "AI made this" fingerprints.
- **No Inter** as the typeface. Choose something with character (see Typography below).
- **No purple→blue or neon-emerald gradients**, no gradient buttons, no gradient text. Avoid the default lavender/violet accent entirely.
- **No 3-4px colored stripe down the left edge of cards** (a classic AI tell).
- **No card-inside-card nesting.** Use real hierarchy — type scale, spacing, and dividers — instead of wrapping everything in boxes.
- **No "hero metric" wall** of four identical gradient stat-cards as the whole overview.
- **No emoji** as UI icons or in headings. Use a single consistent line-icon set, used sparingly.
- **No stock photos, abstract 3D blobs, or decorative illustration filler.**
- Avoid everything-rounded-xl-with-soft-shadow uniformity. Be intentional about which surfaces are raised vs flat.

### Recommended visual identity (use this unless you have a stronger one)
- **Palette:** a warm near-white paper background (not pure #fff), deep near-black ink for text, and **one** confident, slightly desaturated accent — a deep botanical/forest green (nodding to "MoneyPlant") that is *muted and sophisticated, not neon emerald*. A single warm secondary (clay/ochre) for highlights. Semantic green/red reserved strictly for gains/losses. High contrast, lots of breathing room.
- **Typography:** pair a characterful display face for headings and large money figures with a clean, legible body face, and a true monospace for tabular numbers. Good, non-Inter options on Google Fonts: **Fraunces** or **Newsreader** (display/serif) + **Libre Franklin**, **IBM Plex Sans**, or **Space Grotesk** (body) + **IBM Plex Mono** or **Geist Mono** for figures. Use **tabular/monospaced numerals** for all money so columns align.
- **Money formatting:** ₹ with Indian digit grouping (₹1,38,600). Gains in the positive color, losses in red, with sign.
- **Density & layout:** a real product feel — a persistent left sidebar, a quiet top bar, content in a comfortable max-width column. Use whitespace and a clear type scale to create hierarchy rather than borders everywhere.
- **States:** design empty, loading (skeletons), and error states for the data screens — not just the happy path.
- **Accessibility:** WCAG AA contrast, full keyboard navigation, visible focus rings, semantic HTML.
- **Responsive, mobile-first:** sidebar collapses to a bottom tab bar or drawer on mobile; the transactions table reflows into readable rows/cards on small screens. Most logging and checking happens on a phone.

### Screens to design (all reachable from the sidebar)

1. **Overview** — the daily-open snapshot; a decision tool, not a data dump.
   - Lead with cash-flow framing for the month: money out (expenses) vs money into investments, and net.
   - This month's spend with a clear comparison vs last month.
   - Portfolio value and overall P&L (₹ and %).
   - "Where it went" — top spending categories with proportions (clickable through to filtered transactions).
   - A spend-over-time visual for the month (a real chart — line or bars, intentional, not a default widget).
   - Recent activity list and a small "pending" indicator.

2. **Transactions** — the ledger; the most-used screen.
   - Inline-editable table: edit category, amount, note; delete a row. Optimistic, instant-feeling edits.
   - Filters (All / Expenses / Investments / date range) and search.
   - Columns: time, category (typographic tag, not a candy-colored pill), note, type, amount (right-aligned, tabular), actions.
   - Include empty state, loading skeleton, and a CSV export action.

3. **Spending** — where money goes.
   - Category breakdown for a selected month (driven by the global month selector), with a proportion visual and a ranked list.
   - Each category drills down into its transactions.

3b. **Monthly Insights** — the single-month deep report (distinct from the calm Overview). Everything here is scoped to the selected month, and **spending and investing are reported separately**, then reconciled.
   - **Spending this month:** total spent, vs last month (₹ and %), vs recent average; category breakdown; daily-spend trend within the month; biggest individual expenses; transaction count.
   - **Investing this month:** total *contributed* this month (new money logged — kept clearly separate from total portfolio value), split by type (Mutual Fund vs Stock).
   - **Cash-flow strip:** money out = spending + investing; show out / net for the month.
   - **Month-over-month:** a trailing 6-month mini-chart of spend and a separate one of invested, so direction is visible — not just one month.
   - **This-month digest:** a short, plainspoken summary ("You spent ₹42,860 across 38 entries — Food was your top category; you invested ₹75,000.").
   - Design a clear **empty state** for months with no data.
   - Lay spending and investing out as two distinct, side-by-side stories — do **not** merge them into a single number.

4. **Portfolio** — investments.
   - Summary: total invested, current value, overall P&L (₹ + %).
   - Holdings table: instrument, type (Mutual Fund / Stock), invested, current value, P&L (signed, colored).
   - State clearly that values come from a scheduled batch refresh (e.g. "updated 2h ago"), not real-time.

5. **Pending** — the 5-minute grace window (a distinctive, signature screen).
   - Each pending entry as a card: amount, category, type, the original message text, and the time.
   - A **live countdown** ("3:48 left") with a depleting indicator toward auto-commit; treat "not yet committed" as a clearly distinct, gentle warning state (warm, not alarming).
   - Per-card **Edit** and **Cancel** actions.

6. **Privacy & Trust** — the product's differentiator; must read as honest, human, and plainspoken.
   - "How your money data flows," in plain language, across three ideas: what is sent to the AI (only the *description* text, and only when keyword matching is unsure — most messages never reach any AI), what is stored (amounts encrypted per user, isolated so no other user or admin can read them), and what never leaves us (the *amount* is masked before any AI call and re-attached on our servers).
   - An honest-limitation note: during beta the AI fallback may retain description text; amounts are never sent; production moves to a zero-retention tier or a local model. Tone: candid, not marketing.
   - A data-export card (Download CSV).

7. **Settings** — account & control.
   - Linked phone number / Telegram identity, manage category list, export data, and a clearly separated danger zone (change number, delete account).

### Global shell
- Left sidebar: MoneyPlant wordmark, nav (Overview, Transactions, Spending, **Monthly Insights**, Portfolio, Pending [count], Privacy & Trust, Settings), and a small "Connected · Telegram @moneyplant_bot" status at the bottom. Design the nav so a future **Budgets** item could slot in.
- Top bar: page title, a **global month selector** (`‹ June 2026 ›` with a "This month" shortcut), search, user avatar. Changing the month re-scopes Overview, Spending, and Monthly Insights. (Portfolio current value stays "as of now.")
- Sidebar navigation must actually switch screens in the artifact.

### Sample data
- Expenses: Dining ₹400, Coffee ₹120, Laptop ₹66,000, Groceries, Transport, Bills.
- Investments: Mutual Fund SIP ₹40,000, Stock HDFC Bank ₹35,000.
- Portfolio holdings with realistic gains and at least one loss (e.g. Infosys down) so P&L shows both directions.
- Two pending entries with different countdown times.
- Realistic Indian-formatted amounts throughout.

### Deliverable
One clickable React artifact, all seven screens navigable from the sidebar, responsive, with a stated, consistent visual identity that does not read as a template or AI default. Prioritize a distinctive, trustworthy look and clear flows.

---

## Standalone prompt — Monthly Insights (paste to add/iterate this screen)

> Use this if you want to generate or refine just the monthly-analytics view in Claude design. It assumes the same visual identity and "What to avoid" rules as the main prompt above.

Add a **Monthly Insights** screen and a **global month selector** to the MoneyPlant dashboard. The month selector lives in the top bar (`‹ June 2026 ›` with a "This month" shortcut) and re-scopes the Overview, Spending, and Monthly Insights screens; remember the selection while navigating. Keep the same visual identity (paper background, muted botanical-green accent, characterful non-Inter type, tabular numerals) and avoid all the templated/AI tells listed earlier (no shadcn defaults, no glassmorphism, no gradients, no emoji, no card-in-card, no left-stripe cards, no hero-metric grid).

The Monthly Insights screen is a single-month deep report and must keep **spending and investing as two separate stories**, then reconcile them:

- **Spending this month:** total spent, comparison vs last month (₹ and %) and vs recent average; a category breakdown (ranked + proportions, each drillable to that month's transactions); a daily-spend trend chart for the month; the biggest individual expenses; a transaction count.
- **Investing this month:** total *contributed this month* (new money logged — clearly distinct from total portfolio value), broken down by type (Mutual Fund vs Stock).
- **Cash-flow reconciliation:** a compact strip showing money out (spending + investing) and net for the month.
- **Month-over-month:** two small trailing-6-month charts — one for spend, one for invested — shown separately so the user reads direction, not a single blended line.
- **Digest:** a short, human one-paragraph summary of the month.
- **Empty state:** a clear, friendly state for a month with no data (no zeroed/broken charts).

Use realistic Indian-rupee sample data with at least three months of history so the month selector and the trend charts are meaningful. Make spending vs investing visually distinct but part of one coherent layout.

---

## Optional add-ons (append to the prompt if you want them designed too)
- **Telegram chat preview:** the bot conversation — `Dining 400` → instant confirmation `Logged: ₹400 · Dining · Expense · 7:42 PM — reply EDIT to fix · UNDO to cancel (5 min)` → an `EDIT category Groceries` exchange.
- **Onboarding / phone verification:** the first-run flow including Telegram's share-contact step.
- **Budgets (fast-follow):** per-category limits with progress and a near-limit warning state.

---

## Notes for whoever runs this
- The "What to avoid" list is the most important part — it encodes the specific patterns that make UIs look AI-generated (shadcn defaults, glassmorphism, Inter, purple/emerald gradients, left-stripe cards, card-nesting, hero-metric grids, emoji). Keep it verbatim.
- Page list and feature priorities here match **PRD.md §18** (researched page & feature plan). Budgets, Recurring/Subscriptions, Goals, and Reports are intentionally fast-follow, not v1 — but leave room in the nav.
