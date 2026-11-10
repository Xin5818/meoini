import { useState } from "react";
import type { DictionaryEntry } from "../types/word";
import { PronunciationPanel } from "./PronunciationPanel";
import { useI18n } from "../i18n/I18nProvider";

interface WordCardProps {
  entry: DictionaryEntry;
  onSaveEntry: () => void;
  saving?: boolean;
  saved?: boolean;
}

export function WordCard({ entry, onSaveEntry, saving = false, saved = false }: WordCardProps) {
  const { t } = useI18n();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const languageName = entry.language === "fi" ? t("芬兰语") : entry.language;
  const partOfSpeech = [...new Set([
    ...entry.meanings.map((m) => m.partOfSpeech),
    ...(entry.forms ?? []).map((form) => form.partOfSpeech),
  ].filter(Boolean))];

  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <header className="mb-4 border-b border-border/60 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 className="break-words text-2xl font-bold text-text">{entry.word}</h2>
              <button
                type="button"
                onClick={() => setDetailsOpen((open) => !open)}
                aria-expanded={detailsOpen}
                className="text-xs text-primary-text"
              >
                {detailsOpen ? t("收起详情") : t("查看词形与例句")}
              </button>
            </div>
            <span className="text-sm text-text-muted">
              {languageName}{partOfSpeech.length ? ` · ${partOfSpeech.map((value) => localizePartOfSpeech(value, t)).join(t("、"))}` : ""}
            </span>
          </div>
          <PronunciationPanel
            word={entry.word}
            language={entry.language}
            ipa={entry.pronunciation}
            ipaSource={entry.pronunciationSource}
            audioUrl={entry.pronunciationAudioUrl}
            pronunciations={entry.pronunciations}
          />
        </div>
        {entry.source && (
          <p className="mt-1 text-xs text-text-muted/70">
            {t("来源：")}{" "}
            {entry.sourceUrl ? (
              <a
                href={entry.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {entry.source}
              </a>
            ) : (
              entry.source
            )}
          </p>
        )}
      </header>

      {entry.forms?.length ? (
        <section className="mb-4 rounded-xl bg-surface-hover p-3">
          <h3 className="text-sm font-semibold text-text">{t("词形信息")}</h3>
          <ul className="mt-2 space-y-2 text-sm text-text-muted">
            {entry.forms.map((form, index) => (
              <li key={`${form.lemma}-${form.grammaticalForm}-${index}`}>
                <span className="font-medium">{form.grammaticalForm}</span>
                {form.grammaticalNumber && <span> · {t(form.grammaticalNumber === "singular" ? "单数" : "复数")}</span>}
                <span> · {form.lemma}{t("的词形")}</span>
                {form.gloss && <span>：{form.gloss}</span>}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {entry.meanings.length ? <ul className="space-y-4">
        <li>
          <p className="mb-2 text-xs font-medium text-text-muted">
            {entry.meanings.some((meaning) => meaning.definitionLanguage === "en") ? t("英文释义") : t("释义")}
          </p>
          <ol className="list-decimal space-y-3 pl-5">
            {entry.meanings.map((meaning, index) => (
              <li key={index}>
              <p className="break-words text-text">{meaning.text}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <EvidenceTag label={t("语体：{{value}}", { value: meaning.register ? localizeRegister(meaning.register, t) : t("未知") })} />
                {meaning.usageFrequency && <EvidenceTag label={t("频率：{{value}}", { value: localizeFrequency(meaning.usageFrequency, t) })} />}
                {meaning.grammaticalForm && <EvidenceTag label={t("语法形式：{{value}}", { value: meaning.grammaticalForm })} />}
              </div>
              </li>
            ))}
          </ol>
        </li>
      </ul> : <p className="text-sm text-text-muted">{t("该条目提供词形信息，暂无独立释义。")}</p>}

      <button
        type="button"
        onClick={onSaveEntry}
        disabled={saving || saved}
        className="mt-4 rounded-xl border border-primary-text px-4 py-2 text-sm font-semibold text-primary-text hover:bg-primary disabled:cursor-default disabled:opacity-70"
      >
        {saving ? t("正在加入…") : saved ? t("已加入闪卡") : t("＋ 加入闪卡")}
      </button>

      {detailsOpen && (
        <section className="mt-5 border-t border-border/60 pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t("词形、例句与用法")}
          </h3>
          {entry.meanings.some((meaning) => meaning.grammaticalForm) && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {entry.meanings.filter((meaning) => meaning.grammaticalForm).map((meaning, index) => (
              <EvidenceTag key={`${meaning.grammaticalForm}-${index}`} label={t("语法形式：{{value}}", { value: meaning.grammaticalForm! })} />
              ))}
            </div>
          )}
          <h4 className="mb-1 text-sm font-semibold text-text">{t("例句")}</h4>
          {entry.examples?.some((example) => example.kind === "sentence") ? (
            <ul className="space-y-3 text-sm">
              {entry.examples.filter((example) => example.kind === "sentence").slice(0, 5).map((ex, i) => (
                <li key={`sentence-${i}`}>
                  <p className="break-words italic text-text">&ldquo;{ex.text}&rdquo;</p>
                  {ex.translation && <p className="mt-1 text-text-muted">{t("英文翻译：{{text}}", { text: ex.translation })}</p>}
                  {ex.formOf && (
                    <p className="mt-1 text-xs text-text-muted">
                      {t("词形关系：{{form}} 是 {{word}} 的 {{grammar}}", { form: ex.formOf, word: entry.word, grammar: ex.grammaticalForm ?? t("词形变化") })}
                      {ex.formSourceUrl && <a href={ex.formSourceUrl} target="_blank" rel="noreferrer" className="ml-1 text-primary-text underline">{t("词典来源")}</a>}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-text-muted">{t("暂无例句")}</p>}
          {entry.examples?.some((example) => example.kind === "collocation") && (
            <div className="mt-4">
              <h4 className="mb-1 text-sm font-semibold text-text">{t("相关搭配")}</h4>
              <ul className="space-y-3 text-sm">
                {entry.examples.filter((example) => example.kind === "collocation").slice(0, 8).map((ex, i) => (
                  <li key={`collocation-${i}`}>
                    <p className="break-words text-text">{ex.text}</p>
                    {ex.translation && <p className="mt-1 text-text-muted">{t("英文翻译：{{text}}", { text: ex.translation })}</p>}
                    {ex.formOf && (
                      <p className="mt-1 text-xs text-text-muted">
                        {t("词形关系：{{form}} 是 {{word}} 的 {{grammar}}", { form: ex.formOf, word: entry.word, grammar: ex.grammaticalForm ?? t("词形变化") })}
                        {ex.formSourceUrl && <a href={ex.formSourceUrl} target="_blank" rel="noreferrer" className="ml-1 text-primary-text underline">{t("词典来源")}</a>}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </article>
  );
}

function localizeRegister(value: string, t: (message: string) => string): string {
  const key = value.trim().toLocaleLowerCase().replace(/[\s_-]+/g, " ");
  const labels: Record<string, string> = {
    formal: t("Formal · 正式"),
    neutral: t("Neutral · 中性"),
    casual: t("Casual · 非正式"),
    informal: t("Informal · 非正式"),
    "casual / informal": t("Casual / Informal · 非正式"),
    slang: t("Slang · 俚语"),
    regional: t("Regional · 地区性"),
    literary: t("Literary · 文学/书面"),
    rare: t("Rare · 罕见"),
    archaic: t("Archaic · 古旧"),
    "rare / archaic": t("Rare / Archaic · 罕见/古旧"),
  };
  return labels[key] ?? value;
}

function localizeFrequency(value: string, t: (message: string) => string): string {
  const key = value.trim().toLocaleLowerCase();
  const labels: Record<string, string> = {
    everyday: t("日常"),
    common: t("常用"),
    frequent: t("高频"),
    uncommon: t("不常见"),
    rare: t("罕见"),
  };
  return labels[key] ?? value;
}

function EvidenceTag({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-surface-hover px-2.5 py-1 text-xs text-text-muted">
      {label}
    </span>
  );
}

function localizePartOfSpeech(value: string | undefined, t: (message: string) => string): string {
  if (!value) return "";
  const labels: Record<string, string> = {
    Adjective: t("形容词"),
    Adverb: t("副词"),
    Noun: t("名词"),
    Verb: t("动词"),
    Pronoun: t("代词"),
    Preposition: t("介词"),
    Conjunction: t("连词"),
    Interjection: t("感叹词"),
  };
  return labels[value] ?? value;
}
