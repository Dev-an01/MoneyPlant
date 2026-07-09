# MoneyPlant — Build Roadmap

**Companion to:** `PRD.md`
**Last updated:** 2026-07-06

Two phases. **Phase 1 is a self-hosted, single-user tracker** — anyone clones the
repo, creates their own Telegram bot, and tracks their own money on their own
machine/server. It's nearly done; only deployment remains. **Ship Phase 1, then
start Phase 2** — a hosted, multi-user product with privacy-preserving processing
(homomorphic encryption) and an on-device-AI mobile app.

> **No at-rest encryption in Phase 1.** It's your own data on your own deployment,
> so encryption adds setup friction with no threat-model benefit. Privacy is a
> **Phase 2** concern, and there it's done properly with **homomorphic encryption**
> + **on-device** encryption — a different mechanism than app-level encryption at
> rest, so it belongs in Phase 2's design, not bolted on now.

---

## 🟡 GOLD RULE (every phase)

> **Never make assumptions. If a required detail is missing or ambiguous — design,
> implementation, or setup — STOP and ask before writing code or deciding.**
> Reasonable low-stakes defaults may be used only if flagged "assumed — confirm."

---

## Status at a glance

| Phase | Part | Status |
|---|---|---|
| **1** | 1a Frontend dashboard | ✅ Done |
| **1** | 1b Backend core (auth, ingest, API, analytics) | ✅ Done |
| **1** | 1c Telegram bot + AI categorization | ✅ Done |
| **1** | 1d Local dev & data | ✅ Done |
| **1** | 1e Portfolio valuation (AMFI) | ✅ Done |
| **1** | **1f Deployment** | ⏳ **Remaining — the only thing between here and shipping Phase 1** |
| **2** | 2a Multi-tenant hosting & accounts | ⬜ Not started (RLS scaffolding exists) |
| **2** | 2b Privacy-preserving compute (homomorphic) | ⬜ Not started (design) |
| **2** | 2c Mobile app (on-device AI + encryption) | ⬜ Not started (design) |
| **2** | 2d Ops & scale | ⬜ Not started |

**Phase 1 ≈ 90% complete** — everything works locally end-to-end; deployment is all
that's left before it can be published for others to self-host.

---

# PHASE 1 — Self-hosted single-user tracker

**Goal:** clone the repo → create your own Telegram bot → text spending → review it
on a private web dashboard. One deployment = one person's data. **Deploy this.**

## Part 1a — Frontend dashboard ✅
- [x] Clickable design mockup approved (`MoneyPlant.dc.html`)
- [x] Next.js + Tailwind dashboard: Overview, Transactions, Spending, Monthly
      Insights, Portfolio, Pending, Privacy & Trust, Settings
- [x] Inline edit / delete, filter / search, month navigation
- [x] Wired to the live API (no mock data); optimistic interactions
- [x] Email/password auth shell (login / register / route guard)

## Part 1b — Backend core ✅
- [x] `packages/db` — Drizzle schema (users, transactions, holdings), migrations,
      driver-adaptive client
- [x] `packages/core` — deterministic ₹ amount parser, amount masking,
      keyword→category map, `ingest()` cascade (unit-tested)
- [x] `packages/shared` — types, DTOs, category taxonomy, money helpers
- [x] Auth: Auth.js (credentials) + bcrypt + session
- [x] Transactions API: list (filter/search), add, inline edit, delete
- [x] Pending state machine: 5-minute grace window → commit / cancel / auto-commit
- [x] Holdings API (CRUD) + portfolio P&L
- [x] Analytics API: month totals + delta, category breakdown, daily series,
      6-month trends, top expenses, savings rate, portfolio P&L
- [x] CSV export
- [x] Per-user scoping enforced on every query (app-level)

## Part 1c — Telegram bot + AI categorization ✅
- [x] grammY bot (long-polling — no public webhook needed for local)
- [x] Ingestion: text → parse → categorize → pending entry, idempotent per message
- [x] Secure account linking (one-time code / deep link from Settings)
- [x] Inline commit / cancel; auto-commit past the window
- [x] Phone verification via Telegram share-contact (PRD §6.1)
- [x] AI fallback categorization via Claude (env-gated on `ANTHROPIC_API_KEY`;
      amount masked before the call; conservative stub without a key)

## Part 1d — Local dev & data ✅
- [x] Zero-dependency local Postgres (`bun run db` → private trust-auth cluster)
- [x] `bun run web` / `bun run bot`; idempotent schema on boot
- [x] Demo-data seeding (`POST /api/seed`)
- [x] Root scripts via Bun workspaces (turbo left dormant — see README note)
- [x] Setup docs (`SETUP_AUTH.md`, `README.md`)

## Part 1e — Portfolio valuation ✅
- [x] AMFI daily-NAV fetch + parse + whole-word fuzzy match (`packages/core`)
- [x] Revalue mutual funds (units × NAV): `POST /api/valuation`, Portfolio
      "Refresh prices" button, and batch `bun run --filter @moneyplant/db db:value`
- [ ] Stock prices (no free NSE feed) — deferred; manual current value for now

## Part 1f — Deployment ⏳ **(the remaining Phase 1 work)**
- [ ] Host the web app + API (e.g. Vercel or a Node host)
- [ ] Host the always-on bot as a long-running worker, or switch to a **webhook**
      (grammY webhook + secret token) for serverless hosting
- [ ] Production Postgres (Neon / Supabase / managed PG) via `DATABASE_URL`
- [ ] Secrets/env in the host (`AUTH_SECRET`, `DATABASE_URL`, `BOT_TOKEN`,
      `NEXT_PUBLIC_BOT_USERNAME`, optional `ANTHROPIC_API_KEY`)
- [ ] `next build` production run + smoke test against the prod DB
- [ ] "Deploy your own" guide: fork → create bot → set env → deploy (the
      self-host story that defines Phase 1)
- [ ] Domain + HTTPS; Telegram webhook registration steps

**Exit criteria:** a fresh person can fork the repo, create a bot, deploy, and use
it end to end — no code changes.

---

# PHASE 2 — Hosted multi-user, privacy-preserving, + mobile app

**Goal:** run MoneyPlant centrally for many users; process everyone's data without
the server seeing plaintext (**homomorphic encryption**); ship a mobile app with a
small (~70–100 MB) on-device AI that categorizes and prepares money data, encrypts
it on-device, and syncs to the server. Users sign up and use it. **Start after
Phase 1 is deployed.**

> Big open questions to settle at the top of Phase 2 (Gold Rule): HE scheme &
> library (CKKS/BFV — e.g. OpenFHE / SEAL / Concrete) and which computations it
> must support; key custody (who holds decryption keys — device only?); the
> on-device model (size/quantization, framework, update mechanism); and the
> account/billing model. Confirm before building.

## Part 2a — Multi-tenant hosting & accounts ⬜
- [ ] Hosted account model: sign-up, verification, sessions at scale
- [ ] **Enforce row-level security** — the opt-in scaffolding already exists
      (`packages/db/sql/rls.sql` + `withUser()`); switch `DATABASE_URL` to the
      `moneyplant_app` role and route all queries through `withUser()`
- [ ] One shared bot serving all users (already supported) + per-user rate limits
- [ ] Abuse / spam controls, audit logging, per-tenant quotas
- [ ] Production hosting, scaling, backups, monitoring

## Part 2b — Privacy-preserving compute (homomorphic) ⬜
- [ ] Choose HE scheme + library; prototype encrypted aggregation (sums / averages
      per category & month) over ciphertext
- [ ] Define what runs under HE vs. what stays plaintext (and why)
- [ ] Key management: device-held keys; server computes on ciphertext, never
      decrypts; results returned encrypted → decrypted on device
- [ ] Reconcile HE with analytics/valuation (performance, batching, precision —
      CKKS is approximate)
- [ ] Migration path from the Phase 1 plaintext store to the encrypted model
- [ ] Threat model + security review; document the guarantees on the Privacy page

## Part 2c — Mobile app (on-device AI + encryption) ⬜
- [ ] App shell (framework TBD); sign-up / login against the hosted backend
- [ ] Bundle a ~70–100 MB on-device model for money categorization & processing
      (quantized, offline-capable); reuse the provider-agnostic `categorize()`
      contract from `packages/core`
- [ ] On-device encryption of amounts before sync (feeds Part 2b)
- [ ] Sync protocol to the main server; offline queue + conflict handling
- [ ] Optional: capture spending in-app (not only via Telegram)

## Part 2d — Ops & scale ⬜
- [ ] Scheduled jobs at scale: valuation, digests, analytics rollups
- [ ] Daily / weekly digest (Telegram push and/or email) — PRD §6.11
- [ ] Bot webhook (secret token) instead of long-polling for horizontal scale
- [ ] Observability: metrics, error tracking, alerting
- [ ] AI-provider cost controls (batching, model tiering, caching)

**Exit criteria:** users sign up on the hosted site (and/or app), their amounts are
processed under homomorphic encryption without the server seeing plaintext, and the
mobile app categorizes/encrypts on device before sync.

---

## How we work
1. **Finish Part 1f (deploy).** That completes and ships Phase 1.
2. **Open Phase 2 by answering its design questions** (HE scheme, key custody,
   on-device model, accounts) before writing code — Gold Rule.
3. Build Phase 2 part by part: 2a hosting/accounts → 2b HE → 2c app → 2d ops.
