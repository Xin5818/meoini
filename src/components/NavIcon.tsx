import type { ReactNode } from "react";

export type NavIconName = "search" | "review" | "library" | "settings";

const iconPaths: Record<NavIconName, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </>
  ),
  review: (
    <>
      <path d="M12 5a3 3 0 0 0-5.7-1.3A3.5 3.5 0 0 0 5 10a3.5 3.5 0 0 0 1 6.5A3 3 0 0 0 12 18zM12 5a3 3 0 0 1 5.7-1.3A3.5 3.5 0 0 1 19 10a3.5 3.5 0 0 1-1 6.5A3 3 0 0 1 12 18zM12 5v14" />
    </>
  ),
  library: (
    <>
      <rect x="5" y="4" width="13" height="16" rx="2" />
      <path d="M3 7v13a2 2 0 0 0 2 2h11" />
    </>
  ),
  settings: (
    <>
      <path d="M4 8h16M4 16h16" />
      <circle cx="15" cy="8" r="2.2" fill="var(--color-surface)" />
      <circle cx="9" cy="16" r="2.2" fill="var(--color-surface)" />
    </>
  ),
};

export function NavIcon({ name, className = "h-5 w-5 shrink-0" }: { name: NavIconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}
