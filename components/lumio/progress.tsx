"use client";
import { MathText } from "./math-text";
import {
  ArrowUpRight,
  Flame,
  Timer,
  Target,
  Layers,
  BarChart3,
  ClipboardCheck,
} from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import type { LearningItem } from "../../lib/lumio/types";
import {
  learningMetrics,
  type LearningState,
} from "../../lib/lumio/learning-engine";
import { learningCopy } from "../../lib/lumio/learning-copy";
import { ActivityChart, StreakCalendar, useLocalClock } from "./dashboard";
export function Progress({
  locale,
  items,
  state,
  open,
}: {
  locale: Locale;
  items: LearningItem[];
  state: LearningState;
  open: (item: LearningItem) => void;
}) {
  const now = useLocalClock(state),
    c = learningCopy[locale],
    m = learningMetrics(items, state, now);
  return (
    <div className="lx-page">
      <div className="lx-page-title">
        <div>
          <span className="lx-kicker">LUMIO / {c.progress}</span>
          <h1>{c.achievements}</h1>
          <p>{c.evidenceHint}</p>
        </div>
        <span className="lx-title-symbol">
          <BarChart3 size={30} />
        </span>
      </div>
      <div className="lx-metric-cards">
        {[
          [Flame, m.streak, c.streak],
          [Timer, m.focusMinutes, c.focusTime],
          [Target, m.accuracy === null ? "—" : `${m.accuracy}%`, c.accuracy],
          [Layers, m.reviews, c.reviewed],
        ].map(([Icon, value, label]) => {
          const I = Icon as typeof Flame;
          return (
            <section key={String(label)}>
              <I size={20} />
              <strong>{String(value)}</strong>
              <span>{String(label)}</span>
            </section>
          );
        })}
      </div>
      <StreakCalendar locale={locale} items={items} state={state} />
      <div className="lx-progress-grid">
        <section className="lx-card">
          <div className="lx-card-heading">
            <h2>{c.activity}</h2>
            <span className="lx-count-badge">
              {m.week.reduce((n, d) => n + d.count, 0)} {c.weekTotal}
            </span>
          </div>
          <ActivityChart locale={locale} items={items} state={state} />
          <p className="lx-caption">{c.activityHint}</p>
        </section>
        <section className="lx-card">
          <h2>{c.topicProgress}</h2>
          <p className="lx-caption">{c.recentResults}</p>
          {m.topics.length ? (
            <div className="lx-topic-list">
              {m.topics.map((topic) => (
                <button key={topic.item.id} onClick={() => open(topic.item)}>
                  <span>
                    <strong>
                      <MathText text={topic.item.title} inline />
                    </strong>
                    <small>
                      {topic.attempts} {c.attempts}
                    </small>
                    <span className="lx-score-track">
                      <i style={{ width: `${topic.accuracy}%` }} />
                    </span>
                  </span>
                  <b>{topic.accuracy}%</b>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
          ) : (
            <div className="lx-inline-empty">
              <Target size={30} />
              <p>{c.noQuizHint}</p>
            </div>
          )}
        </section>
      </div>
      <section className="lx-card lx-history-card">
        <div className="lx-card-heading">
          <h2>{c.quizHistory}</h2>
          <span>
            {m.correct} / {m.total} {c.correct}
          </span>
        </div>
        {m.attempts.length ? (
          <div className="lx-quiz-history">
            {m.attempts.slice(0, 30).map((a, i) => (
              <button
                key={`${a.itemId}-${a.date}-${i}`}
                onClick={() =>
                  open(items.find((item) => item.id === a.itemId)!)
                }
              >
                <span className="lx-result-icon">
                  <ClipboardCheck size={20} />
                </span>
                <span>
                  <strong>
                    <MathText text={a.title} inline />
                  </strong>
                  <small>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(a.date))}
                  </small>
                </span>
                <b>
                  {a.score} / {a.total}
                </b>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        ) : (
          <div className="lx-inline-empty">
            <ClipboardCheck size={34} />
            <h3>{c.noQuiz}</h3>
            <p>{c.noQuizHint}</p>
          </div>
        )}
      </section>
    </div>
  );
}
