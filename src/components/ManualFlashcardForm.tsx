import { useState, type FormEvent } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { Deck } from "../types/deck";
import { DeckIcon } from "./DeckIcon";

interface ManualFlashcardFormProps {
  initialWord: string;
  language: string;
  deckId: string;
  decks: Deck[];
  onDeckChange: (id: string) => void;
  onSave: (data: { word: string; meaning: string; example?: string }) => void;
  onCancel?: () => void;
}

export function ManualFlashcardForm({
  initialWord,
  language,
  deckId,
  decks,
  onDeckChange,
  onSave,
  onCancel,
}: ManualFlashcardFormProps) {
  const { t } = useI18n();
  const [word, setWord] = useState(initialWord);
  const [meaning, setMeaning] = useState("");
  const [example, setExample] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!word.trim() || !meaning.trim()) return;
    onSave({
      word: word.trim(),
      meaning: meaning.trim(),
      example: example.trim() || undefined,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h3 className="font-semibold text-slate-900">{t("手动创建闪卡")}</h3>
      <p className="mt-1 text-xs text-slate-500">
        {t("语言：{{language}} · 词典未收录时也可继续学习", { language })}
      </p>
      <label className="mt-3 block text-sm"><span className="text-slate-500">{t("目标闪卡库")}</span><span className="flex items-center gap-2"><DeckIcon name={decks.find((deck) => deck.id === deckId)?.icon ?? "library"} /><select value={deckId} onChange={(event) => onDeckChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2">{decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.id === "default" && deck.name === "默认闪卡库" ? t("默认闪卡库") : deck.name}</option>)}</select></span></label>
      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="text-slate-600">{t("单词")}</span>
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">{t("释义")}</span>
          <textarea
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">{t("例句（可选）")}</span>
          <input
            value={example}
            onChange={(e) => setExample(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 py-2 text-sm"
          >
            {t("取消")}
          </button>
        )}
        <button
          type="submit"
          className="flex-1 rounded-xl bg-brand-700 py-2 text-sm font-semibold text-white"
        >
          {t("保存闪卡")}
        </button>
      </div>
    </form>
  );
}
