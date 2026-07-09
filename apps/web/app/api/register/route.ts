import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, users, migrate } from "@moneyplant/db";

export const runtime = "nodejs";

// Registration is the first DB write for a new user, so make sure the schema
// exists (idempotent) — self-heals a fresh/embedded database.
let ready: Promise<void> | null = null;
const ensureSchema = () => (ready ??= migrate());

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z.string().trim().min(1).optional(),
});

export async function POST(req: Request) {
  await ensureSchema();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.insert(users).values({
    email,
    passwordHash,
    name: parsed.data.name ?? null,
  });

  return NextResponse.json({ ok: true });
}
