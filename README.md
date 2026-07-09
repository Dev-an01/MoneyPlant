# 🌱 MoneyPlant

**Personal finance + investment tracker — log it by Telegram, review it on a private web dashboard.**

Text your bot *“dinner 1240”* or *“40k mutual fund”*; MoneyPlant parses the amount, categorizes it, holds it in a 5-minute grace window, then shows it on a clean dashboard with spending analytics and live portfolio valuation.

> **Phase 1** is a **self-hosted, single-user** tracker: clone the repo, create your own Telegram bot, and run it — your data on your own machine. See [`ROADMAP.md`](./ROADMAP.md) for the two-phase plan, and [`PRD.md`](./PRD.md) for the full spec.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
  - [Option A — Docker (recommended)](#option-a--docker-recommended)
  - [Option B — Local (Bun)](#option-b--local-bun)
- [Set up the Telegram bot](#set-up-the-telegram-bot)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [Scripts](#scripts)
- [Roadmap & checklist](#roadmap--checklist)
- [Security & privacy](#security--privacy)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Telegram-first logging** — text natural amounts (`400`, `66k`, `1.5L`, `₹2,380`, `40k mutual fund`); a deterministic parser handles the math, never the AI.
- **Smart categorization cascade** — keyword map first (free), then a Claude AI fallback for the ambiguous rest (the amount is masked before any AI call).
- **5-minute grace window** — every entry is *pending* first; edit, cancel, or let it auto-commit. Commit/cancel inline from Telegram too.
- **Private dashboard** — Overview, Transactions (filter/search/inline-edit/delete), Spending, Monthly Insights, Portfolio, Pending, Privacy & Trust, Settings.
- **Real analytics** — month totals + deltas, category breakdown, daily series, 6-month trends, top expenses, savings rate, portfolio P&L.
- **Live portfolio valuation** — mutual funds repriced from the free AMFI NAV feed (button, API, or scheduled batch).
- **Secure bot onboarding** — one-time-code / deep-link account linking + optional Telegram phone verification.
- **CSV export** — your data is yours, any time.

## Tech stack

| Layer | Tech |
|---|---|
| Web + API | Next.js (App Router) · Tailwind CSS · Auth.js (credentials) |
| Bot | grammY (long-polling) |
| Data | PostgreSQL · Drizzle ORM |
| Shared logic | TypeScript packages (`shared`, `core`, `db`) |
| Tooling | Bun workspaces · Docker |

---

## Quick start

### Option A — Docker (recommended)

Runs the web app **and** Postgres in containers. Requires only Docker.

```bash
# 1. Configure
cp .env.docker.example .env
#    edit .env → set AUTH_SECRET   (generate one: npx auth secret)

# 2. Start web + database
docker compose up --build          # → http://localhost:3000

# 3. (optional) start the Telegram bot too
#    set BOT_TOKEN in .env first, then:
docker compose --profile bot up --build
```

Open **http://localhost:3000**, register at `/register`, and use the app. To load
demo data, open the browser devtools console on the dashboard and run:

```js
fetch('/api/seed', { method: 'POST' }).then(r => r.json()).then(console.log)
```

### Option B — Local (Bun)

Requires [Bun](https://bun.sh) ≥ 1.1 and PostgreSQL installed (`bun run db` spins up a private local cluster — no Docker, no password).

```bash
bun install
bun run db          # starts a private local Postgres (trust auth, port 5544)

# one-time: create apps/web/.env.local (see SETUP_AUTH.md)
#   AUTH_SECRET=<npx auth secret>
#   AUTH_TRUST_HOST=true
#   DATABASE_URL=postgres://postgres@127.0.0.1:5544/moneyplant

bun run web         # → http://localhost:3000
bun run bot         # optional; needs BOT_TOKEN (see below)
```

Already have a Postgres (Neon/Supabase/Docker/native)? Skip `bun run db` and point
`DATABASE_URL` at it. The schema is created automatically on first request.

---

## Set up the Telegram bot

One bot serves everyone; each person connects their **own private chat** securely — no shared credentials.

1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → copy the **token** and the **@username**.
2. Provide the token:
   - **Docker:** put `BOT_TOKEN=…` and `NEXT_PUBLIC_BOT_USERNAME=<yourbot>` in `.env`.
   - **Local:** `cp apps/bot/.env.example apps/bot/.env`, set `BOT_TOKEN`; add `NEXT_PUBLIC_BOT_USERNAME=<yourbot>` to `apps/web/.env.local`.
3. Start the bot (`docker compose --profile bot up` or `bun run bot`).
4. In the dashboard → **Settings → Connect Telegram**, then press **Start** in Telegram.
5. Text it `dinner 1240` — the entry appears in **Pending**. Optionally tap **📱 Verify my phone**.

> ⚠️ Telegram tokens contain **no spaces** — paste it exactly as BotFather gives it.

---

## Environment variables

| Variable | Where | Required | Purpose |
|---|---|---|---|
| `AUTH_SECRET` | web | ✅ | Auth.js session secret (`npx auth secret`). |
| `DATABASE_URL` | web, bot | ✅¹ | Postgres connection string. |
| `AUTH_TRUST_HOST` | web | ✅ (local) | Let Auth.js trust localhost. |
| `BOT_TOKEN` | bot | ✅ (bot) | Telegram bot token from @BotFather. |
| `NEXT_PUBLIC_BOT_USERNAME` | web (build-time) | – | Enables one-tap “Connect Telegram” deep link. |
| `ANTHROPIC_API_KEY` | web, bot | – | Enables Claude AI categorization (else a stub). |
| `MONEYPLANT_AI_MODEL` | web, bot | – | Override the AI model (default `claude-opus-4-8`). |
| `POSTGRES_PASSWORD` | Docker | – | Password for the bundled Postgres container. |

¹ In local mode, unset `DATABASE_URL` falls back to an embedded DB — but a real Postgres (`bun run db` or Docker) is recommended. Copy `.env.docker.example`, `apps/web/.env.example`, `apps/bot/.env.example` as starting points.

---

## Project structure

```
moneyplant/
├─ apps/
│  ├─ web/            # Next.js dashboard + API route handlers + email auth
│  └─ bot/            # grammY Telegram bot (long-polling)
├─ packages/
│  ├─ shared/         # TS types, DTOs, category taxonomy, money helpers
│  ├─ core/           # amount parser, masking, categorize() + ingest cascade, AMFI
│  └─ db/             # Drizzle schema, driver-adaptive client, local PG manager, valuation
├─ Dockerfile         # single image → web or bot
├─ docker-compose.yml # web + postgres (+ bot profile)
└─ package.json       # Bun workspaces
```

## Scripts

```bash
bun run db          # start the local Postgres cluster (local mode)
bun run db:stop     # stop it
bun run web         # dashboard + API
bun run bot         # Telegram bot (needs BOT_TOKEN)
bun run typecheck   # type-check all workspaces
bun run --filter @moneyplant/db db:value   # batch: revalue portfolios from AMFI
```

> Root scripts use Bun's native `--filter` (not Turborepo). `turbo.json` is left in place but dormant.

---

## Roadmap & checklist

Full detail with per-part checklists in [`ROADMAP.md`](./ROADMAP.md).

### ✅ Phase 1 — self-hosted single-user tracker (≈ 90% done)

- [x] Frontend dashboard (all screens, wired to the live API)
- [x] Backend core (auth, transactions/pending/holdings API, analytics, CSV export)
- [x] Parse → mask → categorize cascade (keyword → Claude AI fallback)
- [x] 5-minute pending state machine (commit / cancel / auto-commit)
- [x] Telegram bot (secure linking + phone verification)
- [x] Portfolio valuation from AMFI NAVs
- [x] Local dev tooling + Docker
- [ ] **Deployment** — host web+API, host bot (or webhook), production Postgres, “deploy your own” guide *(the only thing left before Phase 1 ships)*

### ⬜ Phase 2 — hosted multi-user, privacy-preserving, + mobile app (not started)

- [ ] Multi-tenant hosting & accounts; **enforce row-level security** (opt-in scaffolding already in `packages/db/sql/rls.sql`)
- [ ] Privacy-preserving compute — **homomorphic encryption**: on-device encrypt → server computes on ciphertext, never decrypts
- [ ] Mobile app — **on-device AI** (~70–100 MB) for categorization + on-device encryption + sync + sign-up
- [ ] Ops & scale — digests, bot webhook, monitoring, AI cost controls

---

## Security & privacy

- **Secrets never committed.** `.env`, `.env.local`, and `apps/*/.env` are git-ignored; only the `*.example` templates are tracked. Generate `AUTH_SECRET` yourself.
- **No hardcoded credentials** in source — auth is env-driven; passwords are bcrypt-hashed.
- **Amounts are plaintext integer paise** in Phase 1 (your data, your deployment). At-rest/homomorphic encryption is a **Phase 2** concern — see the roadmap.
- **Per-user isolation** is enforced in every query today; database-level **RLS** ships as a ready-to-apply opt-in for the multi-tenant phase (`packages/db/sql/rls.sql`).
- **AI sees masked text only** — the amount is stripped before any AI categorization call.

---

## Troubleshooting

- **`AUTH_SECRET` / MissingSecret** → set `AUTH_SECRET` in `.env` (Docker) or `apps/web/.env.local` (local).
- **Bot exits / 401** → `BOT_TOKEN` unset or malformed (no spaces).
- **DB connection refused (Docker)** → wait for the `db` service healthcheck; the app retries.
- **Login fails right after registering (local, no DB)** → use a real Postgres (`bun run db` or Docker); the embedded fallback isn’t reliable across Next.js dev contexts.

---

## Design system

- **Type:** Fraunces (display), Libre Franklin (body), IBM Plex Mono (figures)
- **Palette:** warm paper `#EFE9DD`, card `#F6F2EA`, ink `#1C1A16`, botanical green `#2E5D45`, clay `#B06A2C`
- Tokens live in `apps/web/tailwind.config.ts`; globals in `apps/web/app/globals.css`.
