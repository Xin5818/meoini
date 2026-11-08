import { useCallback, useEffect, useState } from "react";
import { db } from "../../db/database";
import {
  getLanguageLabel,
  getSupportedDictionaryLanguages,
} from "../dictionary/dictionaryService";
import {
  downloadTextFile,
  exportFlashcardsToCsv,
} from "../import-export/csv";
import { exportFlashcardsToJson } from "../import-export/json";
import { TxtWordImporter } from "../../components/TxtWordImporter";
import { AuthPanel } from "../auth/AuthPanel";
import { loadSettings, saveSettings, type AppSettings } from "./settingsStore";
import { withTimeout } from "../../utils/withTimeout";
import { useI18n } from "../../i18n/I18nProvider";
import { useDecks } from "../decks/DeckContext";

export function SettingsPage() {
  const { language: interfaceLanguage, setLanguage: setInterfaceLanguage, t } = useI18n();
  const { activeDeck } = useDecks();
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [cardCount, setCardCount] = useState(0);
  const [cardCountLoading, setCardCountLoading] = useState(true);
  const [cardCountError, setCardCountError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  const refreshCardCount = useCallback(async () => {
    setCardCountLoading(true);
    setCardCountError("");
    try {
      setCardCount(await withTimeout(db.flashcards.count(), 8_000, "CARD_COUNT_TIMEOUT"));
    } catch (error) {
          setCardCountError(error instanceof Error && error.message === "CARD_COUNT_TIMEOUT" ? "读取闪卡数量超时。" : "读取闪卡数量失败。");
    } finally {
      setCardCountLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCardCount();
  }, [refreshCardCount]);

  function updateLanguage(learningLanguage: string) {
    setSettings(saveSettings({ learningLanguage }));
  }

  async function handleExport() {
    setExporting(true);
    setExportError("");
    try {
      const csv = await withTimeout(exportFlashcardsToCsv(activeDeck.id), 15_000, "EXPORT_TIMEOUT");
      const date = new Date().toISOString().slice(0, 10);
      downloadTextFile(`meoini-flashcards-${date}.csv`, csv, "text/csv;charset=utf-8");
    } catch (error) {
      setExportError(error instanceof Error && error.message === "EXPORT_TIMEOUT" ? "导出超时，请重试。" : "导出失败，请重试。");
    } finally {
      setExporting(false);
    }
  }

  async function handleJsonExport() {
    setExporting(true);
    setExportError("");
    try {
      const json = await withTimeout(exportFlashcardsToJson(activeDeck.id), 15_000, "EXPORT_TIMEOUT");
      const date = new Date().toISOString().slice(0, 10);
      downloadTextFile(`meoini-${activeDeck.id}-${date}.json`, json, "application/json;charset=utf-8");
    } catch (error) {
      setExportError(error instanceof Error && error.message === "EXPORT_TIMEOUT" ? "导出超时，请重试。" : "导出失败，请重试。");
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAllFlashcards() {
    if (!window.confirm(t("确定删除本地保存的全部闪卡吗？此操作无法撤销。"))) return;
    setDeleteStatus(null);
    try {
      await withTimeout(db.flashcards.clear(), 10_000, "DELETE_TIMEOUT");
      setCardCount(0);
      setCardCountError("");
      setDeleteStatus("已删除全部本地闪卡。");
    } catch {
      setDeleteStatus("删除失败或操作超时，请重试。");
    }
  }

  const supported = getSupportedDictionaryLanguages();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">{t("设置")}</h1>
        <p className="text-sm text-slate-500">{t("本地数据与词典偏好")}</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">{t("界面语言")}</h2>
        <select
          aria-label={t("界面语言")}
          value={interfaceLanguage}
          onChange={(event) => setInterfaceLanguage(event.target.value as "zh-CN" | "en")}
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="zh-CN">中文</option>
          <option value="en">English</option>
        </select>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">{t("学习语言")}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {t("在线查词支持：")}{supported.map((c) => `${getLanguageLabel(c)} (${c})`).join(t("、"))}
        </p>
        <select
          value={settings.learningLanguage}
          onChange={(e) => updateLanguage(e.target.value)}
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {supported.map((code) => (
            <option key={code} value={code}>
              {getLanguageLabel(code)} ({code})
            </option>
          ))}
        </select>
      </section>

      <AuthPanel />

      <section className="rounded-2xl border border-red-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-red-800">{t("数据管理")}</h2>
        <p className="mt-1 text-xs text-slate-600">{t("删除本地保存的所有闪卡，此操作无法撤销。")}</p>
        <button
          type="button"
          onClick={() => void handleDeleteAllFlashcards()}
          disabled={cardCountLoading || cardCount === 0}
          className="mt-3 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("删除全部闪卡")}
        </button>
        {deleteStatus && <p className="mt-2 text-sm text-slate-600" role="status">{t(deleteStatus)}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">{t("本地存储")}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {t("已保存闪卡：")}<strong>{cardCountLoading ? t("读取中…") : cardCount}</strong>{t("张（IndexedDB）")}
        </p>
        {cardCountError && <p role="alert" className="mt-2 text-sm text-red-700">{t(cardCountError)} <button type="button" onClick={() => void refreshCardCount()} className="underline">{t("重试")}</button></p>}
        <p className="mt-2 text-xs text-slate-500">
          {t("断网后仍可复习已保存卡片。浏览器清除站点数据会删除本地闪卡，请定期导出备份。")}
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">{t("导入 / 导出")}</h2>
        <p className="text-xs text-slate-500">{t("导出范围：{{deck}}", { deck: activeDeck.id === "default" ? t("默认闪卡库") : activeDeck.name })}</p>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting}
          className="w-full rounded-xl bg-brand-700 py-2.5 text-sm font-semibold text-white"
        >
          {exporting ? t("正在导出…") : t("导出 CSV")}
        </button>
        <button type="button" onClick={() => void handleJsonExport()} disabled={exporting} className="w-full rounded-xl border border-brand-700 py-2.5 text-sm font-semibold text-brand-800">{exporting ? t("正在导出…") : t("导出 JSON")}</button>
        {exportError && <p role="alert" className="text-sm text-red-700">{t(exportError)}</p>}
        <TxtWordImporter onImported={refreshCardCount} />
      </section>

      <section className="rounded-2xl border border-dashed border-slate-200 p-4 text-xs text-slate-500">
        <h2 className="font-semibold text-slate-700">{t("后续计划")}</h2>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>{t("Supabase 账户与云端同步")}</li>
          <li>{t("可下载的多语言离线词库")}</li>
        </ul>
      </section>

      <section className="text-xs text-slate-400 space-y-2">
        <p>
          {t("英语：")}{" "}
          <a
            href="https://dictionaryapi.dev/"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            Free Dictionary API
          </a>
        </p>
        <p>
          {t("芬兰语及联想：")}{" "}
          <a
            href="https://www.wiktionary.org/"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            Wiktionary
          </a>
          {t("Wiktionary（CC BY-SA）")}
        </p>
      </section>
    </div>
  );
}
