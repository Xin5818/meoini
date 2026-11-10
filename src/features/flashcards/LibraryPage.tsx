import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteFlashcard,
  getFlashcards,
  moveFlashcardToDeck,
  saveFlashcard,
} from "../../db/database";
import type { Flashcard } from "../../types/word";
import { lookupAndUpdateFlashcard } from "../import-export/txt";
import { DictionaryLookupProgress } from "../../components/DictionaryLookupProgress";
import { withTimeout } from "../../utils/withTimeout";
import { useI18n } from "../../i18n/I18nProvider";
import { useDecks } from "../decks/DeckContext";
import { DEFAULT_DECK_ID, DECK_COLOR_OPTIONS, deckColorVar, type Deck } from "../../types/deck";
import { DECK_ICON_NAMES, DeckIcon } from "../../components/DeckIcon";
import { createCustomFlashcard, getFlashcardBack, getFlashcardFront } from "./review";
import { useEscapeKey } from "../../hooks/useEscapeKey";

export function LibraryPage() {
  const { t } = useI18n();
  const { decks, activeDeck, activeDeckId, createOrUpdateDeck, removeDeck, refreshDecks } = useDecks();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [query, setQuery] = useState("");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Flashcard | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [allDecksView, setAllDecksView] = useState(false);
  const [deckEditor, setDeckEditor] = useState<Deck | null>(null);
  const [deckDeleteTarget, setDeckDeleteTarget] = useState<Deck | null>(null);
  const [movingCardId, setMovingCardId] = useState<string | null>(null);
  const [deckCounts, setDeckCounts] = useState<Record<string, number>>({});
  const [showCustomForm, setShowCustomForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const allCards = await withTimeout(getFlashcards(), 10_000, "LIBRARY_LOAD_TIMEOUT");
      setDeckCounts(Object.fromEntries(decks.map((deck) => [deck.id, allCards.filter((card) => card.deckId === deck.id).length])));
      setCards(allDecksView ? allCards : allCards.filter((card) => card.deckId === activeDeckId));
    } catch (error) {
      setLoadError(error instanceof Error && error.message === "LIBRARY_LOAD_TIMEOUT" ? "读取词库超时。" : "读取词库失败。检查本地存储后重试。");
    } finally {
      setLoading(false);
    }
  }, [activeDeckId, allDecksView, decks]);

  useEffect(() => {
    void load();
  }, [load]);

  const languages = useMemo(() => {
    return [...new Set(cards.map((c) => c.language))].sort();
  }, [cards]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (langFilter !== "all" && c.language !== langFilter) return false;
      if (!q) return true;
      return (
        getFlashcardFront(c).toLowerCase().includes(q) ||
        getFlashcardBack(c).toLowerCase().includes(q) ||
        (c.notes ?? "").toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [cards, query, langFilter]);

  async function handleDelete(id: string) {
    if (!confirm(t("确定删除这张闪卡？"))) return;
    setActionError("");
    try {
      await withTimeout(deleteFlashcard(id), 10_000, "LIBRARY_ACTION_TIMEOUT");
      await load();
    } catch {
      setActionError("删除闪卡失败或超时，请重试。");
    }
  }

  async function handleSaveEdit(form: Flashcard) {
    setActionError("");
    try {
      await withTimeout(saveFlashcard(form), 10_000, "LIBRARY_ACTION_TIMEOUT");
      setEditing(null);
      await load();
    } catch {
      setActionError("保存闪卡失败或超时，请重试。");
    }
  }

  async function retryLookup(card: Flashcard) {
    setRetrying(card.id);
    setActionError("");
    try {
      const result = await withTimeout(lookupAndUpdateFlashcard(card.id), 50_000, "LOOKUP_TIMEOUT");
      if (result === "error") setActionError(`“${card.word}”查询失败，请检查网络后重试。`);
      await load();
    } catch {
      setActionError(`“${card.word}”查询失败或超时，请稍后重试。`);
    } finally {
      setRetrying(null);
    }
  }

  async function saveDeckForm(deck: Deck) {
    await createOrUpdateDeck(deck);
    setDeckEditor(null);
    await load();
  }

  async function moveCard(card: Flashcard, targetDeckId: string) {
    if (targetDeckId === card.deckId) return;
    await moveFlashcardToDeck(card.id, targetDeckId);
    await load();
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold">{t("我的词库")}</h1>
        <p className="text-sm text-text-muted">{allDecksView ? t("全部闪卡视图") : `${activeDeck.icon} ${activeDeck.id === DEFAULT_DECK_ID && activeDeck.name === "默认闪卡库" ? t("默认闪卡库") : activeDeck.name}`} · {t("共 {{count}} 张闪卡", { count: cards.length })}</p>
      </header>

      <button type="button" onClick={() => setShowCustomForm(true)} className="w-full rounded-xl bg-primary-text px-4 py-3 text-sm font-semibold text-text-inverse shadow-sm">＋ {t("添加自定义闪卡")}</button>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{t("闪卡库管理")}</h2><button type="button" onClick={() => setDeckEditor(newDeck())} className="rounded-lg bg-primary-text px-3 py-2 text-sm font-semibold text-text-inverse">{t("创建闪卡库")}</button></div>
        <p className="mt-1 text-xs text-text-muted">{t("切换当前闪卡库会同步影响复习范围。")}</p>
        <ul className="mt-3 space-y-2">{decks.map((deck) => <li key={deck.id} className="flex items-center justify-between gap-2 rounded-lg bg-primary p-3"><div className="flex min-w-0 items-center gap-2"><DeckIcon name={deck.icon} className="h-6 w-6 shrink-0" style={{ color: deckColorVar(deck.color) }} /><div className="min-w-0"><p className="truncate font-medium"><span style={{ color: deckColorVar(deck.color) }}>{deck.id === DEFAULT_DECK_ID && deck.name === "默认闪卡库" ? t("默认闪卡库") : deck.name}</span>{deck.id === activeDeckId && <span className="ml-2 text-xs text-primary-text">{t("当前")}</span>}</p><p className="text-xs text-text-muted">{deck.id === DEFAULT_DECK_ID && deck.description === "默认保存位置" ? t("默认保存位置") : deck.description || t("暂无描述")} · {t("{{count}} 张", { count: deckCounts[deck.id] ?? 0 })}</p></div></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => setDeckEditor(deck)} className="text-sm text-primary-text underline">{t("编辑")}</button>{deck.id !== DEFAULT_DECK_ID && <button type="button" onClick={() => setDeckDeleteTarget(deck)} className="text-sm text-error underline">{t("删除")}</button>}</div></li>)}</ul>
        <button type="button" onClick={() => setAllDecksView((value) => !value)} className="mt-3 rounded-lg border border-border px-3 py-2 text-sm font-medium">{allDecksView ? t("仅显示当前闪卡库") : t("查看全部闪卡")}</button>
      </section>

      <DictionaryLookupProgress deckId={allDecksView ? undefined : activeDeckId} />
      </div>

      {actionError && <p role="alert" className="text-sm text-error">{t(actionError)}</p>}


      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("搜索单词或释义…")}
        className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none ring-primary-text focus:ring-2"
      />

      {languages.length > 1 && (
        <select
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="all">{t("全部语言")}</option>
          {languages.map((lang) => (
            <option key={lang} value={lang}>
              {lang === "custom" ? t("自定义") : lang}
            </option>
          ))}
        </select>
      )}

      {loading ? <p role="status" className="py-8 text-center text-sm text-text-muted">{t("正在读取词库…")}</p> : loadError ? (
        <div className="rounded-xl bg-error/10 p-4 text-sm text-error" role="alert">
          <p>{t(loadError)}</p>
          <button type="button" onClick={() => void load()} className="mt-2 font-semibold underline">{t("重试")}</button>
        </div>
      ) : <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filtered.map((card) => (
          <li
            key={card.id}
            className="flex flex-col rounded-xl border border-border bg-surface p-4 shadow-sm"
          >
            <div className="flex flex-1 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words whitespace-pre-wrap font-semibold text-text">{getFlashcardFront(card)}</p>
                <p className={`mt-1 whitespace-pre-wrap text-sm line-clamp-2 break-words ${getFlashcardBack(card) ? "text-text-muted" : "italic text-text-muted/70"}`}>
                  {getFlashcardBack(card) || (card.dictionaryEntry?.forms?.length ? t("词形条目：{{form}} of {{lemma}}", { form: card.dictionaryEntry.forms[0].grammaticalForm, lemma: card.dictionaryEntry.forms[0].lemma }) : t(card.lookupStatus === "not_found" ? "暂未找到释义" : card.lookupStatus === "error" ? "查询失败，待重试" : card.lookupStatus === "querying" ? "释义查询中…" : card.lookupStatus === "pending" ? "待查询" : "待补充释义"))}
                </p>
                {card.cardType !== "custom" && card.partOfSpeech && <p className="mt-1 text-xs text-text-muted">{card.partOfSpeech}</p>}
                {(card.lookupStatus === "not_found" || card.lookupStatus === "error" || card.lookupStatus === "pending") && (
                  <button type="button" disabled={retrying === card.id} onClick={() => void retryLookup(card)} className="mt-1 text-xs text-primary-text underline disabled:opacity-50">
                    {retrying === card.id ? t("正在重试…") : t("重试查询释义")}
                  </button>
                )}
                {card.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {card.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-text-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <label className="mt-2 flex items-center gap-2 text-xs text-text-muted">{t("移动到闪卡库")}<select value={card.deckId ?? DEFAULT_DECK_ID} disabled={movingCardId === card.id} onChange={(event) => { setMovingCardId(card.id); void moveCard(card, event.target.value).catch(() => setActionError("移动闪卡失败，请重试。" )).finally(() => setMovingCardId(null)); }} className="rounded border border-border bg-surface px-2 py-1">{decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.icon} {deck.id === DEFAULT_DECK_ID ? t("默认闪卡库") : deck.name}</option>)}</select></label>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(card)}
                  className="rounded-lg px-2 py-1 text-xs text-primary-text"
                >
                  {t("编辑")}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(card.id)}
                  className="rounded-lg px-2 py-1 text-xs text-error"
                >
                  {t("删除")}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>}

      {!loading && !loadError && filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-text-muted">{t("没有匹配的卡片")}</p>
      )}

      {editing && (
        <EditModal
          card={editing}
          decks={decks}
          onClose={() => setEditing(null)}
          onSave={handleSaveEdit}
          t={t}
        />
      )}
      {showCustomForm && <CustomFlashcardForm decks={decks} defaultDeckId={activeDeckId} onCancel={() => setShowCustomForm(false)} onSave={async (data) => { await saveFlashcard(createCustomFlashcard(data)); setShowCustomForm(false); await load(); }} />}
      {deckEditor && <DeckEditor deck={deckEditor} onCancel={() => setDeckEditor(null)} onSave={(deck) => void saveDeckForm(deck)} />}
      {deckDeleteTarget && <DeckDeleteDialog deck={deckDeleteTarget} onCancel={() => setDeckDeleteTarget(null)} onDeleteCards={() => void removeDeck(deckDeleteTarget.id, "delete-cards").then(async () => { setDeckDeleteTarget(null); await refreshDecks(); await load(); })} onMoveCards={() => void removeDeck(deckDeleteTarget.id, "move-to-default").then(async () => { setDeckDeleteTarget(null); await refreshDecks(); await load(); })} />}
    </div>
  );
}

function newDeck(): Deck { const now = Date.now(); return { id: crypto.randomUUID(), name: "", description: "", language: "all", icon: "cards", color: "primary", createdAt: now, updatedAt: now }; }

function DeckEditor({ deck, onCancel, onSave }: { deck: Deck; onCancel: () => void; onSave: (deck: Deck) => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState(deck);
  useEscapeKey(onCancel);
  return <div className="fixed inset-0 z-30 flex items-end justify-center bg-overlay p-4 sm:items-center"><form className="max-h-[92vh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl bg-surface p-5" onSubmit={(event) => { event.preventDefault(); if (form.name.trim()) onSave({ ...form, name: form.name.trim() }); }}><h2 className="text-lg font-bold">{deck.name ? t("编辑闪卡库") : t("创建闪卡库")}</h2><label className="block text-sm">{t("名称")}<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-lg border border-border px-3 py-2" /></label><label className="block text-sm">{t("描述")}<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 w-full rounded-lg border border-border px-3 py-2" /></label><div><p className="text-sm font-medium">{t("选择图标")}</p><div className="mt-2 grid grid-cols-4 gap-2">{DECK_ICON_NAMES.map((icon) => <button key={icon} type="button" aria-label={t(`deck.icon.${icon}`)} aria-pressed={form.icon === icon} onClick={() => setForm({ ...form, icon })} className={`flex h-12 items-center justify-center rounded-lg border ${form.icon === icon ? "border-primary-text bg-primary" : "border-border"}`}><DeckIcon name={icon} style={{ color: deckColorVar(form.color) }} /></button>)}</div></div><label className="block text-sm">{t("颜色")}<select value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2">{DECK_COLOR_OPTIONS.map((option) => <option key={option} value={option}>{option === "secondary" ? t("淡绿") : t("浅紫")}</option>)}</select></label><div className="rounded-xl border border-border bg-primary p-3"><p className="mb-2 text-xs text-text-muted">{t("预览")}</p><div className="flex items-center gap-3"><DeckIcon name={form.icon} className="h-8 w-8" style={{ color: deckColorVar(form.color) }} /><span className="font-semibold" style={{ color: deckColorVar(form.color) }}>{form.name || t("闪卡库名称")}</span></div></div><label className="block text-sm">{t("学习语言")}<select value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} className="mt-1 w-full rounded-lg border border-border px-3 py-2"><option value="all">{t("全部语言")}</option><option value="fi">Finnish (fi)</option><option value="en">English (en)</option></select></label><div className="flex gap-2"><button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-border py-2">{t("取消")}</button><button type="submit" className="flex-1 rounded-lg bg-primary-text py-2 font-semibold text-text-inverse">{t("保存")}</button></div></form></div>;
}

function CustomFlashcardForm({ decks, defaultDeckId, onCancel, onSave }: { decks: Deck[]; defaultDeckId: string; onCancel: () => void; onSave: (data: { front: string; back: string; notes?: string; audioUrl?: string; imageUrl?: string; deckId: string }) => Promise<void> }) {
  const { t } = useI18n();
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [notes, setNotes] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [deckId, setDeckId] = useState(defaultDeckId);
  const [saving, setSaving] = useState(false);
  useEscapeKey(onCancel);
  return <div className="fixed inset-0 z-30 flex items-end justify-center bg-overlay p-4 sm:items-center"><form className="max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-surface p-5" onSubmit={async (event) => { event.preventDefault(); setSaving(true); try { await onSave({ front, back, notes, audioUrl, imageUrl, deckId }); } finally { setSaving(false); } }}><h2 className="text-lg font-bold">{t("添加自定义闪卡")}</h2><label className="block text-sm"><span className="font-medium">{t("正面（必填）")}</span><textarea required rows={4} value={front} onChange={(event) => setFront(event.target.value)} placeholder={t("输入问题、单词、例句或任意提示") } className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2" /></label><label className="block text-sm"><span className="font-medium">{t("背面（必填）")}</span><textarea required rows={4} value={back} onChange={(event) => setBack(event.target.value)} placeholder={t("输入答案、释义、翻译或解释") } className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2" /></label><label className="block text-sm"><span className="font-medium">{t("备注（可选）")}</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2" /></label><label className="block text-sm">{t("音频 URL（可选）")}<input type="url" value={audioUrl} onChange={(event) => setAudioUrl(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2" /></label><label className="block text-sm">{t("图片 URL（可选）")}<input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2" /></label><label className="block text-sm">{t("所属闪卡库")}<select value={deckId} onChange={(event) => setDeckId(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2">{decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.id === DEFAULT_DECK_ID && deck.name === "默认闪卡库" ? t("默认闪卡库") : deck.name}</option>)}</select></label><div className="flex gap-2"><button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-border py-2">{t("取消")}</button><button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary-text py-2 font-semibold text-text-inverse disabled:opacity-50">{saving ? t("保存中…") : t("保存闪卡")}</button></div></form></div>;
}

function DeckDeleteDialog({ deck, onCancel, onDeleteCards, onMoveCards }: { deck: Deck; onCancel: () => void; onDeleteCards: () => void; onMoveCards: () => void }) {
  const { t } = useI18n();
  return <div className="fixed inset-0 z-30 flex items-center justify-center bg-overlay p-4"><section role="alertdialog" aria-modal="true" className="w-full max-w-md space-y-3 rounded-2xl bg-surface p-5"><h2 className="text-lg font-bold">{t("删除闪卡库")}: {deck.name}</h2><p className="text-sm text-text-muted">{t("选择如何处理此库中的卡片。此操作无法撤销。")}</p><button type="button" onClick={onMoveCards} className="w-full rounded-lg border border-primary-text px-3 py-2 text-sm font-semibold text-primary-text">{t("删除闪卡库并将卡片移入默认库")}</button><button type="button" onClick={onDeleteCards} className="w-full rounded-lg bg-error px-3 py-2 text-sm font-semibold text-text-inverse">{t("删除闪卡库及其中全部卡片")}</button><button type="button" onClick={onCancel} className="w-full rounded-lg border border-border px-3 py-2 text-sm">{t("取消")}</button></section></div>;
}

function EditModal({
  card,
  decks,
  onClose,
  onSave,
  t,
}: {
  card: Flashcard;
  decks: Deck[];
  onClose: () => void;
  onSave: (c: Flashcard) => void;
  t: (message: string) => string;
}) {
  const [form, setForm] = useState(card);

  useEscapeKey(onClose);

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-overlay p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl">
        <h2 className="text-lg font-bold">{t("编辑闪卡")}</h2>
        <div className="mt-4 space-y-3">
          {form.cardType === "custom" ? <>
            <TextAreaField label={t("正面（必填）")} value={form.front ?? ""} onChange={(front) => setForm({ ...form, front })} />
            <TextAreaField label={t("背面（必填）")} value={form.back ?? ""} onChange={(back) => setForm({ ...form, back })} />
            <TextAreaField label={t("备注（可选）")} value={form.notes ?? ""} onChange={(notes) => setForm({ ...form, notes: notes || undefined })} />
            <Field label={t("音频 URL（可选）")} value={form.audioUrl ?? ""} onChange={(audioUrl) => setForm({ ...form, audioUrl: audioUrl || undefined })} />
            <Field label={t("图片 URL（可选）")} value={form.imageUrl ?? ""} onChange={(imageUrl) => setForm({ ...form, imageUrl: imageUrl || undefined })} />
            <label className="block text-sm">{t("所属闪卡库")}<select value={form.deckId} onChange={(event) => setForm({ ...form, deckId: event.target.value })} className="mt-1 w-full rounded-lg border border-border px-3 py-2">{decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.id === DEFAULT_DECK_ID && deck.name === "默认闪卡库" ? t("默认闪卡库") : deck.name}</option>)}</select></label>
          </> : <>
          <Field
            label={t("单词")}
            value={form.word}
            onChange={(word) => setForm({ ...form, word })}
          />
          <Field
            label={t("释义")}
            value={form.meaning}
            onChange={(meaning) => setForm({ ...form, meaning })}
          />
          <Field
            label={t("例句")}
            value={form.example ?? ""}
            onChange={(example) => setForm({ ...form, example: example || undefined })}
          />
          <Field
            label={t("标签（用 | 分隔）")}
            value={form.tags.join("|")}
            onChange={(raw) =>
              setForm({
                ...form,
                tags: raw
                  .split("|")
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
          />
          </>}
        </div>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm"
          >
            {t("取消")}
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            className="flex-1 rounded-xl bg-primary-text py-2.5 text-sm font-semibold text-text-inverse"
          >
            {t("保存")}
          </button>
        </div>
      </div>
    </div>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm"><span className="text-text-muted">{label}</span><textarea rows={4} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2" /></label>;
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border px-3 py-2"
      />
    </label>
  );
}
