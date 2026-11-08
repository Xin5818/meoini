import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getDueFlashcards, getFlashcardsByDeck, saveFlashcard } from "../../db/database";
import type { Flashcard, ReviewRating } from "../../types/word";
import { applyReview, getFlashcardBack, getFlashcardFront } from "./review";
import { PronunciationPanel } from "../../components/PronunciationPanel";
import { getVisibleReviewItems } from "./reviewDisplay";
import { applyEarlyPractice, getEarlyReviewCards, getEarlyReviewDiagnostics, getReviewPlanStats, limitEarlyReviewCards, type EarlyReviewDiagnostic, type ReviewPlanStats } from "./reviewPlan";
import { withTimeout } from "../../utils/withTimeout";
import { useI18n } from "../../i18n/I18nProvider";
import { useDecks } from "../decks/DeckContext";

type ReviewMode = "scheduled" | "early";
type EarlyLimit = 5 | 10 | 20 | "all";

export function ReviewPage() {
  const { t } = useI18n();
  const { activeDeckId, activeDeck } = useDecks();
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [current, setCurrent] = useState<Flashcard | null>(null);
  const [revealed, setRevealed] = useState(false);
  // This flag is only for starting a review session. Initial plan loading has
  // its own state (`planLoading`); starting it as true disabled both entry buttons.
  const [loading, setLoading] = useState(false);
  const [showAllMeanings, setShowAllMeanings] = useState(false);
  const [showAllExamples, setShowAllExamples] = useState(false);
  const [showAllCollocations, setShowAllCollocations] = useState(false);
  const [planStats, setPlanStats] = useState<ReviewPlanStats>({ dueToday: 0, completedToday: 0, notDue: 0, newCards: 0, earlyAvailable: 0 });
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState("");
  const [sessionMode, setSessionMode] = useState<ReviewMode | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [earlyDiagnostics, setEarlyDiagnostics] = useState<EarlyReviewDiagnostic[]>([]);
  const [showEarlyOptions, setShowEarlyOptions] = useState(false);
  const [sessionMessage, setSessionMessage] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const planRefreshInFlight = useRef(false);

  const refreshPlan = useCallback(async () => {
    if (planRefreshInFlight.current) return;
    planRefreshInFlight.current = true;
    setPlanLoading(true);
    try {
      const cards = await withTimeout(getFlashcardsByDeck(activeDeckId), 10_000, "REVIEW_PLAN_TIMEOUT");
      setPlanStats(getReviewPlanStats(cards));
      setEarlyDiagnostics(getEarlyReviewDiagnostics(cards));
      setPlanError("");
    } catch (error) {
      setPlanError(error instanceof Error && error.message === "REVIEW_PLAN_TIMEOUT" ? "读取复习计划超时。" : "读取复习计划失败，请重试。");
    } finally {
      setPlanLoading(false);
      planRefreshInFlight.current = false;
    }
  }, [activeDeckId]);

  function collapseReviewContent() {
    setShowAllMeanings(false);
    setShowAllExamples(false);
    setShowAllCollocations(false);
  }

  useEffect(() => {
    void refreshPlan();
    const timer = window.setInterval(() => void refreshPlan(), 5_000);
    const onFocus = () => void refreshPlan();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshPlan]);

  async function startScheduledReview() {
    setLoading(true);
    setSessionMessage("");
    try {
      const due = await withTimeout(getDueFlashcards(Date.now(), activeDeckId), 10_000, "REVIEW_LOAD_TIMEOUT");
      if (due.length) beginSession(due, "scheduled", crypto.randomUUID());
      else setSessionMessage("今天没有待复习的单词。");
    } catch (error) {
      setPlanError(error instanceof Error && error.message === "REVIEW_LOAD_TIMEOUT" ? "加载今日待复习单词超时，请重试。" : "加载今日待复习单词失败，请重试。");
    } finally {
      setLoading(false);
    }
  }

  async function startEarlyReview(limit: EarlyLimit) {
    setLoading(true);
    setSessionMessage("");
    try {
      const cards = await withTimeout(getFlashcardsByDeck(activeDeckId), 10_000, "REVIEW_LOAD_TIMEOUT");
      setPlanStats(getReviewPlanStats(cards));
      const diagnostics = getEarlyReviewDiagnostics(cards);
      setEarlyDiagnostics(diagnostics);
      const candidates = getEarlyReviewCards(cards);
      const selected = limitEarlyReviewCards(candidates, limit);
      const nextSessionId = crypto.randomUUID();
      const candidateIds = new Set(candidates.map((card) => card.id));
      const selectedIds = new Set(selected.map((card) => card.id));
      console.info("[Meoini early review selection]", {
        sessionId: nextSessionId,
        totalCards: cards.length,
        candidateCount: candidates.length,
        selectedCount: selected.length,
        limit,
        cards: diagnostics.map((item) => ({
          ...item,
          dueAtLocal: new Date(item.dueAt).toLocaleString(),
          lastReviewedAtLocal: item.lastReviewedAt === undefined ? undefined : new Date(item.lastReviewedAt).toLocaleString(),
          reason: !item.eligible
            ? item.reason
            : selectedIds.has(item.id)
              ? item.reason
              : candidateIds.has(item.id)
              ? `候选但未选中：本轮数量限制为 ${limit}`
                : item.reason,
        })),
      });
      if (!selected.length) {
        setSessionMessage("目前没有可提前练习的单词。");
        return;
      }
      beginSession(selected, "early", nextSessionId);
      setShowEarlyOptions(false);
    } catch (error) {
      setPlanError(error instanceof Error && error.message === "REVIEW_LOAD_TIMEOUT" ? "加载提前复习单词超时，请重试。" : "加载提前复习单词失败，请重试。");
    } finally {
      setLoading(false);
    }
  }

  function beginSession(cards: Flashcard[], mode: ReviewMode, nextSessionId: string) {
    setQueue(cards);
    setCurrent(cards[0] ?? null);
    setSessionMode(mode);
    setSessionId(nextSessionId);
    setShowEarlyOptions(false);
    setSessionMessage("");
    setRevealed(false);
    collapseReviewContent();
  }

  async function returnToPlan() {
    setSessionMode(null);
    setSessionId(null);
    setQueue([]);
    setCurrent(null);
    setRevealed(false);
    setSessionMessage("");
    await refreshPlan();
  }

  async function rate(rating: ReviewRating) {
    if (!current || savingReview) return;
    const updated = sessionMode === "early" ? applyEarlyPractice(current) : applyReview(current, rating);
    setSavingReview(true);
    setReviewError("");
    try {
      await withTimeout(saveFlashcard(updated), 10_000, "REVIEW_SAVE_TIMEOUT");
      const rest = queue.filter((c) => c.id !== current.id);
      setQueue(rest);
      setCurrent(rest[0] ?? null);
      setRevealed(false);
      collapseReviewContent();
      await refreshPlan();
    } catch (error) {
      setReviewError(error instanceof Error && error.message === "REVIEW_SAVE_TIMEOUT" ? "保存复习结果超时，当前卡片保留，可重试评分。" : "保存复习结果失败，当前卡片保留，可重试评分。");
    } finally {
      setSavingReview(false);
    }
  }

  if (planLoading && planStats.dueToday === 0 && planStats.notDue === 0 && planStats.newCards === 0) return <div><p role="status" className="text-slate-500">{t("加载复习计划…")}</p>{planError && <p role="alert" className="mt-2 text-sm text-red-700">{t(planError)} <button type="button" onClick={() => void refreshPlan()} className="underline">{t("重试")}</button></p>}</div>;

  const dictionaryEntry = current?.dictionaryEntry;
  const meanings: { text: string; grammaticalForm?: string }[] = dictionaryEntry?.meanings.length
    ? dictionaryEntry.meanings
    : current?.meaning ? current.meaning.split("；").filter(Boolean).map((text) => ({ text })) : [];
  const dictionarySentences = dictionaryEntry?.examples?.filter((example) => example.kind === "sentence") ?? [];
  const sentences = dictionarySentences.length ? dictionarySentences : current?.example ? [{ text: current.example, kind: "sentence" as const }] : [];
  const collocations = dictionaryEntry?.examples?.filter((example) => example.kind === "collocation") ?? [];
  const visibleMeanings = getVisibleReviewItems(meanings, 3, showAllMeanings);
  const visibleSentences = getVisibleReviewItems(sentences, 2, showAllExamples);
  const visibleCollocations = getVisibleReviewItems(collocations, 3, showAllCollocations);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{sessionMode ? t("复习中") : t("复习计划")}</h1>
        {sessionMode && <button type="button" onClick={() => void returnToPlan()} className="text-sm font-medium text-brand-700 underline">{t("返回计划")}</button>}
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-label={t("复习计划概览")}>
        <h2 className="text-sm font-semibold text-slate-800">{t("复习统计")}</h2>
        <p className="mt-1 text-xs text-slate-500">{activeDeck.icon} {activeDeck.id === "default" && activeDeck.name === "默认闪卡库" ? t("默认闪卡库") : activeDeck.name} · {t("本库复习范围")}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <PlanStat label={t("今日待复习")} value={planStats.dueToday} />
          <PlanStat label={t("今日已完成")} value={planStats.completedToday} />
          <PlanStat label={t("未到期单词")} value={planStats.notDue} />
          <PlanStat label={t("待首次复习")} value={planStats.newCards} />
        </dl>
        {!sessionMode && !planLoading && (
          <details className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <summary className="cursor-pointer font-medium">
              {t("提前复习筛选诊断：候选 {{candidate}} / {{total}} 张", { candidate: earlyDiagnostics.filter((item) => item.eligible).length, total: earlyDiagnostics.length })}
            </summary>
            {earlyDiagnostics.length ? (
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                {earlyDiagnostics.map((item) => (
                  <li key={item.id} className="border-t border-slate-200 pt-2">
                    <span className="font-medium text-slate-800">{item.word}</span> — {t(item.reason)}
                    <span className="block text-[11px] text-slate-500">
                      dueAt {new Date(item.dueAt).toLocaleString()} · repetitions {item.repetitions} · lastReviewMode {item.lastReviewMode ?? t("无")} · lastReviewedAt {item.lastReviewedAt === undefined ? t("无") : new Date(item.lastReviewedAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2">{t("IndexedDB 中没有闪卡。")}</p>}
          </details>
        )}

        {!sessionMode && (
          <div className="mt-4 space-y-3">
            <button
              type="button"
              disabled={loading || planStats.dueToday === 0}
              onClick={() => void startScheduledReview()}
              className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? t("正在加载…") : t("开始今日复习（{{count}}）", { count: planStats.dueToday })}
            </button>
            <div>
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowEarlyOptions((open) => !open)}
                className="w-full rounded-xl border border-brand-700 px-4 py-3 text-sm font-semibold text-brand-800 disabled:opacity-50"
              >
                {showEarlyOptions ? t("收起提前复习") : t("提前复习（可选 {{count}} 个）", { count: planStats.earlyAvailable })}
              </button>
              {showEarlyOptions && (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([5, 10, 20, "all"] as const).map((limit) => (
                    <button
                      key={limit}
                      type="button"
                      disabled={loading || planStats.earlyAvailable === 0}
                      onClick={() => void startEarlyReview(limit)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {limit === "all" ? t("全部（{{count}}）", { count: planStats.earlyAvailable }) : t("{{count}} 个", { count: limit })}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-slate-500">{t("自由练习优先选择未复习的新单词，再选择未到期卡片；不会改变原定复习计划。")}</p>
            </div>
          </div>
        )}
      </section>

      {planError && <p role="alert" className="text-sm text-red-700">{t(planError)} <button type="button" onClick={() => void refreshPlan()} className="font-medium underline">{t("重试读取复习计划")}</button></p>}
      {reviewError && <p role="alert" className="text-sm text-red-700">{t(reviewError)}</p>}
      {sessionMessage && !sessionMode && <p role="status" className="text-sm text-slate-600">{t(sessionMessage)}</p>}
      {!sessionMode && planStats.dueToday === 0 && (
        <div className="rounded-xl bg-slate-50 p-4 text-center">
          <p className="font-medium text-slate-800">{t("今天没有待复习的单词")}</p>
          <Link to="/" className="mt-2 inline-block text-sm text-brand-700 underline">{t("去查词添加单词")}</Link>
        </div>
      )}

      {sessionId && sessionMode && !current && (
        <section key={sessionId} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center" role="status">
          <h2 className="font-semibold text-emerald-900">{sessionMode === "early" ? t("提前练习完成") : t("今日复习完成")}</h2>
          <p className="mt-1 text-sm text-emerald-800">{t("复习统计已更新。")}</p>
          <button type="button" onClick={() => void returnToPlan()} className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-emerald-900">{t("返回复习计划")}</button>
        </section>
      )}
      {sessionMode && !current && sessionMessage && <p role="status" className="text-sm text-slate-600">{t(sessionMessage)}</p>}

      {sessionMode && current && (
        <>
          <div className={`rounded-lg px-3 py-2 text-sm ${sessionMode === "early" ? "bg-sky-50 text-sky-900" : "bg-amber-50 text-amber-900"}`}>
            {sessionMode === "early" ? t("提前复习 · 自由练习，不调整间隔计划") : t("今日到期复习 · 评分将更新间隔计划")} · {t("剩余 {{count}} 张", { count: queue.length })}
          </div>

      <div
        className="min-h-[280px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        onClick={() => !revealed && setRevealed(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) setRevealed(true);
        }}
      >
        {current.cardType !== "custom" && <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{current.language}</p>}
        <div className="mt-2">
          <p className="whitespace-pre-wrap text-2xl font-bold leading-relaxed text-slate-900">{getFlashcardFront(current)}</p>
        </div>

        {revealed && current.language === "fi" && (
          <div className="mt-3" onClick={(event) => event.stopPropagation()}>
            <PronunciationPanel
              word={current.word}
              language={current.language}
              ipa={current.dictionaryEntry?.pronunciation}
              ipaSource={current.dictionaryEntry?.pronunciationSource}
              audioUrl={current.dictionaryEntry?.pronunciationAudioUrl}
              pronunciations={current.dictionaryEntry?.pronunciations}
              autoPlayOnMount
            />
          </div>
        )}

        {!revealed ? (
          <p className="mt-8 text-center text-sm text-slate-400">
            {t(current.cardType === "custom" ? "点击显示背面" : "点击显示释义")}
          </p>
        ) : (
          <div className="mt-6 max-h-[55vh] space-y-3 overflow-y-auto overscroll-contain border-t border-slate-100 pt-4 pr-1">
            {current.cardType === "custom" ? <section className="space-y-3" onClick={(event) => event.stopPropagation()}>
              <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-900">{getFlashcardBack(current)}</p>
              {current.notes && <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("备注")}</h3><p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{current.notes}</p></div>}
              {current.audioUrl && <audio controls preload="none" src={current.audioUrl} className="w-full">{t("浏览器不支持音频播放")}</audio>}
              {current.imageUrl && <img src={current.imageUrl} alt={t("闪卡图片")} className="max-h-72 max-w-full rounded-lg object-contain" />}
            </section> : <>
            {current.partOfSpeech && <p className="text-xs text-slate-500">{current.partOfSpeech}</p>}
            {meanings.length ? (
              <section aria-label={t("英文释义")}>
                <h3 className="text-sm font-semibold text-slate-800">{t("英文释义")}</h3>
                <ol className="mt-1 list-decimal space-y-2 pl-5 text-sm text-slate-900 dark:text-slate-950">
                  {visibleMeanings.map((meaning, index) => (
                    <li key={`review-meaning-${index}`}>
                      <span>{meaning.text}</span>
                      {meaning.grammaticalForm && <span className="ml-1 text-xs text-slate-500">（{t(meaning.grammaticalForm)}）</span>}
                    </li>
                  ))}
                </ol>
                {meanings.length > 3 && (
                  <ExpandButton
                    expanded={showAllMeanings}
                    expandLabel={t("展开全部释义")}
                    collapseLabel={t("收起释义")}
                    onClick={() => setShowAllMeanings((value) => !value)}
                  />
                )}
              </section>
            ) : (
              <p className="text-sm text-slate-500">
                {t(current.dictionaryEntry?.forms?.length ? "词形条目（见下方词形信息）" : current.lookupStatus === "not_found" ? "暂未找到释义" : current.lookupStatus === "error" ? "查询暂时失败，可稍后在词库重试" : current.lookupStatus === "querying" ? "释义查询中…" : current.lookupStatus === "pending" ? "待查询" : "待补充释义")}
              </p>
            )}
            {dictionaryEntry ? (
              <section className="space-y-3 border-t border-slate-100 pt-3">
                {dictionaryEntry.forms?.length ? (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{t("词形信息")}</h3>
                    <ul className="mt-1 space-y-1 text-sm text-slate-700">
                      {dictionaryEntry.forms.map((form, index) => (
                        <li key={`review-form-${index}`}>
                          {t(form.grammaticalForm)}{form.grammaticalNumber ? ` · ${form.grammaticalNumber === "singular" ? t("单数") : t("复数")}` : ""} · {form.lemma} {t("的词形")}{form.gloss ? `：${form.gloss}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div>
                    <h3 className="text-sm font-semibold text-slate-800">{t("例句")}</h3>
                  {sentences.length ? (
                    <ul className="mt-1 space-y-2">
                      {visibleSentences.map((example, index) => (
                        <li key={`review-sentence-${index}`}>
                          <p className="text-sm italic text-black dark:text-slate-950">&ldquo;{example.text}&rdquo;</p>
                          {example.translation && <p className="mt-1 text-sm text-slate-700 dark:text-slate-700">{t("英文翻译：")} {example.translation}</p>}
                          {example.formOf && <p className="mt-1 text-xs text-slate-600">{t("词形关系：")} {example.formOf} {t("是")} {current.word} {t("的")} {t(example.grammaticalForm ?? "词形变化")}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-sm text-slate-500">{t("暂无例句")}</p>}
                  {sentences.length > 2 && (
                    <ExpandButton expanded={showAllExamples} expandLabel={t("查看全部例句")} collapseLabel={t("收起例句")} onClick={() => setShowAllExamples((value) => !value)} />
                  )}
                </div>
                {collocations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{t("相关搭配")}</h3>
                    <ul className="mt-1 space-y-2">
                      {visibleCollocations.map((example, index) => (
                        <li key={`review-collocation-${index}`}>
                          <p className="text-sm text-black dark:text-slate-950">{example.text}</p>
                          {example.translation && <p className="mt-1 text-sm text-slate-700 dark:text-slate-700">{t("英文释义：")} {example.translation}</p>}
                          {example.formOf && <p className="mt-1 text-xs text-slate-600">{t("词形关系：")} {example.formOf} {t("是")} {current.word} {t("的")} {t(example.grammaticalForm ?? "词形变化")}</p>}
                        </li>
                      ))}
                    </ul>
                    {collocations.length > 3 && (
                      <ExpandButton expanded={showAllCollocations} expandLabel={t("查看全部搭配")} collapseLabel={t("收起搭配")} onClick={() => setShowAllCollocations((value) => !value)} />
                    )}
                  </div>
                )}
              </section>
            ) : current.example ? (
              <div className="border-t border-slate-100 pt-3">
                <h3 className="text-sm font-semibold text-slate-800">{t("例句")}</h3>
                <p className="mt-1 text-sm italic text-black dark:text-slate-950">&ldquo;{current.example}&rdquo;</p>
              </div>
            ) : null}
            </>}
          </div>
        )}
      </div>

      {revealed && (
        <div className="grid grid-cols-3 gap-2">
          <RatingButton label={savingReview ? t("保存中…") : t("不会")} sub={sessionMode === "early" ? t("只记录练习") : t("稍后复习")} disabled={savingReview} onClick={() => void rate("again")} />
          <RatingButton label={savingReview ? t("保存中…") : t("有点印象")} sub={sessionMode === "early" ? t("只记录练习") : t("短间隔")} disabled={savingReview} onClick={() => void rate("hard")} />
          <RatingButton label={savingReview ? t("保存中…") : t("记得")} sub={sessionMode === "early" ? t("只记录练习") : t("延长间隔")} disabled={savingReview} onClick={() => void rate("good")} />
        </div>
      )}
        </>
      )}
    </div>
  );
}

function ExpandButton({
  expanded,
  expandLabel,
  collapseLabel,
  onClick,
}: {
  expanded: boolean;
  expandLabel: string;
  collapseLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className="mt-2 min-h-10 rounded-lg px-2 text-sm font-medium text-brand-700 underline underline-offset-2 dark:text-brand-700"
    >
      {expanded ? collapseLabel : expandLabel}
    </button>
  );
}

function PlanStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

function RatingButton({
  label,
  sub,
  disabled,
  onClick,
}: {
  label: string;
  sub: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white py-3 text-center shadow-sm active:bg-slate-50 disabled:opacity-50"
    >
      <span className="block text-sm font-semibold text-slate-800">{label}</span>
      <span className="block text-[10px] text-slate-400">{sub}</span>
    </button>
  );
}
