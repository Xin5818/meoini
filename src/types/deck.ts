export interface Deck {
  id: string;
  name: string;
  description: string;
  language: string;
  icon: string;
  color: string;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_DECK_ID = "default";

export function createDefaultDeck(now = Date.now()): Deck {
  return {
    id: DEFAULT_DECK_ID,
    name: "默认闪卡库",
    description: "默认保存位置",
    language: "all",
    icon: "library",
    color: "#4f46e5",
    createdAt: now,
    updatedAt: now,
  };
}
