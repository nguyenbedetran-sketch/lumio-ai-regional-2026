"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "../../lib/lumio/i18n";
import {
  defaultRecommendationControls,
  type Preferences,
  type RecommendationControls,
} from "../../lib/lumio/recommendations";
import { recommendationCopy } from "../../lib/lumio/recommendation-copy";
import { studySetupCopy } from "../../lib/lumio/study-setup-copy";
import { studyControls } from "../../lib/lumio/study-setup";
import { useDraft } from "../shared/draft-guard";

/** One shared editor for first-run setup and the existing For you controls. */
export function StudyPreferenceForm({
  locale,
  preferences,
  update,
  storageError = false,
  onSaved,
}: {
  locale: Locale;
  preferences: Preferences;
  update: (fn: (p: Preferences) => Preferences) => void;
  storageError?: boolean;
  onSaved?: () => void;
}) {
  const c = recommendationCopy[locale],
    controls = preferences.controls || defaultRecommendationControls(),
    [notice, setNotice] = useState(""),
    [pending, setPending] = useState<RecommendationControls | null>(null),
    form = useRef<HTMLFormElement>(null),
    draft = useDraft(c.controls, false, () => form.current?.reset());
  useEffect(() => {
    if (
      pending &&
      !storageError &&
      JSON.stringify(preferences.controls) === JSON.stringify(pending)
    ) {
      setPending(null);
      setNotice(c.saved);
      draft.markClean();
      onSaved?.();
    }
  }, [pending, preferences.controls, storageError, c.saved, draft, onSaved]);
  return (
    <form
      ref={form}
      className="lm-personal-settings"
      key={JSON.stringify(controls)}
      data-study-preferences
      onChange={() => {
        draft.markDirty();
        setNotice("");
      }}
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const values = new FormData(event.currentTarget),
            next = studyControls({
              topics: values.get("topics"),
              difficulty: values.get("difficulty"),
              goal: values.get("goal"),
            });
          setPending(next);
          setNotice("");
          update((p) => ({ ...p, controls: next }));
        } catch {
          setNotice(c.settingsError);
        }
      }}
    >
      <h2>{c.controls}</h2>
      <label>
        {c.goal}
        <select
          name="goal"
          defaultValue={controls.goal}
          disabled={!preferences.enabled || storageError}
        >
          {(["balanced", "review", "practice", "explore"] as const).map((v) => (
            <option key={v} value={v}>
              {c[v]}
            </option>
          ))}
        </select>
      </label>
      <label>
        {c.difficulty}
        <select
          name="difficulty"
          defaultValue={controls.difficulty}
          disabled={!preferences.enabled || storageError}
        >
          {(["any", "beginner", "intermediate", "advanced"] as const).map(
            (v) => (
              <option key={v} value={v}>
                {c[v]}
              </option>
            ),
          )}
        </select>
      </label>
      <label className="lm-personal-topics">
        {c.topics}
        <input
          name="topics"
          defaultValue={controls.topics.join(", ")}
          maxLength={650}
          disabled={!preferences.enabled || storageError}
        />
        <small>{c.topicsHint}</small>
      </label>
      <button
        className="lm-button"
        type="submit"
        disabled={!preferences.enabled || storageError}
      >
        {c.save}
      </button>
      {(storageError || notice) && (
        <p
          className={storageError ? "lm-error" : "lm-help"}
          role={storageError ? "alert" : "status"}
        >
          {storageError ? studySetupCopy[locale].error : notice}
        </p>
      )}
    </form>
  );
}
