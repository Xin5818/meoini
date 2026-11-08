import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { deleteDeck as deleteDeckFromDb, getDecks, saveDeck } from "../../db/database";
import type { Deck } from "../../types/deck";
import { createDefaultDeck, DEFAULT_DECK_ID } from "../../types/deck";

const ACTIVE_DECK_KEY = "meoini.activeDeckId";

interface DeckContextValue {
  decks: Deck[];
  activeDeckId: string;
  activeDeck: Deck;
  loadingDecks: boolean;
  deckError: string;
  setActiveDeckId: (id: string) => void;
  refreshDecks: () => Promise<void>;
  createOrUpdateDeck: (deck: Deck) => Promise<void>;
  removeDeck: (id: string, mode: "delete-cards" | "move-to-default") => Promise<void>;
}

const DeckContext = createContext<DeckContextValue | null>(null);

function readActiveDeckId(): string {
  try { return localStorage.getItem(ACTIVE_DECK_KEY) ?? DEFAULT_DECK_ID; } catch { return DEFAULT_DECK_ID; }
}

export function DeckProvider({ children }: { children: ReactNode }) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [activeDeckId, setActiveDeckIdState] = useState(readActiveDeckId);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [deckError, setDeckError] = useState("");

  const refreshDecks = useCallback(async () => {
    setLoadingDecks(true);
    try {
      const saved = await getDecks();
      setDecks(saved);
      setDeckError("");
      if (!saved.some((deck) => deck.id === activeDeckId)) setActiveDeckId(saved[0]?.id ?? DEFAULT_DECK_ID);
    } catch {
      setDeckError("读取闪卡库失败，请重试。");
    } finally {
      setLoadingDecks(false);
    }
  }, [activeDeckId]);

  useEffect(() => { void refreshDecks(); }, [refreshDecks]);

  const setActiveDeckId = useCallback((id: string) => {
    setActiveDeckIdState(id);
    try { localStorage.setItem(ACTIVE_DECK_KEY, id); } catch { /* keep this session usable */ }
  }, []);

  const createOrUpdateDeck = useCallback(async (deck: Deck) => {
    await saveDeck(deck);
    await refreshDecks();
  }, [refreshDecks]);

  const removeDeck = useCallback(async (id: string, mode: "delete-cards" | "move-to-default") => {
    await deleteDeckFromDb(id, mode);
    if (activeDeckId === id) setActiveDeckId(DEFAULT_DECK_ID);
    await refreshDecks();
  }, [activeDeckId, refreshDecks, setActiveDeckId]);

  const activeDeck = decks.find((deck) => deck.id === activeDeckId) ?? decks[0] ?? createDefaultDeck();
  const value = useMemo(() => ({ decks, activeDeckId, activeDeck, loadingDecks, deckError, setActiveDeckId, refreshDecks, createOrUpdateDeck, removeDeck }), [decks, activeDeckId, activeDeck, loadingDecks, deckError, setActiveDeckId, refreshDecks, createOrUpdateDeck, removeDeck]);

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

export function useDecks() {
  const context = useContext(DeckContext);
  if (!context) throw new Error("useDecks must be used within DeckProvider");
  return context;
}
