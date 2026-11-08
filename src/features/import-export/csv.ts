import { db, saveFlashcard } from "../../db/database.ts";
import type { Flashcard } from "../../types/word";
import { DEFAULT_DECK_ID } from "../../types/deck.ts";

const CSV_HEADERS = [
  "id",
  "word",
  "language",
  "meaning",
  "example",
  "tags",
  "createdAt",
  "dueAt",
  "intervalDays",
  "repetitions",
  "partOfSpeech",
  "lookupStatus",
  "dictionaryEntry",
  "lookupStartedAt",
  "lookupCompletedAt",
  "lookupError",
  "lastReviewedAt",
  "lastReviewMode",
  "earlyReviewCount",
  "deckId",
  "cardType",
  "front",
  "back",
  "notes",
  "audioUrl",
  "imageUrl",
] as const;

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') inQuotes = false;
      else field += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export async function exportFlashcardsToCsv(deckId?: string): Promise<string> {
  const cards = deckId ? await db.flashcards.where("deckId").equals(deckId).toArray() : await db.flashcards.toArray();
  const header = CSV_HEADERS.join(",");
  const lines = cards.map((card) =>
    [
      card.id,
      card.word,
      card.language,
      card.meaning,
      card.example ?? "",
      card.tags.join("|"),
      String(card.createdAt),
      String(card.dueAt),
      String(card.intervalDays),
      String(card.repetitions),
      card.partOfSpeech ?? "",
      card.lookupStatus ?? "",
      card.dictionaryEntry ? JSON.stringify(card.dictionaryEntry) : "",
      String(card.lookupStartedAt ?? ""),
      String(card.lookupCompletedAt ?? ""),
      card.lookupError ?? "",
      String(card.lastReviewedAt ?? ""),
      card.lastReviewMode ?? "",
      String(card.earlyReviewCount ?? ""),
      card.deckId ?? DEFAULT_DECK_ID,
      card.cardType ?? "dictionary",
      card.front ?? "",
      card.back ?? "",
      card.notes ?? "",
      card.audioUrl ?? "",
      card.imageUrl ?? "",
    ]
      .map(escapeCsvField)
      .join(","),
  );
  return [header, ...lines].join("\n");
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importFlashcardsFromCsv(text: string, targetDeckId?: string): Promise<number> {
  const cards = parseFlashcardsFromCsv(text).map((card) => ({ ...card, deckId: targetDeckId ?? card.deckId ?? DEFAULT_DECK_ID }));
  for (const card of cards) {
    const existing = await db.flashcards.get(card.id);
    await saveFlashcard(existing && existing.deckId !== card.deckId ? { ...card, id: crypto.randomUUID() } : card);
  }
  return cards.length;
}

export function parseFlashcardsFromCsv(text: string): Flashcard[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim());
  const hasHeader = header[0] === "id" || header[0] === "word";
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const cards: Flashcard[] = [];
  for (const row of dataRows) {
    const card = rowToFlashcard(row, header, hasHeader);
    if (card) cards.push(card);
  }
  return cards;
}

function rowToFlashcard(
  row: string[],
  header: string[],
  hasHeader: boolean,
): Flashcard | null {
  const get = (name: string, index: number) => {
    if (hasHeader) {
      const idx = header.indexOf(name);
      return idx >= 0 ? (row[idx] ?? "").trim() : "";
    }
    return (row[index] ?? "").trim();
  };

  const word = get("word", 0);
  const meaning = get("meaning", 2);
  const cardType = get("cardType", 20) === "custom" ? "custom" : "dictionary";
  const front = get("front", 21) || undefined;
  const back = get("back", 22) || undefined;
  if (cardType === "custom" ? !front || !back : !word || !meaning) return null;

  const now = Date.now();
  const id = get("id", 0) || crypto.randomUUID();
  const language = get("language", 1) || "en";
  const example = get("example", 3) || undefined;
  const tagsRaw = get("tags", 4);
  const tags = tagsRaw ? tagsRaw.split("|").filter(Boolean) : [];

  const createdAt = Number(get("createdAt", 5)) || now;
  const dueAt = Number(get("dueAt", 6)) || now;
  const intervalDays = Number(get("intervalDays", 7)) || 0;
  const repetitions = Number(get("repetitions", 8)) || 0;
  const partOfSpeech = get("partOfSpeech", 9) || undefined;
  const lookupStatusRaw = get("lookupStatus", 10);
  const lookupStatus = lookupStatusRaw === "querying"
    ? "pending"
    : ["pending", "found", "not_found", "error"].includes(lookupStatusRaw)
      ? lookupStatusRaw as Flashcard["lookupStatus"]
      : undefined;
  let dictionaryEntry: Flashcard["dictionaryEntry"];
  const rawEntry = get("dictionaryEntry", 11);
  if (rawEntry) {
    try {
      dictionaryEntry = JSON.parse(rawEntry) as Flashcard["dictionaryEntry"];
    } catch {
      dictionaryEntry = undefined;
    }
  }

  const lastReviewModeRaw = get("lastReviewMode", 17);
  const lastReviewMode = lastReviewModeRaw === "scheduled" || lastReviewModeRaw === "early"
    ? lastReviewModeRaw
    : undefined;

  return {
    id,
    cardType,
    front,
    back,
    notes: get("notes", 23) || undefined,
    audioUrl: get("audioUrl", 24) || undefined,
    imageUrl: get("imageUrl", 25) || undefined,
    word,
    language,
    meaning,
    partOfSpeech,
    example,
    lookupStatus,
    dictionaryEntry,
    lookupStartedAt: undefined,
    lookupCompletedAt: Number(get("lookupCompletedAt", 13)) || undefined,
    lookupError: get("lookupError", 14) || undefined,
    lastReviewedAt: Number(get("lastReviewedAt", 16)) || undefined,
    lastReviewMode,
    earlyReviewCount: Number(get("earlyReviewCount", 18)) || undefined,
    deckId: get("deckId", 19) || DEFAULT_DECK_ID,
    tags,
    createdAt,
    dueAt,
    intervalDays,
    repetitions,
  };
}
