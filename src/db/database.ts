import Dexie, { type Table } from "dexie";
import type { Flashcard } from "../types/word";
import type { Deck } from "../types/deck";
import { createDefaultDeck, DEFAULT_DECK_ID } from "../types/deck.ts";
import { repairStoredDictionaryMeaning } from "../features/dictionary/meaningProcessing.ts";

export class MeoiniDatabase extends Dexie {
  flashcards!: Table<Flashcard, string>;
  decks!: Table<Deck, string>;

  constructor(name = "meoini") {
    super(name);

    this.version(1).stores({
      flashcards: "id, word, language, dueAt, createdAt",
    });

    this.version(2).stores({
      flashcards: "id, word, language, deckId, dueAt, createdAt",
      decks: "id, name, language, createdAt, updatedAt",
    }).upgrade(async (transaction) => {
      const decks = transaction.table("decks");
      const flashcards = transaction.table("flashcards");
      const now = Date.now();
      await decks.put(createDefaultDeck(now));
      await flashcards.toCollection().modify((card: Flashcard) => {
        if (!card.deckId) card.deckId = DEFAULT_DECK_ID;
      });
    });

    this.version(3).stores({
      flashcards: "id, word, language, deckId, dueAt, createdAt",
      decks: "id, name, language, createdAt, updatedAt",
    }).upgrade(async (transaction) => {
      await transaction.table("flashcards").toCollection().modify((card: Flashcard) => {
        if (!card.cardType) card.cardType = "dictionary";
      });
      await transaction.table("decks").toCollection().modify((deck: Deck) => {
        if (!(["library", "cards", "book", "brain", "languages", "bookmark", "star", "lightbulb"] as string[]).includes(deck.icon)) deck.icon = "library";
      });
    });
  }
}

export const db = new MeoiniDatabase();

export async function saveFlashcard(card: Flashcard) {
  await db.flashcards.put(card);
}

export async function getFlashcards() {
  return repairDictionaryCards(await db.flashcards.orderBy("createdAt").reverse().toArray());
}

export async function getFlashcardsByDeck(deckId: string) {
  const cards = await db.flashcards.where("deckId").equals(deckId).toArray();
  cards.sort((a, b) => b.createdAt - a.createdAt);
  return repairDictionaryCards(cards);
}

export async function getDecks(): Promise<Deck[]> {
  const decks = await db.decks.orderBy("createdAt").toArray();
  if (decks.length) return decks;
  const fallback = createDefaultDeck();
  await db.transaction("rw", db.decks, db.flashcards, async () => {
    if (!(await db.decks.count())) await db.decks.put(fallback);
    await db.flashcards.toCollection().modify((card) => {
      if (!card.deckId) card.deckId = DEFAULT_DECK_ID;
    });
  });
  return db.decks.orderBy("createdAt").toArray();
}

export async function saveDeck(deck: Deck) {
  await db.decks.put({ ...deck, updatedAt: Date.now() });
}

export async function deleteDeck(deckId: string, mode: "delete-cards" | "move-to-default") {
  if (deckId === DEFAULT_DECK_ID) throw new Error("DEFAULT_DECK_CANNOT_BE_DELETED");
  await db.transaction("rw", db.decks, db.flashcards, async () => {
    if (mode === "delete-cards") await db.flashcards.where("deckId").equals(deckId).delete();
    else await db.flashcards.where("deckId").equals(deckId).modify({ deckId: DEFAULT_DECK_ID });
    await db.decks.delete(deckId);
  });
}

export async function moveFlashcardToDeck(cardId: string, deckId: string) {
  await db.flashcards.update(cardId, { deckId });
}

export async function recoverExpiredDictionaryLookups(
  now = Date.now(),
  staleAfterMs = 2 * 60 * 1000,
): Promise<number> {
  const stale = await db.flashcards
    .filter((card) => card.lookupStatus === "querying" && (!card.lookupStartedAt || now - card.lookupStartedAt >= staleAfterMs))
    .toArray();
  if (!stale.length) return 0;
  await db.flashcards.bulkPut(stale.map((card) => ({
    ...card,
    lookupStatus: "pending" as const,
    lookupStartedAt: undefined,
    lookupError: "上次查询中断，已恢复为待重试。",
  })));
  return stale.length;
}

export async function getFlashcardById(id: string) {
  return db.flashcards.get(id);
}

export async function getFlashcardByWord(word: string, language: string, deckId?: string) {
  const key = normalizeCardWord(word);
  return db.flashcards
    .where("language")
    .equals(language)
    .filter((card) => normalizeCardWord(card.word) === key && (!deckId || card.deckId === deckId))
    .first();
}

export async function saveFlashcardIfAbsent(card: Flashcard): Promise<{ card: Flashcard; inserted: boolean }> {
  return db.transaction("rw", db.flashcards, async () => {
    const existing = await getFlashcardByWord(card.word, card.language, card.deckId);
    if (existing) return { card: existing, inserted: false };
    await db.flashcards.add(card);
    return { card, inserted: true };
  });
}

export async function deleteFlashcard(id: string) {
  await db.flashcards.delete(id);
}

export async function countDueFlashcards(now = Date.now(), deckId?: string) {
  const due = db.flashcards.where("dueAt").belowOrEqual(now);
  return deckId ? due.filter((card) => card.deckId === deckId).count() : due.count();
}

export async function getDueFlashcards(now = Date.now(), deckId?: string) {
  const cards = await db.flashcards
    .where("dueAt")
    .belowOrEqual(now)
    .filter((card) => !deckId || card.deckId === deckId)
    .sortBy("dueAt");
  return repairDictionaryCards(cards);
}

async function repairDictionaryCards(cards: Flashcard[]): Promise<Flashcard[]> {
  const repaired = cards.map(repairStoredDictionaryMeaning);
  const changed = repaired.filter((card, index) => card !== cards[index]);
  if (changed.length) await db.flashcards.bulkPut(changed);
  return repaired;
}

function normalizeCardWord(word: string): string {
  return word.normalize("NFC").toLocaleLowerCase();
}
