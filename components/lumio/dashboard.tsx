"use client";
import { useEffect, useId, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Circle,
  Flame,
  Plus,
  Target,
  Timer,
  BookOpen,
  FileText,
  Image as ImageIcon,
  Link,
  Music2,
  Video,
  Sparkles,
} from "lucide-react";
import { catalogs, type Locale } from "../../lib/lumio/i18n";
import type { LearningItem } from "../../lib/lumio/types";
import {
  learningMetrics,
  type LearningState,
  type StudyTask,
} from "../../lib/lumio/learning-engine";
import { learningCopy } from "../../lib/lumio/learning-copy";
import { focusCopy } from "../../lib/lumio/focus-copy";
import { dashboardInsights } from "../../lib/lumio/dashboard-insights";
import { dashboardCopy } from "../../lib/lumio/dashboard-v3-copy";
import {
  DashboardCounter,
  DashboardReveal,
  useDashboardMotion,
} from "./dashboard-motion";
import { DailyLearningPlan } from "./learning-plan";
import {
  emptyPreferences,
  type Preferences,
} from "../../lib/lumio/recommendations";
import { homeV8Copy } from "../../lib/lumio/home-v8-copy";
import { useDraft } from "../shared/draft-guard";
import styles from "./home-v8.module.css";
export function useLocalClock(observation?: LearningState) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    // A newly recorded event must not wait for the next periodic clock tick.
    tick();
    const timer = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [observation]);
  return now;
}
export function StreakCalendar({
  locale,
  items,
  state,
  snapshot,
}: {
  locale: Locale;
  items: LearningItem[];
  state: LearningState;
  snapshot?: Date;
}) {
  const clock = useLocalClock(state),
    now = snapshot || clock,
    c = focusCopy[locale],
    homeCopy = homeV8Copy[locale],
    copy = learningCopy[locale],
    m = learningMetrics(items, state, now);
  return (
    <section
      className={`lx-streak-card ${styles.streak} ${m.todayActive ? "is-active" : ""}`}
      aria-label={copy.streak}
    >
      <div className="lx-streak-symbol" aria-hidden="true">
        <Flame size={25} />
        <span />
      </div>
      <div className="lx-streak-copy">
        <strong>
          {m.streak} {copy.days} ·{" "}
          {m.todayActive ? homeCopy.streakRecorded : homeCopy.streakNeutral}
        </strong>
        <details className={styles.streakExplanation}>
          <summary>{homeCopy.streakDetails}</summary>
          <p>{c.streakHint}</p>
        </details>
      </div>
      <div className="lx-streak-week">
        {m.week.map((day, index) => (
          <div
            key={day.date}
            className={`${day.count ? "has-study" : ""} ${index === 6 ? "is-today" : ""}`}
            title={`${day.date} · ${day.count ? c.studied : c.inactive}`}
            aria-label={`${day.date} · ${day.count ? c.studied : c.inactive}`}
          >
            <span aria-hidden="true">
              {day.count ? <Check size={15} /> : <Circle size={12} />}
            </span>
            <small>
              {new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(
                new Date(`${day.date}T12:00:00`),
              )}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
type Navigate = (
  view: "planner" | "progress" | "review" | "focus" | "library",
) => void;
export function ActivityChart({
  state,
  items,
  locale,
  snapshot,
}: {
  state: LearningState;
  items: LearningItem[];
  locale: Locale;
  snapshot?: Date;
}) {
  const clock = useLocalClock(state),
    now = snapshot || clock,
    c = learningCopy[locale],
    metrics = learningMetrics(items, state, now),
    max = Math.max(1, ...metrics.week.map((d) => d.count));
  return (
    <div
      className="lx-week-chart"
      role="img"
      aria-label={`${c.activity}: ${metrics.week.map((d) => `${d.date}: ${d.count}`).join(", ")}`}
    >
      {metrics.week.map((d, i) => (
        <div key={d.date} className={i === 6 ? "today" : ""}>
          <span className="lx-week-count">{d.count}</span>
          <div className="lx-bar-track">
            <i style={{ height: `${(d.count / max) * 100}%` }} />
          </div>
          <span>
            {new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(
              new Date(`${d.date}T12:00:00`),
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
const materialIcons = {
  text: FileText,
  pdf: FileText,
  image: ImageIcon,
  link: Link,
  audio: Music2,
  video: Video,
};

export function Dashboard({
  locale,
  name,
  items,
  state,
  navigate,
  toggleTask,
  open,
  preferences,
  onPreferences,
  onAsk,
  onAdd,
  onSample,
  onControls,
  storageError = false,
}: {
  locale: Locale;
  name: string;
  items: LearningItem[];
  state: LearningState;
  navigate: Navigate;
  toggleTask: (task: StudyTask) => void;
  open: (item: LearningItem) => void;
  preferences?: Preferences;
  onPreferences?: (fn: (p: Preferences) => Preferences) => void;
  onAsk?: (item: LearningItem, prompt: string) => void;
  onAdd?: () => void;
  onSample?: () => void;
  onControls?: () => void;
  storageError?: boolean;
}) {
  const now = useLocalClock(state),
    c = homeV8Copy[locale],
    copy = dashboardCopy[locale];
  const mode = useDashboardMotion();
  const insight = dashboardInsights(items, state, now);
  const [question, setQuestion] = useState("");
  const inputId = useId();
  const [sourceId, setSourceId] = useState("");
  const draft = useDraft(c.tutor, false, () => setQuestion(""));
  const source = items.find((i) => i.id === sourceId) || insight.recent[0];
  const add = onAdd || (() => navigate("library"));
  return (
    <DashboardReveal mode={mode}>
      <div className={styles.home} data-home-v8 data-dashboard-motion={mode}>
        <header className={styles.header} data-dash-reveal>
          <div>
            <span className={styles.eyebrow}>
              LUMIO / {name || copy.studio}
            </span>
            <h1>{c.welcome}</h1>
            <p>{c.intro}</p>
          </div>
          <button className="lm-button" onClick={add}>
            <Plus size={16} />
            {c.add}
          </button>
        </header>
        <div className={styles.layout}>
          <div className={styles.main}>
            <form
              className={styles.composer}
              data-dash-reveal
              data-home-composer
              onSubmit={(event) => {
                event.preventDefault();
                if (!source || !question.trim()) return;
                draft.markClean();
                (onAsk || ((item: LearningItem) => open(item)))(
                  source,
                  question.trim(),
                );
              }}
            >
              <div className={styles.composerHeading}>
                <span className={styles.spark} aria-hidden="true">
                  <Sparkles size={22} />
                </span>
                <h2>{c.tutor}</h2>
              </div>
              <p id={`${inputId}-example`} className={styles.example}>
                {c.example}
              </p>
              <textarea
                id={inputId}
                aria-keyshortcuts="Control+Enter Meta+Enter"
                aria-describedby={`${inputId}-example ${inputId}-disclosure`}
                aria-label={c.tutor}
                placeholder={c.question}
                maxLength={2000}
                value={question}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    (event.ctrlKey || event.metaKey) &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                onChange={(event) => {
                  setQuestion(event.target.value);
                  event.target.value.trim()
                    ? draft.markDirty()
                    : draft.markClean();
                }}
              />
              <div className={styles.composeActions}>
                <label>
                  <span className={styles.sourceLabel}>
                    <BookOpen size={14} aria-hidden="true" />
                    {c.source}
                  </span>
                  <select
                    value={source?.id || ""}
                    onChange={(e) => setSourceId(e.target.value)}
                    disabled={!items.length}
                  >
                    {!items.length && <option value="">{c.noSource}</option>}
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="lm-button primary"
                  disabled={!source || !question.trim()}
                >
                  {c.ask}
                  <ArrowUpRight size={16} />
                </button>
              </div>
              <div className={styles.composerFooter}>
                <p id={`${inputId}-disclosure`} className={styles.muted}>
                  {c.disclosure}
                </p>
                <span className={styles.shortcut}>{c.shortcut}</span>
              </div>
            </form>
            <div data-dash-reveal>
              <DailyLearningPlan
                items={items}
                learning={state}
                preferences={preferences || emptyPreferences()}
                locale={locale}
                open={open}
                onReview={() => navigate("review")}
                onPreferences={onPreferences}
                storageError={storageError}
              />
            </div>
            <section data-dash-reveal aria-label={c.recent}>
              <div className={styles.heading}>
                <h2>{c.recent}</h2>
                <button
                  className={styles.textButton}
                  onClick={() => navigate("library")}
                >
                  {c.all}
                  <ArrowRight size={15} />
                </button>
              </div>
              {insight.recent.length ? (
                <div className={styles.cards}>
                  {insight.recent.map((item) => {
                    const Icon = materialIcons[item.kind];
                    return (
                      <button
                        className={styles.material}
                        key={item.id}
                        onClick={() => open(item)}
                        aria-label={`${c.openMaterial}: ${item.title}`}
                        title={item.title}
                        data-home-material
                      >
                        <span
                          className={styles.materialVisual}
                          aria-hidden="true"
                        >
                          <Icon size={31} strokeWidth={1.5} />
                        </span>
                        <strong>{item.title}</strong>
                        <span className={styles.materialFooter}>
                          <small>{c.openMaterial}</small>
                          <ArrowUpRight size={16} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.empty}>
                  <BookOpen size={32} aria-hidden="true" />
                  <h3>{c.empty}</h3>
                  <p className={styles.muted}>{c.emptyHint}</p>
                  <button className="lm-button primary" onClick={add}>
                    <Plus size={16} />
                    {c.add}
                  </button>
                  {onSample && (
                    <button className="lm-button" onClick={onSample}>
                      {catalogs[locale].sample}
                      <ArrowUpRight size={15} />
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>
          <aside className={styles.aside}>
            <section
              className={styles.panel}
              data-dash-reveal
              aria-label={c.goals}
            >
              <div className={styles.heading}>
                <h2>{c.goals}</h2>
                <Target size={19} aria-hidden="true" />
              </div>
              {insight.goals.length > 0 ? (
                <>
                  <div className={styles.metric}>
                    <strong>
                      <DashboardCounter
                        value={insight.completedGoals}
                        locale={locale}
                        mode={mode}
                      />{" "}
                      / {insight.goals.length}
                    </strong>
                    <span>{copy.goalProgress}</span>
                  </div>
                  <progress
                    className={styles.goalProgress}
                    value={insight.completedGoals}
                    max={insight.goals.length}
                    aria-label={copy.goalProgress}
                  >
                    {insight.completedGoals}/{insight.goals.length}
                  </progress>
                  <p className={styles.goalHint}>{c.goalHint}</p>
                </>
              ) : (
                <p className={styles.goalEmpty}>{c.goalEmpty}</p>
              )}
              {insight.goals.length ? (
                <div className={styles.goals}>
                  {insight.goals.slice(0, 3).map((task) => (
                    <button
                      key={task.id}
                      className={styles.goal}
                      aria-pressed={task.done}
                      onClick={() => toggleTask(task)}
                    >
                      {task.done ? <Check size={17} /> : <Circle size={17} />}
                      <span>{task.title}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className={styles.muted}>{c.noGoals}</p>
              )}
              <button
                className={styles.textButton}
                onClick={() => navigate("planner")}
              >
                {c.planner}
                <ArrowRight size={15} />
              </button>
            </section>
            <section
              className={styles.panel}
              data-dash-reveal
              aria-label={learningCopy[locale].streak}
            >
              <StreakCalendar
                locale={locale}
                items={items}
                state={state}
                snapshot={now}
              />
            </section>
            <section
              className={styles.panel}
              data-dash-reveal
              aria-label={c.activity}
            >
              <div className={styles.heading}>
                <h2>{c.activity}</h2>
                <Timer size={18} aria-hidden="true" />
              </div>
              <ActivityChart
                locale={locale}
                items={items}
                state={state}
                snapshot={now}
              />
              <p className={styles.muted}>{c.activityHint}</p>
              <div className={styles.footer}>
                <button
                  className={styles.textButton}
                  onClick={() => navigate("progress")}
                >
                  {copy.progressAction}
                  <ArrowUpRight size={14} />
                </button>
                <button
                  className={styles.textButton}
                  onClick={() => navigate("focus")}
                >
                  {c.focus}
                </button>
                {onControls && (
                  <button className={styles.textButton} onClick={onControls}>
                    {c.controls}
                  </button>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </DashboardReveal>
  );
}
