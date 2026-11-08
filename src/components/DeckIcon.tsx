import type { CSSProperties, ReactNode } from "react";

const iconPaths: Record<string, ReactNode> = {
  library: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20M8 7h8M8 10h7"/></>,
  cards: <><rect x="5" y="4" width="13" height="16" rx="2"/><path d="M8 8h7M8 11h7M8 14h4M3 7v13a2 2 0 0 0 2 2h11"/></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 6h12M8 10h8M8 13h6"/></>,
  brain: <><path d="M12 5a3 3 0 0 0-5.7-1.3A3.5 3.5 0 0 0 5 10a3.5 3.5 0 0 0 1 6.5A3 3 0 0 0 12 18zM12 5a3 3 0 0 1 5.7-1.3A3.5 3.5 0 0 1 19 10a3.5 3.5 0 0 1-1 6.5A3 3 0 0 1 12 18zM12 5v14M8 8h2M14 11h2M8 14h2"/></>,
  languages: <><path d="m4 5 6 0M7 3v2c0 4-2 7-4 9M4 9c1 2 3 4 5 5M12 20l4-10 4 10M13.5 17h5"/><path d="M11 5h9M16 5c0 5-2 8-5 10"/></>,
  bookmark: <><path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4z"/><path d="M9 7h6"/></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>,
  lightbulb: <><path d="M9 18h6M10 21h4M8 14a7 7 0 1 1 8 0c-1 .7-1 1.5-1 2h-6c0-.5 0-1.3-1-2z"/><path d="M12 7v4M10 9h4"/></>,
};

export const DECK_ICON_NAMES = Object.keys(iconPaths);

export function DeckIcon({ name, className = "h-6 w-6", title, style }: { name: string; className?: string; title?: string; style?: CSSProperties }) {
  return <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>{title && <title>{title}</title>}{iconPaths[name] ?? iconPaths.library}</svg>;
}
