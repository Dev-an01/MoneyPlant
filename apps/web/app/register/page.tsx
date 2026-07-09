"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { AuthShell, Field } from "@/components/auth-shell";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create account.");
      setLoading(false);
      return;
    }
    // Auto-login after successful registration.
    await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    router.push("/");
    router.refresh();
  }

  return (
    <AuthShell title="Create your account" sub="Start tracking money by text.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Name" type="text" value={name} onChange={setName} placeholder="Anand" autoFocus />
        <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
        <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" />
        {error && <div className="text-[13px] text-danger bg-[#FAF1EF] border border-[#E3C4BF] rounded-lg px-3 py-2">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 text-[14px] font-semibold text-card bg-brand rounded-[9px] py-[11px] hover:bg-brand-dark disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="text-[13.5px] text-muted-2 mt-6 text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-brand font-semibold hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
