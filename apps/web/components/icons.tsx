import * as React from "react";

type IconName =
  | "overview"
  | "transactions"
  | "spending"
  | "insights"
  | "portfolio"
  | "pending"
  | "privacy"
  | "settings"
  | "budgets"
  | "search"
  | "expense"
  | "invest"
  | "download"
  | "edit"
  | "trash"
  | "chevronLeft"
  | "chevronRight"
  | "send"
  | "check"
  | "close"
  | "alert"
  | "refresh"
  | "clock"
  | "digest";

const PATHS: Record<IconName, React.ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="8" height="9" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="12" width="8" height="9" rx="1.5" />
      <rect x="3" y="16" width="8" height="5" rx="1.5" />
    </>
  ),
  transactions: (
    <>
      <path d="M4 4h16v16l-2.5-1.5L15 20l-2.5-1.5L10 20l-2.5-1.5L5 20l-1-1Z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  spending: (
    <>
      <path d="M21 12a9 9 0 1 1-9-9v9Z" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </>
  ),
  insights: (
    <>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16v-4" />
      <path d="M13 16V8" />
      <path d="M18 16v-6" />
    </>
  ),
  portfolio: (
    <>
      <path d="M3 17l5-5 4 4 7-8" />
      <path d="M20 7h-4M20 7v4" />
    </>
  ),
  pending: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  privacy: (
    <>
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a7.8 7.8 0 0 0 0-3l1.8-1.4-2-3.4-2.1.9a7.6 7.6 0 0 0-2.6-1.5L14 2h-4l-.5 2.6a7.6 7.6 0 0 0-2.6 1.5l-2.1-.9-2 3.4L4.6 10.5a7.8 7.8 0 0 0 0 3l-1.8 1.4 2 3.4 2.1-.9a7.6 7.6 0 0 0 2.6 1.5L10 22h4l.5-2.6a7.6 7.6 0 0 0 2.6-1.5l2.1.9 2-3.4Z" />
    </>
  ),
  budgets: (
    <>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </>
  ),
  expense: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  invest: (
    <>
      <path d="M4 17l5-5 4 4 7-8" />
      <path d="M20 8h-4M20 8v4" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 11 5 4 5-4" />
      <path d="M5 21h14" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
    </>
  ),
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  send: (
    <>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  alert: (
    <>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  digest: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="M12 8v4l3 2" />
      <path d="M16 3h5v5" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.75,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export const PlantLogo = ({ size = 17 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#F6F2EA"
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 21c-4 0-8-2.5-8-8 5 0 8 3 8 8Z" />
    <path d="M12 21c0-6 3-10 8-11 0 6.5-4 11-8 11Z" />
    <path d="M12 21v-7" />
  </svg>
);
