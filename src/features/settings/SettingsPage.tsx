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
import { loadSettings, saveSettings, applyTheme, type AppSettings, type ThemeMode } from "./settingsStore";
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
  const [activeSection, setActiveSection] = useState("general");

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

  function updateTheme(theme: ThemeMode) {
    setSettings(saveSettings({ theme }));
    applyTheme(theme);
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

  const settingsSections: { id: string; label: string }[] = [
    { id: "general", label: t("通用") },
    { id: "account", label: t("账户") },
    { id: "data", label: t("数据") },
    { id: "about", label: t("关于") },
  ];

  function scrollToSection(id: string) {
    setActiveSection(id);
    document.getElementById(`setting-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">{t("设置")}</h1>
        <p className="text-sm text-text-muted">{t("本地数据与词典偏好")}</p>
      </header>

      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        {/* 桌面端：左侧分类导航；移动端隐藏，内容单列堆叠 */}
        <nav aria-label={t("设置分类")} className="hidden lg:sticky lg:top-8 lg:block">
          <ul className="space-y-1">
            {settingsSections.map((section) => (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  aria-current={activeSection === section.id ? "true" : undefined}
                  className={[
                    "min-h-[44px] w-full whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
                    activeSection === section.id
                      ? "bg-primary text-primary-text"
                      : "text-text-muted hover:bg-surface-hover hover:text-text",
                  ].join(" ")}
                >
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-8">
      <div id="setting-general" className="scroll-mt-8 space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text">{t("界面语言")}</h2>
        <select
          aria-label={t("界面语言")}
          value={interfaceLanguage}
          onChange={(event) => setInterfaceLanguage(event.target.value as "zh-CN" | "en")}
          className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="zh-CN">中文</option>
          <option value="en">English</option>
        </select>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text">{t("外观主题")}</h2>
        <select
          aria-label={t("外观主题")}
          value={settings.theme}
          onChange={(event) => updateTheme(event.target.value as ThemeMode)}
          className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="light">{t("浅色")}</option>
          <option value="dark">{t("深色")}</option>
        </select>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text">{t("学习语言")}</h2>
        <p className="mt-1 text-xs text-text-muted">
          {t("在线查词支持：")}{supported.map((c) => `${getLanguageLabel(c)} (${c})`).join(t("、"))}
        </p>
        <select
          value={settings.learningLanguage}
          onChange={(e) => updateLanguage(e.target.value)}
          className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        >
          {supported.map((code) => (
            <option key={code} value={code}>
              {getLanguageLabel(code)} ({code})
            </option>
          ))}
        </select>
      </section>
      </div>

      <div id="setting-account" className="scroll-mt-8">
        <AuthPanel />
      </div>

      <div id="setting-data" className="scroll-mt-8 space-y-6">
      <section className="rounded-2xl border border-error/40 bg-surface p-4">
        <h2 className="text-sm font-semibold text-error">{t("数据管理")}</h2>
        <p className="mt-1 text-xs text-text-muted">{t("删除本地保存的所有闪卡，此操作无法撤销。")}</p>
        <button
          type="button"
          onClick={() => void handleDeleteAllFlashcards()}
          disabled={cardCountLoading || cardCount === 0}
          className="mt-3 rounded-xl border border-error/50 px-4 py-2 text-sm font-semibold text-error hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("删除全部闪卡")}
        </button>
        {deleteStatus && <p className="mt-2 text-sm text-text-muted" role="status">{t(deleteStatus)}</p>}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text">{t("本地存储")}</h2>
        <p className="mt-2 text-sm text-text-muted">
          {t("已保存闪卡：")}<strong>{cardCountLoading ? t("读取中…") : cardCount}</strong>{t("张（IndexedDB）")}
        </p>
        {cardCountError && <p role="alert" className="mt-2 text-sm text-error">{t(cardCountError)} <button type="button" onClick={() => void refreshCardCount()} className="underline">{t("重试")}</button></p>}
        <p className="mt-2 text-xs text-text-muted">
          {t("断网后仍可复习已保存卡片。浏览器清除站点数据会删除本地闪卡，请定期导出备份。")}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <h2 className="text-sm font-semibold text-text">{t("导入 / 导出")}</h2>
        <p className="text-xs text-text-muted">{t("导出范围：{{deck}}", { deck: activeDeck.id === "default" ? t("默认闪卡库") : activeDeck.name })}</p>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting}
          className="w-full rounded-xl bg-primary-text py-2.5 text-sm font-semibold text-text-inverse"
        >
          {exporting ? t("正在导出…") : t("导出 CSV")}
        </button>
        <button type="button" onClick={() => void handleJsonExport()} disabled={exporting} className="w-full rounded-xl border border-primary-text py-2.5 text-sm font-semibold text-primary-text">{exporting ? t("正在导出…") : t("导出 JSON")}</button>
        {exportError && <p role="alert" className="text-sm text-error">{t(exportError)}</p>}
        <TxtWordImporter onImported={refreshCardCount} />
      </section>
      </div>

      <div id="setting-about" className="scroll-mt-8 space-y-6">
      <section className="rounded-2xl border border-dashed border-border p-4 text-xs text-text-muted">
        <h2 className="font-semibold text-text">{t("后续计划")}</h2>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>{t("Supabase 账户与云端同步")}</li>
          <li>{t("可下载的多语言离线词库")}</li>
        </ul>
      </section>

      <section className="text-xs text-text-muted/70 space-y-2">
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
        </div>
      </div>
    </div>
  );
}
