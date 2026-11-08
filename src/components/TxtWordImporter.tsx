import { useEffect, useState } from "react";
import { getLanguageLabel, getSupportedDictionaryLanguages } from "../features/dictionary/dictionaryService";
import { getExistingWordKeys, importWordsAsFlashcards, lookupAndUpdateFlashcard, parseWordListDetailed } from "../features/import-export/txt";
import { loadSettings } from "../features/settings/settingsStore";
import { importFlashcardsFromCsv, parseFlashcardsFromCsv } from "../features/import-export/csv";
import { importFlashcardsFromJson, parseFlashcardsFromJson } from "../features/import-export/json";
import type { Flashcard } from "../types/word";
import { DictionaryLookupProgress } from "./DictionaryLookupProgress";
import { useI18n } from "../i18n/I18nProvider";
import { useDecks } from "../features/decks/DeckContext";
import { DEFAULT_DECK_ID } from "../types/deck";
import { DeckIcon } from "./DeckIcon";

const LOOKUP_CONCURRENCY = 2;

interface BatchProgress {
  total: number;
  pending: number;
  querying: number;
  found: number;
  notFound: number;
  failed: number;
}

export function TxtWordImporter({ onImported }: { onImported: () => Promise<void> }) {
  const { t } = useI18n();
  const { decks, activeDeckId, setActiveDeckId } = useDecks();
  const [targetDeckId, setTargetDeckId] = useState(activeDeckId);
  const [language, setLanguage] = useState(() => loadSettings().learningLanguage);
  const [words, setWords] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState(0);
  const [invalidLines, setInvalidLines] = useState<string[]>([]);
  const [existingCount, setExistingCount] = useState(0);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Flashcard[] | null>(null);
  const [structuredFormat, setStructuredFormat] = useState<"csv" | "json" | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);

  useEffect(() => setTargetDeckId(activeDeckId), [activeDeckId]);

  async function handleFile(file?: File) {
    setError("");
    setStatus("");
    setCsvPreview(null);
    setStructuredFormat(null);
    setWords([]);
    setSelectedFile(file ?? null);
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "csv" || extension === "json") {
      try {
        const text = await file.text();
        const cards = extension === "csv" ? parseFlashcardsFromCsv(text) : parseFlashcardsFromJson(text);
        setCsvPreview(cards);
        setStructuredFormat(extension);
        if (!cards.length) setError("文件中没有可导入的闪卡，请检查文件格式。");
      } catch {
        setError(extension === "csv" ? "读取 CSV 失败，请检查文件格式。" : "读取 JSON 失败，请检查文件格式。");
      }
      return;
    }
    if (extension !== "txt") {
      setError("请选择 .csv、.txt 或 .json 文件。");
      return;
    }
    if (!file.name.toLocaleLowerCase().endsWith(".txt") && file.type !== "text/plain") {
      setError("请选择 TXT 文本文件。");
      return;
    }
    try {
      const parsed = parseWordListDetailed(await file.text());
      setWords(parsed.words);
      setDuplicates(parsed.duplicateCount);
      setInvalidLines(parsed.invalidLines);
      const existing = await getExistingWordKeys(language, targetDeckId);
      setExistingCount(parsed.words.filter((word) => existing.has(word.normalize("NFC").toLocaleLowerCase())).length);
      if (parsed.words.length === 0) setError("没有找到有效单词，请检查 TXT 文件内容或编码。");
    } catch {
      setWords([]);
      setError("读取 TXT 文件失败，请尝试使用 UTF-8 编码保存。");
    }
  }

  async function handleImport() {
    if ((!words.length && !csvPreview?.length) || busy) return;
    setBusy(true);
    setError("");
    try {
      if (selectedFile && csvPreview) {
        const text = await selectedFile.text();
        const count = structuredFormat === "json" ? await importFlashcardsFromJson(text, targetDeckId) : await importFlashcardsFromCsv(text, targetDeckId);
        setStatus(t("成功导入 {{count}} 张闪卡到目标库。", { count }));
        setCsvPreview(null);
        setSelectedFile(null);
        await onImported();
        return;
      }
      const result = await importWordsAsFlashcards(words, language, targetDeckId);
      setWords([]);
      setSelectedFile(null);
      setStatus("");
      await onImported();
      const initial: BatchProgress = {
        total: result.cards.length,
        pending: result.cards.length,
        querying: 0,
        found: 0,
        notFound: 0,
        failed: 0,
      };
      setBatchProgress(initial);
      let cursor = 0;
      let found = 0;
      let notFound = 0;
      let failed = 0;
      const worker = async () => {
        while (cursor < result.cards.length) {
          const card = result.cards[cursor++];
          setBatchProgress((current) => current ? {
            ...current,
            pending: Math.max(0, current.pending - 1),
            querying: current.querying + 1,
          } : current);
          let outcome: "found" | "not_found" | "error" = "error";
          try {
            outcome = await lookupAndUpdateFlashcard(card.id);
          } catch {
            outcome = "error";
          } finally {
            if (outcome === "found") found++;
            else if (outcome === "not_found") notFound++;
            else failed++;
            setBatchProgress((current) => current ? {
              ...current,
              querying: Math.max(0, current.querying - 1),
              found,
              notFound,
              failed,
            } : current);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(LOOKUP_CONCURRENCY, result.cards.length) }, worker));
      const remaining = result.cards.length - found - notFound - failed;
      setBatchProgress({ total: result.cards.length, pending: remaining, querying: 0, found, notFound, failed });
      setStatus(t("本次导入报告：新增 {{imported}} 张，跳过已有 {{existing}} 个；成功 {{found}}，查无释义 {{notFound}}，失败 {{failed}}，仍待查询 {{remaining}}。", { imported: result.imported, existing: result.existing, found, notFound, failed, remaining }));
      await onImported();
    } catch {
      setError("保存闪卡失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  async function changeLanguage(next: string) {
    setLanguage(next);
    setStatus("");
    const existing = await getExistingWordKeys(next, targetDeckId);
    setExistingCount(words.filter((word) => existing.has(word.normalize("NFC").toLocaleLowerCase())).length);
  }

  async function changeTargetDeck(next: string) {
    setTargetDeckId(next);
    setActiveDeckId(next);
    const existing = await getExistingWordKeys(language, next);
    setExistingCount(words.filter((word) => existing.has(word.normalize("NFC").toLocaleLowerCase())).length);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">{t("导入 CSV / TXT / JSON")}</h2>
      <p className="mt-1 text-xs text-slate-500">{t("CSV 和 JSON 可还原完整闪卡；TXT 支持每行一个单词、Markdown 单列表格、逗号或分号分隔。TXT 导入后会逐个查询词典并保存释义。")}</p>
      <div className="mt-4"><DictionaryLookupProgress deckId={targetDeckId} /></div>
      <label className="mt-3 block text-sm"><span className="text-slate-500">{t("导入目标闪卡库")}</span><span className="flex items-center gap-2"><DeckIcon name={decks.find((deck) => deck.id === targetDeckId)?.icon ?? "library"} /><select value={targetDeckId} onChange={(event) => void changeTargetDeck(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2">{decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.id === DEFAULT_DECK_ID && deck.name === "默认闪卡库" ? t("默认闪卡库") : deck.name}</option>)}</select></span></label>
      <label className="mt-3 block text-sm">
        <span className="text-slate-600">{t("目标语言")}</span>
        <select value={language} onChange={(event) => void changeLanguage(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2">
          {getSupportedDictionaryLanguages().map((code) => <option key={code} value={code}>{getLanguageLabel(code)} ({code})</option>)}
        </select>
      </label>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-slate-600">{t("选择 .csv、.txt 或 .json 文件")}</span>
        <input type="file" accept=".csv,.txt,.json,text/csv,text/plain,application/json" onChange={(event) => void handleFile(event.target.files?.[0])} className="w-full text-sm" />
      </label>

      {error && <p role="alert" className="mt-3 text-sm text-red-700">{t(error)}</p>}
      {status && <p role="status" className="mt-3 text-sm text-brand-800">{t(status)}</p>}
      {batchProgress && batchProgress.total > 0 && (
        <BatchProgressView progress={batchProgress} />
      )}
      {words.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium">{t("识别到 {{count}} 个不同单词", { count: words.length })}</p>
          <p className="mt-1 text-xs text-slate-500">{t("文件内重复 {{duplicates}} 个 · 词库已有 {{existing}} 个 · 无效行 {{invalid}} 行", { duplicates, existing: existingCount, invalid: invalidLines.length })}</p>
          <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            {words.map((word) => <li key={word}>{word}</li>)}
          </ul>
          {invalidLines.length > 0 && (
            <details className="mt-2 text-xs text-slate-500">
              <summary className="cursor-pointer">{t("查看无效行")}</summary>
              <ul className="mt-1 list-inside list-disc">{invalidLines.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul>
            </details>
          )}
          <button type="button" disabled={busy || words.length <= existingCount} onClick={() => void handleImport()} className="mt-3 w-full rounded-xl bg-brand-700 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? t("正在导入…") : t("确认导入 {{count}} 张新闪卡", { count: words.length - existingCount })}
          </button>
        </div>
      )}
      {csvPreview && csvPreview.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium">{t("预览 {{count}} 张闪卡", { count: csvPreview.length })}</p>
          <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            {csvPreview.slice(0, 30).map((card) => <li key={card.id}>{card.word} <span className="text-slate-500">({card.language}) — {card.meaning}</span></li>)}
          </ul>
          {csvPreview.length > 30 && <p className="mt-1 text-xs text-slate-500">{t("另有 {{count}} 张未显示", { count: csvPreview.length - 30 })}</p>}
          <p className="mt-1 text-xs text-slate-500">{t("将导入到：{{deck}}", { deck: (() => { const target = decks.find((deck) => deck.id === targetDeckId); return target?.id === DEFAULT_DECK_ID && target.name === "默认闪卡库" ? t("默认闪卡库") : target?.name ?? t("默认闪卡库"); })() })} · {t(structuredFormat === "json" ? "JSON 卡片保留完整释义与复习进度。" : "CSV 卡片保留完整释义与复习进度。")}</p>
          <button type="button" disabled={busy} onClick={() => void handleImport()} className="mt-3 w-full rounded-xl bg-brand-700 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? t("正在导入…") : t("确认导入 {{count}} 张闪卡", { count: csvPreview.length })}
          </button>
        </div>
      )}
    </section>
  );
}

function BatchProgressView({ progress }: { progress: BatchProgress }) {
  const { t } = useI18n();
  const completed = progress.found + progress.notFound + progress.failed;
  const percent = Math.round((completed / progress.total) * 100);
  return (
    <div className="mt-4 rounded-xl bg-brand-50 p-3" aria-label={t("本次导入查询进度")}>
      <div className="flex justify-between text-xs font-medium text-brand-900"><span>{t("本次导入查询")}</span><span>{percent}%</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full bg-brand-600 transition-all" style={{ width: `${percent}%` }} /></div>
      <p className="mt-2 text-xs text-brand-900">{t("总数 {{total}} · 待查询 {{pending}} · 查询中 {{querying}} · 成功 {{found}} · 查无释义 {{notFound}} · 失败 {{failed}}", { total: progress.total, pending: progress.pending, querying: progress.querying, found: progress.found, notFound: progress.notFound, failed: progress.failed })}</p>
    </div>
  );
}
