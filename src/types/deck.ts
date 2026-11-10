export interface Deck {
  id: string;
  name: string;
  description: string;
  language: string;
  icon: string;
  /** 主题色标识：派生于全局颜色系统（"primary"=淡紫， "secondary"=淡绿）。 */
  color: string;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_DECK_ID = "default";

/** 闪卡库可选主题色，全部从全局颜色系统派生。 */
export const DECK_COLOR_OPTIONS = ["primary", "secondary"] as const;

export type DeckColor = (typeof DECK_COLOR_OPTIONS)[number];

/** 归一化（兼容早期存储的十六进制颜色），返回全局主题色标识。 */
export function normalizeDeckColor(color: string): DeckColor {
  return color === "secondary" ? "secondary" : "primary";
}

/** 返回供内联样式使用的 CSS 变量引用，图标/文字会随浅色与深色主题自动适配。 */
export function deckColorVar(color: string): string {
  return normalizeDeckColor(color) === "secondary"
    ? "var(--color-secondary-text)"
    : "var(--color-primary-text)";
}

export function createDefaultDeck(now = Date.now()): Deck {
  return {
    id: DEFAULT_DECK_ID,
    name: "默认闪卡库",
    description: "默认保存位置",
    language: "all",
    icon: "library",
    color: "primary",
    createdAt: now,
    updatedAt: now,
  };
}
