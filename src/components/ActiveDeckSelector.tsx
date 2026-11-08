import { useI18n } from "../i18n/I18nProvider";
import { useDecks } from "../features/decks/DeckContext";
import { DeckIcon } from "./DeckIcon";

export function ActiveDeckSelector() {
  const { t } = useI18n();
  const { decks, activeDeckId, setActiveDeckId, loadingDecks, deckError, refreshDecks } = useDecks();
  const deckName = (deck: { id: string; name: string }) => deck.id === "default" && deck.name === "默认闪卡库" ? t("默认闪卡库") : deck.name;
  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-3">
      <label className="flex items-center gap-3 text-sm">
        <span className="shrink-0 font-medium text-slate-500">{t("当前闪卡库")}</span>
        <select aria-label={t("当前闪卡库")} value={activeDeckId} disabled={loadingDecks} onChange={(event) => setActiveDeckId(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
          {decks.map((deck) => <option key={deck.id} value={deck.id}>{deckName(deck)}</option>)}
        </select>
        <DeckIcon name={decks.find((deck) => deck.id === activeDeckId)?.icon ?? "library"} className="h-6 w-6 shrink-0" style={{ color: decks.find((deck) => deck.id === activeDeckId)?.color }} />
      </label>
      {deckError && <p role="alert" className="mt-2 text-xs text-red-700">{t(deckError)} <button type="button" onClick={() => void refreshDecks()} className="underline">{t("重试")}</button></p>}
    </div>
  );
}
