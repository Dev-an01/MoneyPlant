# MoneyPlant — single image that runs either the web app or the bot.
# Uses Bun (the project's toolchain) to install, build, and run.
#
#   docker compose up --build            # web + db
#   docker compose --profile bot up      # + the Telegram bot
#
# If `next build` ever misbehaves under Bun, swap the builder stage to a Node
# image — but install still needs Bun (the lockfile is bun.lock).

# ---------- build ----------
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy the whole workspace and install (bun resolves the workspace graph).
COPY . .
RUN bun install

# NEXT_PUBLIC_* is inlined at build time — pass the bot username as a build arg
# so the "Connect Telegram" deep link works. Changing it later needs a rebuild.
ARG NEXT_PUBLIC_BOT_USERNAME=""
ENV NEXT_PUBLIC_BOT_USERNAME=$NEXT_PUBLIC_BOT_USERNAME

# Dummy build-time env so `next build` can load route modules without a live DB
# or real secret (no connection is made at build; runtime values come from compose).
RUN DATABASE_URL="postgres://build:build@localhost:5432/build" \
    AUTH_SECRET="build-only-secret-not-used-at-runtime" \
    AUTH_TRUST_HOST="true" \
    bun run --filter @moneyplant/web build

# ---------- runtime ----------
FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000

# Default command runs the web app; the bot service overrides it in compose.
# The schema is created automatically on first request (idempotent migrate()).
CMD ["bun", "run", "--filter", "@moneyplant/web", "start"]
