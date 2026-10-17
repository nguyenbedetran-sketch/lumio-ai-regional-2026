"use client";
import { quizReviewCopy } from "../../lib/lumio/quiz-review-copy";
import { useMemo, useState, type CSSProperties } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  Fingerprint,
  Network,
  Trash2,
} from "lucide-react";
import type { LearningItem } from "../../lib/lumio/types";
import type { Locale } from "../../lib/lumio/i18n";
import type { Preferences } from "../../lib/lumio/recommendations";
import {
  buildSkillProfile,
  matchingSkillItems,
  skillDifficulties,
  skillPracticeSuggestions,
} from "../../lib/lumio/skill-evidence";
import {
  skillLabel,
  skillTaxonomy,
  type SkillId,
} from "../../lib/lumio/skill-taxonomy";
import { skillCopy } from "../../lib/lumio/skill-copy";
import { learningPlanCopy } from "../../lib/lumio/learning-plan-copy";
const positions = [
  [16, 12],
  [16, 36],
  [16, 60],
  [50, 48],
  [16, 85],
  [50, 85],
  [84, 67],
];
export function SkillEvidencePanel({
  items,
  preferences,
  update,
  locale,
  open,
  storageError,
  onClearSkillEvidence,
}: {
  items: LearningItem[];
  preferences: Preferences;
  update: (f: (p: Preferences) => Preferences) => void;
  locale: Locale;
  open: (i: LearningItem) => void;
  storageError: boolean;
  onClearSkillEvidence?: () => void;
}) {
  const c = skillCopy[locale],
    pc = learningPlanCopy[locale],
    enabled = preferences.enabled && preferences.skillTracking !== false;
  const profile = useMemo(
    () =>
      buildSkillProfile(
        items,
        enabled,
        Date.now(),
        preferences.excludedSkillAttemptIds,
      ),
    [items, enabled, preferences.excludedSkillAttemptIds],
  );
  const [selected, setSelected] = useState<SkillId>("linear"),
    [notice, setNotice] = useState(""),
    [recordLimit, setRecordLimit] = useState(20);
  const records = [
    ...new Map(
      items.flatMap((item) =>
        item.attempts.flatMap((attempt) =>
          typeof attempt.skillEvidence?.attemptId === "string"
            ? [[attempt.skillEvidence.attemptId, { item, attempt }] as const]
            : [],
        ),
      ),
    ).entries(),
  ].sort((a, b) => b[1].attempt.date.localeCompare(a[1].attempt.date));
  const current = profile.skills.find((s) => s.id === selected)!,
    name = (id: SkillId) => skillLabel(id, locale);
  const suggestions = skillPracticeSuggestions(items, profile);
  const materials = matchingSkillItems(items, selected),
    snapshots = items.reduce(
      (n, i) => n + i.attempts.filter((a) => a.skillEvidence).length,
      0,
    );
  return (
    <section className="lski" data-skill-evidence>
      <div className="lski-heading">
        <div>
          <span className="lm-overline">LUMIO / LEARNING EVIDENCE</span>
          <h2>
            <Fingerprint size={23} />
            {c.title}
          </h2>
          <p>{c.intro}</p>
        </div>
        <Network className="lski-emblem" size={38} />
      </div>
      <p className="lm-help" data-skill-key-caveat>
        {quizReviewCopy[locale].history}
      </p>
      <div className="lski-controls">
        <label>
          <input
            type="checkbox"
            checked={preferences.skillTracking !== false}
            disabled={!preferences.enabled || storageError}
            onChange={(e) =>
              update((p) => ({ ...p, skillTracking: e.target.checked }))
            }
          />
          {c.tracking}
        </label>
        <button
          className="lm-button"
          disabled={storageError || !onClearSkillEvidence || !snapshots}
          onClick={() => {
            if (!window.confirm(c.clearConfirm)) return;
            onClearSkillEvidence?.();
            // The library write may fail or conflict after this callback.
            // Keep explicit exclusions even if old evidence is restored.
            // The separate Restore All control remains the intentional reset.
            setNotice(pc.clearRequested);
          }}
        >
          <Trash2 size={14} />
          {c.clear}
        </button>
      </div>
      <p className="lm-help">{enabled ? c.privacy : c.off}</p>
      <p className="lm-help" role="status" aria-live="polite">
        {notice}
      </p>
      <details className="lski-method" data-evidence-inspector>
        <summary>{pc.inspect}</summary>
        <p>{pc.inspectHint}</p>
        {!!preferences.excludedSkillAttemptIds?.length && (
          <button
            className="lm-button"
            disabled={storageError}
            onClick={() =>
              update((p) => ({ ...p, excludedSkillAttemptIds: [] }))
            }
          >
            {pc.restoreAll} ({preferences.excludedSkillAttemptIds.length})
          </button>
        )}
        {!records.length && <p>{pc.noRecords}</p>}
        {records.slice(0, recordLimit).map(([id, { item, attempt }]) => {
          const excluded =
            preferences.excludedSkillAttemptIds?.includes(id) || false;
          return (
            <article
              key={id}
              className="lski-evidence-row"
              style={{
                padding: "16px 0",
                borderBottom: "1px solid var(--lm-line)",
              }}
            >
              <strong>{item.title}</strong>
              <p>
                <time dateTime={attempt.date}>
                  {attempt.date.slice(0, 16).replace("T", " ")} UTC
                </time>{" "}
                · {attempt.score}/{attempt.total} ·{" "}
                {excluded ? pc.excluded : pc.included}
              </p>
              <p className="lm-help">
                {[
                  ...new Set(
                    attempt.skillEvidence!.answers.flatMap((a) =>
                      a.skillId ? [name(a.skillId)] : [],
                    ),
                  ),
                ].join(" · ")}
              </p>
              {attempt.skillEvidence!.answers.some((a) =>
                a.fingerprint.startsWith("q1:"),
              ) && <p className="lm-help">{pc.legacy}</p>}
              <button
                className="lm-button"
                disabled={
                  storageError ||
                  (!excluded &&
                    (preferences.excludedSkillAttemptIds?.length || 0) >= 1000)
                }
                onClick={() =>
                  update((p) => ({
                    ...p,
                    excludedSkillAttemptIds: excluded
                      ? (p.excludedSkillAttemptIds || []).filter(
                          (v) => v !== id,
                        )
                      : [
                          ...(p.excludedSkillAttemptIds || []).filter(
                            (v) => v !== id,
                          ),
                          id,
                        ],
                  }))
                }
              >
                {excluded ? pc.restore : pc.exclude}
              </button>
            </article>
          );
        })}
        {records.length > recordLimit && (
          <button
            className="lm-button"
            onClick={() => setRecordLimit((n) => n + 20)}
          >
            {pc.showMore}
          </button>
        )}
      </details>
      {enabled && (
        <>
          {profile.legacyIdentityAnswers > 0 && (
            <p className="lm-help">
              {profile.legacyIdentityAnswers} · {pc.identityNote}
            </p>
          )}
          {suggestions.length > 0 && (
            <div className="lski-suggestions" data-skill-suggestions>
              <h3>{c.nextSteps}</h3>
              <p className="lm-help">{c.suggestedScope}</p>
              <div>
                {suggestions.map((s) => (
                  <article key={s.item.id}>
                    <span>{name(s.skillId)}</span>
                    <strong>{s.item.title}</strong>
                    <p>
                      {s.reason === "review"
                        ? c.reviewReason
                        : s.reason === "foundation"
                          ? c.foundationReason
                          : s.reason === "next"
                            ? c.nextReason
                            : c.sampleReason}
                      : {name(s.basisId)}.{" "}
                      {s.reason === "review" || s.reason === "foundation"
                        ? `${s.errors} ${c.errors}`
                        : `${s.questions} ${c.questions}`}
                      .
                    </p>
                    <button className="lm-button" onClick={() => open(s.item)}>
                      {c.open}
                      <ArrowUpRight size={14} />
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}
          <div className="lski-map-head">
            <h3>{c.graph}</h3>
            <p>{c.scope}</p>
          </div>
          <div className="lski-map" aria-label={c.graph}>
            <svg
              viewBox="0 0 1000 360"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M160 130 C330 130 330 173 500 173 M160 216 C330 216 330 173 500 173 M160 306 L500 306 M160 306 C490 306 490 241 840 241 M500 306 C670 306 670 241 840 241 M160 130 C650 130 650 241 840 241" />
            </svg>
            {skillTaxonomy.map((s, i) => {
              const stats = profile.skills.find((v) => v.id === s.id)!;
              return (
                <button
                  key={s.id}
                  className={`lski-node ${stats.status}`}
                  style={
                    {
                      "--skill-x": `${positions[i][0]}%`,
                      "--skill-y": `${positions[i][1]}%`,
                    } as CSSProperties
                  }
                  aria-pressed={selected === s.id}
                  onClick={() => setSelected(s.id)}
                >
                  <span className="lski-node-dot" />
                  <strong>{name(s.id)}</strong>
                  <small>{c[stats.status]}</small>
                </button>
              );
            })}
          </div>
          <article
            className={`lski-detail ${current.status}`}
            data-skill-detail
          >
            <div className="lski-detail-title">
              <div>
                <span className="lm-overline">{c.inferred}</span>
                <h3>{name(selected)}</h3>
              </div>
              <span className="lski-status">{c[current.status]}</span>
            </div>
            <p className="lski-caution">{c.noMastery}</p>
            <div className="lski-stats" aria-label={c.observed}>
              <div>
                <strong>{current.independent}</strong>
                <span>{c.questions}</span>
              </div>
              <div>
                <strong>{current.days}</strong>
                <span>{c.days}</span>
              </div>
              <div>
                <strong>{current.spanDays}</strong>
                <span>{c.spacing}</span>
              </div>
              <div>
                <strong>
                  {current.correct}/{current.independent}
                </strong>
                <span>{c.score}</span>
              </div>
            </div>
            {current.independent === 0 ? (
              <p>{c.empty}</p>
            ) : (
              <>
                <p className="lm-help">
                  {current.repeated} {c.repeated} · {current.recentErrors}{" "}
                  {c.errors}
                </p>
                <div className="lski-levels">
                  <strong>{c.level}</strong>
                  {skillDifficulties.map((d) => (
                    <span key={d}>
                      {c[d]}{" "}
                      <b>
                        {current.levels[d].correct}/{current.levels[d].total}
                      </b>
                    </span>
                  ))}
                </div>
                <details className="lski-method">
                  <summary>
                    {c.interval}: {Math.round(current.interval[0] * 100)}–
                    {Math.round(current.interval[1] * 100)}%
                  </summary>
                  <p>{c.intervalHint}</p>
                </details>
              </>
            )}
            <p className="lm-help">{c.first}</p>
            <div className="lski-foundations">
              <h4>{c.prereqs}</h4>
              {current.prerequisites.length ? (
                <div>
                  {current.prerequisites.map((id) => (
                    <button
                      className="lm-button"
                      key={id}
                      onClick={() => setSelected(id)}
                    >
                      {name(id)}
                      <ChevronRight size={14} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="lm-help">{c.noPrereqs}</p>
              )}
            </div>
            <div className="lski-next">
              <h4>{c.next}</h4>
              {materials.length ? (
                materials.map((m) => (
                  <button
                    className="lm-button"
                    key={m.id}
                    onClick={() => open(m)}
                    aria-label={`${c.open}: ${m.title}`}
                  >
                    <span>{m.title}</span>
                    <ArrowUpRight size={16} />
                  </button>
                ))
              ) : (
                <p className="lm-help">{c.noMaterial}</p>
              )}
            </div>
          </article>
          {(profile.legacyAnswers > 0 ||
            profile.unclassified > 0 ||
            profile.invalidAttempts > 0) && (
            <p className="lski-exclusions">
              {profile.legacyAnswers > 0 && (
                <span>
                  {profile.legacyAnswers} {c.legacy}.
                </span>
              )}
              {profile.unclassified > 0 && (
                <span>
                  {profile.unclassified} {c.unclassified}.
                </span>
              )}
              {profile.invalidAttempts > 0 && (
                <span>
                  {profile.invalidAttempts} {c.invalid}.
                </span>
              )}
            </p>
          )}
          <details className="lski-method">
            <summary>{c.criteria}</summary>
            <p>{c.rules}</p>
            <p>{c.legacyNote}</p>
          </details>
        </>
      )}
    </section>
  );
}
