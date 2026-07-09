# MoneyPlant — Auth Setup (email + password)

Email/password auth using **Auth.js (NextAuth v5)** with **Drizzle + Postgres**, Postgres running in **Docker**. Passwords are hashed with bcrypt; sessions are JWT. Follow these once.

> Run everything from the repo root (`MoneyPlant/`) unless noted.

## 1. Prerequisites

- **Bun** ≥ 1.1 — `powershell -c "irm bun.sh/install.ps1 | iex"` (Windows), then restart the terminal.
- **PostgreSQL** installed (any recent version). `bun run db` uses its binaries to
  create a private local cluster — no Docker, no password. Already have a Postgres
  (Neon/Supabase/Docker/native)? Skip step 3 and point `DATABASE_URL` at it.

## 2. Install dependencies

```bash
bun install
```

## 3. Start the local Postgres

```bash
bun run db
```

First run creates a dedicated **trust-auth** cluster at `~/.moneyplant/pg17` and starts
it on `127.0.0.1:5544` with a database named `moneyplant`. It stays running in the
background (like Docker). Stop it with `bun run db:stop`. Override the binary location
with `PG_BIN=/path/to/postgres/bin` if it isn't auto-detected.

## 4. Create your env file

One file (gitignored): `apps/web/.env.local`. Generate an auth secret:

```bash
npx auth secret        # prints a value — copy it   (or: openssl rand -base64 32)
```

> You generate and paste this secret yourself — it is never sent anywhere. Keep `.env*` out of git (already ignored).

`apps/web/.env.local`:

```
AUTH_SECRET=<the value you generated>
AUTH_TRUST_HOST=true
DATABASE_URL=postgres://postgres@127.0.0.1:5544/moneyplant
```

## 5. Schema

Nothing to do — the app creates/updates the schema automatically on first boot
(idempotent `migrate()`). To pre-create it manually you can still run
`DATABASE_URL=... bun run --filter @moneyplant/db db:setup`.

## 6. Run the app

```bash
bun run web        # → http://localhost:3000
```

## 7. Create your account

1. Visiting `/` while logged out redirects you to **`/login`**.
2. Click **Create an account** → `/register`, enter name / email / password (min 8 chars).
3. You're auto-logged-in and dropped on the dashboard.
4. Sign out from **Settings → Session → Sign out**.

## How it works (for later reference)

- `apps/web/auth.config.ts` — edge-safe config + the `authorized` callback that protects every route via `middleware.ts`.
- `apps/web/auth.ts` — the Credentials provider: looks up the user by email, verifies the bcrypt hash.
- `apps/web/app/api/register/route.ts` — creates a user (hashes the password, rejects duplicate emails).
- `packages/db` — Drizzle client + `users` schema.

## Troubleshooting

- **`DATABASE_URL is not set`** → you skipped step 4, or are running from the wrong folder.
- **DB connection refused** → `docker compose up -d` and wait for `healthy` in `docker compose ps`.
- **`MissingSecret`** → `AUTH_SECRET` isn't set in `apps/web/.env.local`.
- **Login always fails** → make sure you ran `db:push` (step 5) so the `users` table exists.

## What's next

- The rest of **Phase 1** (transactions / pending / holdings API, bot, analytics,
  valuation) is built — see `README.md` and `ROADMAP.md`. Only **deployment**
  remains before Phase 1 ships.
- **RLS** and **amount encryption** are **Phase 2** (hosted multi-user) concerns:
  RLS ships as an opt-in (`packages/db/sql/rls.sql`), and encryption is done there
  with homomorphic + on-device encryption — not as at-rest encryption in Phase 1.
