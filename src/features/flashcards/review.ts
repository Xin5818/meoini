import type { Flashcard, ReviewRating } from "../../types/word";
import { DEFAULT_DECK_ID } from "../../types/deck.ts";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Simple spaced repetition for v1; swap implementation later without touching UI. */
export function applyReview(
  card: Flashcard,
  rating: ReviewRating,
  now = Date.now(),
): Flashcard {
  let updated: Flashcard;
  switch (rating) {
    case "again":
      updated = {
        ...card,
        dueAt: now + 4 * HOUR,
        intervalDays: 0,
        repetitions: 0,
      };
      break;
    case "hard": {
      const intervalDays = Math.max(1, Math.floor(card.intervalDays * 0.5) || 1);
      updated = {
        ...card,
        intervalDays,
        dueAt: now + intervalDays * DAY,
        repetitions: card.repetitions + 1,
      };
      break;
    }
    case "good": {
      const intervalDays =
        card.intervalDays === 0
          ? 1
          : Math.min(365, Math.floor(card.intervalDays * 2) + 1);
      updated = {
        ...card,
        intervalDays,
        dueAt: now + intervalDays * DAY,
        repetitions: card.repetitions + 1,
      };
      break;
    }
  }
  return { ...updated, lastReviewedAt: now, lastReviewMode: "scheduled" };
}

export function createFlashcard(input: {
  word: string;
  language: string;
  meaning: string;
  example?: string;
  tags?: string[];
  deckId?: string;
}): Flashcard {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    deckId: input.deckId ?? DEFAULT_DECK_ID,
    cardType: "dictionary",
    word: input.word.trim(),
    language: input.language,
    meaning: input.meaning.trim(),
    example: input.example?.trim() || undefined,
    tags: input.tags ?? [],
    createdAt: now,
    dueAt: now,
    intervalDays: 0,
    repetitions: 0,
  };
}

export function createCustomFlashcard(input: {
  front: string;
  back: string;
  notes?: string;
  audioUrl?: string;
  imageUrl?: string;
  deckId: string;
}): Flashcard {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    deckId: input.deckId,
    cardType: "custom",
    front: input.front.trim(),
    back: input.back.trim(),
    notes: input.notes?.trim() || undefined,
    audioUrl: input.audioUrl?.trim() || undefined,
    imageUrl: input.imageUrl?.trim() || undefined,
    word: "",
    language: "custom",
    meaning: "",
    tags: [],
    createdAt: now,
    dueAt: now,
    intervalDays: 0,
    repetitions: 0,
  };
}

export function getFlashcardFront(card: Flashcard): string {
  return card.cardType === "custom" ? card.front ?? "" : card.word;
}

export function getFlashcardBack(card: Flashcard): string {
  return card.cardType === "custom" ? card.back ?? "" : card.meaning;
}
