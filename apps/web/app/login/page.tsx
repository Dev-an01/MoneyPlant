"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { AuthShell, Field } from "@/components/auth-shell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Wrong email or password.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <AuthShell title="Welcome back" sub="Log in to your MoneyPlant dashboard.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoFocus />
        <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
        {error && <div className="text-[13px] text-danger bg-[#FAF1EF] border border-[#E3C4BF] rounded-lg px-3 py-2">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 text-[14px] font-semibold text-card bg-brand rounded-[9px] py-[11px] hover:bg-brand-dark disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>
      <p className="text-[13.5px] text-muted-2 mt-6 text-center">
        New here?{" "}
        <Link href="/register" className="text-brand font-semibold hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
