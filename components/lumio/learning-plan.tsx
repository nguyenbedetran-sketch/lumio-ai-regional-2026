"use client";
import { MathText } from "./math-text";
import { useState } from "react";
import { ArrowUpRight, CalendarClock, Compass } from "lucide-react";
import type { LearningItem } from "../../lib/lumio/types";
import type { LearningState } from "../../lib/lumio/learning-engine";
import type { Preferences } from "../../lib/lumio/recommendations";
import type { Locale } from "../../lib/lumio/i18n";
import {
  buildLearningPlan,
  type LearningPlanAction,
} from "../../lib/lumio/learning-plan";
import { learningPlanCopy } from "../../lib/lumio/learning-plan-copy";
import {
  skillLabel,
  skillTaxonomy,
  type SkillId,
} from "../../lib/lumio/skill-taxonomy";
import styles from "./learning-plan.module.css";
import { StudyPreferenceForm } from "./study-preferences";
import { studySetupCopy } from "../../lib/lumio/study-setup-copy";
import { quizReviewCopy } from "../../lib/lumio/quiz-review-copy";
export function DailyLearningPlan({
  items,
  learning,
  preferences,
  locale,
  open,
  onReview,
  onPreferences,
  storageError = false,
  showSetup = false,
}: {
  items: LearningItem[];
  learning: LearningState;
  preferences: Preferences;
  locale: Locale;
  open: (item: LearningItem) => void;
  onReview?: () => void;
  onPreferences?: (fn: (p: Preferences) => Preferences) => void;
  storageError?: boolean;
  showSetup?: boolean;
}) {
  const [setupOpen, setSetupOpen] = useState(!preferences.controls);
  const plan = buildLearningPlan(items, learning, preferences),
    c = learningPlanCopy[locale];
  const action = (a: LearningPlanAction, primary: boolean) => (
    <article
      key={a.id}
      className={primary ? styles.primary : styles.alternative}
      data-plan-primary={primary || undefined}
    >
      <span className={styles.eyebrow}>
        {primary ? c.primary : c.alternatives}
      </span>
      <h3>
        <MathText text={a.item.title} inline />
      </h3>
      <p>
        {a.reason === "due"
          ? c.due
          : a.reason === "focus"
            ? c.focus
            : a.reason === "goal"
              ? studySetupCopy[locale].chosen
              : a.reason === "review"
                ? c.weak
                : c[a.reason]}
        .{a.skillId && <> {skillLabel(a.skillId, locale)}.</>}
        {a.basisId && a.basisId !== a.skillId && (
          <> {skillLabel(a.basisId, locale)}.</>
        )}
      </p>
      {(a.dueCount > 0 || a.errors > 0 || a.questions > 0) && (
        <p className={styles.evidence}>
          {a.dueCount > 0
            ? `${a.dueCount} ${c.cards}`
            : a.errors > 0
              ? `${a.errors} ${c.errors}`
              : `${a.questions} ${c.questions}`}
        </p>
      )}
      <button
        className="lm-button"
        onClick={() =>
          a.kind === "review" && onReview ? onReview() : open(a.item)
        }
      >
        {c[a.kind]}
        <ArrowUpRight size={16} />
      </button>
    </article>
  );
  return (
    <section className={styles.plan} data-learning-plan aria-label={c.title}>
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>LUMIO / NEXT STEP</span>
          <h2>
            <Compass size={23} />
            {c.title}
          </h2>
          <p>{c.intro}</p>
        </div>
        <CalendarClock size={32} aria-hidden="true" />
      </div>
      {plan.profile.skills.some((skill) => skill.observations > 0) && (
        <p className="lm-help" data-plan-key-caveat>
          {quizReviewCopy[locale].history}
        </p>
      )}
      {showSetup && onPreferences && (
        <details
          className={styles.more}
          data-study-setup
          open={setupOpen}
          onToggle={(event) => setSetupOpen(event.currentTarget.open)}
        >
          <summary>{studySetupCopy[locale].setup}</summary>
          <p>{studySetupCopy[locale].hint}</p>
          <StudyPreferenceForm
            locale={locale}
            preferences={preferences}
            update={onPreferences}
            storageError={storageError}
          />
        </details>
      )}
      {onPreferences && (
        <label className={styles.focus}>
          {c.focusLabel}
          <select
            value={preferences.studyFocusSkillId || ""}
            disabled={!preferences.enabled || storageError}
            onChange={(e) => {
              const id = e.target.value as SkillId | "";
              onPreferences((p) => ({ ...p, studyFocusSkillId: id || null }));
            }}
          >
            <option value="">{c.auto}</option>
            {skillTaxonomy.map((s) => (
              <option key={s.id} value={s.id}>
                {skillLabel(s.id, locale)}
              </option>
            ))}
          </select>
        </label>
      )}
      {!plan.actions.length ? (
        <p>{c.empty}</p>
      ) : (
        <div className={styles.actions}>
          {plan.primary && action(plan.primary, true)}
          {plan.alternatives.length > 0 && (
            <details className={styles.more} data-plan-alternatives>
              <summary>
                {c.alternatives} ({plan.alternatives.length})
              </summary>
              <div className={styles.alternatives}>
                {plan.alternatives.map((a) => action(a, false))}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
