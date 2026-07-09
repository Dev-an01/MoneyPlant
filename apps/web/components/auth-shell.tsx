"use client";

import { PlantLogo } from "@/components/icons";

// Shared chrome for the /login and /register routes. Lives here (not in a page
// file) because Next's App Router only allows a default export from page.tsx —
// pages importing components from another route's page is disallowed.
export function AuthShell({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-[10px] mb-7 justify-center">
          <div className="w-[34px] h-[34px] rounded-lg bg-brand flex items-center justify-center">
            <PlantLogo size={19} />
          </div>
          <div className="font-serif font-semibold text-[22px] tracking-[-0.01em]">MoneyPlant</div>
        </div>
        <div className="mp-card px-7 py-8">
          <h1 className="font-serif text-[24px] font-semibold tracking-[-0.02em] m-0">{title}</h1>
          <p className="text-[14px] text-muted-2 mt-1 mb-6">{sub}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex flex-col gap-[6px] text-[12px] tracking-[0.04em] uppercase text-[#857C6B] font-semibold">
      {label}
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-[14.5px] font-normal normal-case tracking-normal px-[12px] py-[10px] border border-[#D8CFBE] rounded-[9px] bg-field outline-none focus:border-brand"
      />
    </label>
  );
}
