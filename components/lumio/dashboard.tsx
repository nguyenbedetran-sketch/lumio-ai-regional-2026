"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Circle,
  Flame,
  Layers,
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
import type { Locale } from "../../lib/lumio/i18n";
import type { LearningItem } from "../../lib/lumio/types";
import {
  learningMetrics,
  type LearningState,
  type StudyTask,
} from "../../lib/lumio/learning-engine";
import { learningCopy } from "../../lib/lumio/learning-copy";
import { focusCopy } from "../../lib/lumio/focus-copy";
import {
  dashboardInsights,
  type DashboardAction,
} from "../../lib/lumio/dashboard-insights";
import { dashboardCopy } from "../../lib/lumio/dashboard-v3-copy";
import {
  DashboardCounter,
  DashboardReveal,
  LearningConstellation,
  useDashboardMotion,
} from "./dashboard-motion";
export function useLocalClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
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
  const clock = useLocalClock(),
    now = snapshot || clock,
    c = focusCopy[locale],
    copy = learningCopy[locale],
    m = learningMetrics(items, state, now);
  return (
    <section
      className={`lx-streak-card ${m.todayActive ? "is-active" : ""}`}
      aria-label={copy.streak}
    >
      <div className="lx-streak-symbol" aria-hidden="true">
        <Flame size={25} />
        <span />
      </div>
      <div className="lx-streak-copy">
        <strong>
          {m.streak} {copy.days} ·{" "}
          {m.todayActive ? c.streakToday : c.streakPending}
        </strong>
        <p>{c.streakHint}</p>
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
  const clock = useLocalClock(),
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
}: {
  locale: Locale;
  name: string;
  items: LearningItem[];
  state: LearningState;
  navigate: Navigate;
  toggleTask: (task: StudyTask) => void;
  open: (item: LearningItem) => void;
}) {
  const now = useLocalClock();
  const c = learningCopy[locale],
    copy = dashboardCopy[locale];
  const mode = useDashboardMotion();
  const insight = dashboardInsights(items, state, now);
  const metrics = learningMetrics(items, state, now);
  const { action, goals, completedGoals, goalPercent, due, recent } = insight;
  const hasCards = items.some((item) =>
    item.cards.some((card) => card.front.trim() && card.back.trim()),
  );
  const next = {
    focus: {
      title: copy.focusTitle,
      reason: copy.focusReason,
      button: copy.focusAction,
      Icon: Timer,
    },
    review: {
      title: copy.reviewTitle,
      reason: copy.reviewReason,
      button: copy.reviewAction,
      Icon: Layers,
    },
    goal: {
      title: copy.goalTitle,
      reason: copy.goalReason,
      button: copy.goalAction,
      Icon: Target,
    },
    practice: {
      title: copy.practiceTitle,
      reason: copy.practiceReason,
      button: copy.practiceAction,
      Icon: Target,
    },
    continue: {
      title: copy.continueTitle,
      reason: copy.continueReason,
      button: copy.continueAction,
      Icon: BookOpen,
    },
    start: {
      title: copy.startTitle,
      reason: copy.startReason,
      button: copy.startAction,
      Icon: Sparkles,
    },
  }[action.kind];
  const runAction = (selected: DashboardAction = action) => {
    if (selected.kind === "focus") navigate("focus");
    else if (selected.kind === "review") navigate("review");
    else if (selected.kind === "goal")
      selected.item ? open(selected.item) : navigate("planner");
    else if (selected.kind === "practice" || selected.kind === "continue")
      open(selected.item);
    else navigate("library");
  };
  const actionContext =
    action.kind === "goal"
      ? action.task.title
      : action.kind === "review"
        ? `${due.length} ${c.due}`
        : action.kind === "focus"
          ? `${action.remainingMinutes} ${c.minuteUnit}`
          : "item" in action
            ? action.item.title
            : "";
  const weekActivity = metrics.week.reduce((sum, day) => sum + day.count, 0);
  const focusMinutes = state.focus
    ? Math.ceil(
        (state.focus.deadline
          ? Math.max(0, state.focus.deadline - now.getTime()) / 1000
          : state.focus.remaining) / 60,
      )
    : 25;
  return (
    <div
      className="lx-dashboard lv-dashboard dv-dashboard"
      data-dashboard-motion={mode}
    >
      <DashboardReveal mode={mode}>
        <section className="lx-hero dv-hero" data-dash-reveal>
          <div className="lx-hero-copy dv-hero-copy">
            <div className="lx-eyebrow">
              <span />
              <span className="dv-eyebrow-text">{copy.studio}</span>
              <i>
                {new Intl.DateTimeFormat(locale, {
                  day: "numeric",
                  month: "short",
                }).format(now)}
              </i>
            </div>
            <h1>
              {copy.greeting}
              <br />
              <em>{copy.greetingAccent}</em>
            </h1>
            <p>
              {name ? `${name.split(" ").slice(-2).join(" ")}, ` : ""}
              {copy.heroHint}
            </p>
            <div className="dv-hero-actions">
              <button className="lx-hero-button" onClick={() => runAction()}>
                {next.button}
                <ArrowUpRight size={19} />
              </button>
              <button
                className="dv-hero-secondary"
                onClick={() => navigate("progress")}
              >
                {copy.progressAction}
                <ArrowRight size={16} />
              </button>
            </div>
            <span className="dv-hero-proof">
              <span />
              <span>{copy.evidence}</span>
            </span>
          </div>
          <LearningConstellation
            locale={locale}
            materials={items.length}
            quizzes={insight.quizAttempts}
            reviews={insight.reviewCount}
            completedGoals={completedGoals}
            goals={goals.length}
            mode={mode}
            navigate={navigate}
          />
        </section>

        <section
          className="lx-stat-strip dv-stats"
          aria-label={c.achievements}
          data-dash-reveal
        >
          {[
            { Icon: Flame, value: metrics.streak, label: c.streak },
            {
              Icon: Target,
              value: metrics.accuracy,
              label: c.accuracy,
              suffix: "%",
            },
            { Icon: Timer, value: metrics.focusMinutes, label: c.focusTime },
            { Icon: Layers, value: metrics.reviews, label: c.reviewed },
          ].map(({ Icon, value, label, suffix }) => (
            <button key={label} onClick={() => navigate("progress")}>
              <span className="lx-stat-icon">
                <Icon size={19} />
              </span>
              <span>
                <strong>
                  {value === null ? (
                    "—"
                  ) : (
                    <DashboardCounter
                      value={value}
                      locale={locale}
                      mode={mode}
                      suffix={suffix}
                    />
                  )}
                </strong>
                <small>{label}</small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </section>

        <section
          className={`dv-next-step kind-${action.kind}`}
          aria-label={copy.nextLabel}
          data-dash-reveal
        >
          <span className="dv-next-icon">
            <next.Icon size={25} />
          </span>
          <div className="dv-next-content">
            <span className="lx-kicker">{copy.nextLabel}</span>
            <h2>{next.title}</h2>
            <p>{next.reason}</p>
            {actionContext && (
              <span className="dv-next-context">{actionContext}</span>
            )}
            {action.kind === "practice" && (
              <span className="dv-next-evidence">
                {action.accuracy}% · {action.attempts} {c.attempts}
              </span>
            )}
          </div>
          <button className="dv-primary-button" onClick={() => runAction()}>
            {next.button}
            <ArrowRight size={17} />
          </button>
        </section>

        <div className="dv-learning-grid">
          <section className="lx-card dv-goals-card" data-dash-reveal>
            <div className="lx-card-heading">
              <div>
                <span className="lx-kicker">01 / {c.todayLabel}</span>
                <h2>{c.today}</h2>
              </div>
              <button
                className="lx-round-button"
                aria-label={c.addGoal}
                onClick={() => navigate("planner")}
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="dv-day-progress">
              <div className="dv-goal-ring">
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r="41" className="track" />
                  <circle
                    cx="50"
                    cy="50"
                    r="41"
                    className="fill"
                    strokeDasharray="257.61"
                    strokeDashoffset={257.61 * (1 - goalPercent / 100)}
                  />
                </svg>
                <strong>
                  {goals.length ? (
                    <DashboardCounter
                      value={goalPercent}
                      locale={locale}
                      mode={mode}
                      suffix="%"
                    />
                  ) : (
                    <Target size={25} />
                  )}
                </strong>
              </div>
              <div>
                <h3>
                  {goals.length
                    ? goalPercent === 100
                      ? copy.goalComplete
                      : copy.todayProgress
                    : copy.goalEmpty}
                </h3>
                <p>
                  {goals.length
                    ? `${completedGoals} / ${goals.length} ${c.done.toLowerCase()}`
                    : c.noGoalsHint}
                </p>
                <progress
                  className="dv-sr-only"
                  value={completedGoals}
                  max={goals.length || 1}
                  aria-label={copy.goalProgress}
                />
              </div>
            </div>
            {goals.length ? (
              <div className="lx-mini-goals dv-mini-goals">
                {goals.slice(0, 4).map((goal) => {
                  const linkedItem = items.find(
                    (item) => item.id === goal.itemId,
                  );
                  return (
                    <div key={goal.id} className={goal.done ? "done" : ""}>
                      <button
                        className="lx-check"
                        aria-label={`${goal.done ? c.undo : c.complete}: ${goal.title}`}
                        aria-pressed={goal.done}
                        onClick={() => toggleTask(goal)}
                      >
                        {goal.done ? <Check size={16} /> : <Circle size={18} />}
                      </button>
                      <div>
                        <strong>{goal.title}</strong>
                        <small>
                          {goal.minutes} {c.minuteUnit}
                        </small>
                      </div>
                      {linkedItem && (
                        <button
                          className="lx-round-button"
                          aria-label={`${c.open}: ${linkedItem.title}`}
                          onClick={() => open(linkedItem)}
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <button
                className="dv-add-goal"
                onClick={() => navigate("planner")}
              >
                <Plus size={17} />
                {c.addGoal}
                <ArrowRight size={16} />
              </button>
            )}
            <button
              className="lx-card-footer"
              onClick={() => navigate("planner")}
            >
              <span>{c.planner}</span>
              <ArrowRight size={16} />
            </button>
          </section>

          <section className="lx-card dv-review-card" data-dash-reveal>
            <div className="lx-card-heading">
              <span className="lx-kicker">02 / {c.review}</span>
              <span className="dv-review-symbol" aria-hidden="true">
                <Layers size={22} />
              </span>
            </div>
            <div className="dv-review-number">
              <strong>
                <DashboardCounter
                  value={due.length}
                  locale={locale}
                  mode={mode}
                />
              </strong>
              <span>
                {due.length ? c.due : hasCards ? c.dueEmpty : copy.reviewEmpty}
              </span>
            </div>
            <p>{hasCards ? c.reviewHint : c.noCardsHint}</p>
            <div className="dv-review-cards" aria-hidden="true">
              <i />
              <i />
              <i>
                <span />
                <span />
                <Layers size={24} />
              </i>
            </div>
            <button
              className="dv-review-button"
              onClick={() => navigate("review")}
            >
              {due.length ? c.startReview : c.reviewSchedule}
              <ArrowUpRight size={18} />
            </button>
          </section>

          <section className="lx-card dv-week-card" data-dash-reveal>
            <div className="lx-card-heading">
              <div>
                <span className="lx-kicker">03 / {c.progress}</span>
                <h2>{c.activity}</h2>
              </div>
              <button
                className="lx-round-button"
                aria-label={c.progress}
                onClick={() => navigate("progress")}
              >
                <ArrowUpRight size={18} />
              </button>
            </div>
            <div className="dv-week-total">
              <strong>
                <DashboardCounter
                  value={weekActivity}
                  locale={locale}
                  mode={mode}
                />
              </strong>
              <span>{copy.totalActivities}</span>
            </div>
            <ActivityChart
              state={state}
              items={items}
              locale={locale}
              snapshot={now}
            />
            <p>{weekActivity ? c.activityHint : copy.emptyActivity}</p>
          </section>

          <div className="dv-habit-stack" data-dash-reveal>
            <StreakCalendar
              locale={locale}
              items={items}
              state={state}
              snapshot={now}
            />
            <button
              className="lx-focus-preview dv-focus-preview"
              onClick={() => navigate("focus")}
            >
              <span className="lx-focus-glyph">
                <Timer size={28} />
              </span>
              <span>
                <small>{c.focus}</small>
                <strong>{c.focusTitle}</strong>
              </span>
              <span className="lx-focus-preview-time">
                {focusMinutes}
                <small>{c.minuteUnit}</small>
              </span>
              <ArrowUpRight size={20} />
            </button>
          </div>
        </div>

        {recent.length > 0 && (
          <section className="dv-recent" data-dash-reveal>
            <div className="dv-section-heading">
              <div>
                <span className="lx-kicker">LUMIO / {copy.materials}</span>
                <h2>{copy.recentTitle}</h2>
                <p>{copy.recentHint}</p>
              </div>
              <button
                className="lx-text-button"
                onClick={() => navigate("library")}
              >
                {c.library}
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="dv-recent-grid">
              {recent.map((item) => {
                const Icon = materialIcons[item.kind];
                return (
                  <button
                    key={item.id}
                    className={`dv-recent-card kind-${item.kind}`}
                    onClick={() => open(item)}
                  >
                    <span className="dv-recent-art" aria-hidden="true">
                      <span className="dv-document-lines">
                        <i />
                        <i />
                        <i />
                      </span>
                      <Icon size={25} />
                      <span className="dv-art-spark" />
                    </span>
                    <span className="dv-recent-text">
                      <small>{copy.savedMaterial}</small>
                      <strong>{item.title}</strong>
                      <span>
                        {c.open}
                        <ArrowUpRight size={15} />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </DashboardReveal>
    </div>
  );
}
