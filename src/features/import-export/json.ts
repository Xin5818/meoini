import type { Flashcard } from "../../types/word";
import { DEFAULT_DECK_ID } from "../../types/deck.ts";
import { db, saveFlashcard } from "../../db/database.ts";

export function parseFlashcardsFromJson(text: string): Flashcard[] {
  const parsed: unknown = JSON.parse(text.replace(/^\uFEFF/, ""));
  const records = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && "flashcards" in parsed ? (parsed as { flashcards: unknown }).flashcards : null;
  if (!Array.isArray(records)) throw new Error("INVALID_FLASHCARD_JSON");
  return records.flatMap((item): Flashcard[] => {
    if (!item || typeof item !== "object") return [];
    const value = item as Partial<Flashcard>;
    const cardType = value.cardType === "custom" ? "custom" : "dictionary";
    const front = typeof value.front === "string" ? value.front : undefined;
    const back = typeof value.back === "string" ? value.back : undefined;
    if (typeof value.language !== "string" || (cardType === "custom" ? !front?.trim() || !back?.trim() : typeof value.word !== "string" || !value.word.trim())) return [];
    const now = Date.now();
    return [{
      id: typeof value.id === "string" && value.id ? value.id : crypto.randomUUID(),
      deckId: typeof value.deckId === "string" ? value.deckId : DEFAULT_DECK_ID,
      cardType,
      front,
      back,
      notes: typeof value.notes === "string" ? value.notes : undefined,
      audioUrl: typeof value.audioUrl === "string" ? value.audioUrl : undefined,
      imageUrl: typeof value.imageUrl === "string" ? value.imageUrl : undefined,
      word: typeof value.word === "string" ? value.word.trim() : "",
      language: value.language,
      meaning: typeof value.meaning === "string" ? value.meaning : "",
      partOfSpeech: value.partOfSpeech,
      example: value.example,
      dictionaryEntry: value.dictionaryEntry,
      lookupStatus: value.lookupStatus === "querying" ? "pending" : value.lookupStatus,
      lookupCompletedAt: value.lookupCompletedAt,
      lookupError: value.lookupError,
      lastReviewedAt: value.lastReviewedAt,
      lastReviewMode: value.lastReviewMode,
      earlyReviewCount: value.earlyReviewCount,
      tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === "string") : [],
      createdAt: typeof value.createdAt === "number" ? value.createdAt : now,
      dueAt: typeof value.dueAt === "number" ? value.dueAt : now,
      intervalDays: typeof value.intervalDays === "number" ? value.intervalDays : 0,
      repetitions: typeof value.repetitions === "number" ? value.repetitions : 0,
    }];
  });
}

export async function exportFlashcardsToJson(deckId?: string): Promise<string> {
  const cards = deckId ? await db.flashcards.where("deckId").equals(deckId).toArray() : await db.flashcards.toArray();
  return JSON.stringify({ version: 1, flashcards: cards }, null, 2);
}

export async function importFlashcardsFromJson(text: string, targetDeckId?: string): Promise<number> {
  const cards = parseFlashcardsFromJson(text);
  for (const source of cards) {
    const card = { ...source, deckId: targetDeckId ?? source.deckId ?? DEFAULT_DECK_ID };
    const existing = await db.flashcards.get(card.id);
    await saveFlashcard(existing && existing.deckId !== card.deckId ? { ...card, id: crypto.randomUUID() } : card);
  }
  return cards.length;
}
