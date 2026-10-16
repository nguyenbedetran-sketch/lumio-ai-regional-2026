"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Layers, ArrowRight, Check, BookOpen, Keyboard } from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import type { LearningItem } from "../../lib/lumio/types";
import {
  cardKey,
  dueCards,
  scheduleReview,
  cardFingerprint,
  setReviewSchedule,
  clearReviewSchedule,
  type LearningState,
  type ReviewRating,
} from "../../lib/lumio/learning-engine";
import { learningCopy } from "../../lib/lumio/learning-copy";
import { studyV3Copy } from "../../lib/lumio/study-v3-copy";
import { reviewRatingForKey, shortcutMayRun } from "../../lib/lumio/study-v3";
import { StudyFlipCard } from "./study-tools";
import { SourceReferences } from "./source-references";
import { learningPlanCopy } from "../../lib/lumio/learning-plan-copy";
function ReviewScheduleControl({
  card,
  state,
  update,
  locale,
  disabled = false,
}: {
  card: { itemId: string; cardId: string; fingerprint: string };
  state: LearningState;
  update: (fn: (old: LearningState) => LearningState) => void;
  locale: Locale;
  disabled?: boolean;
}) {
  const c = learningPlanCopy[locale],
    id = useId(),
    [when, setWhen] = useState(""),
    [notice, setNotice] = useState("");
  const chosen = state.reviewOverrides?.some(
    (r) =>
      r.key === cardKey(card.itemId, card.cardId) &&
      r.fingerprint === card.fingerprint,
  );
  function schedule(date: Date) {
    try {
      const now = new Date();
      if (
        !Number.isFinite(date.getTime()) ||
        date.getTime() < now.getTime() ||
        date.getTime() - now.getTime() > 365 * 86400000
      )
        throw Error();
      update((old) => setReviewSchedule(old, card, date, now));
      setNotice(c.scheduled);
    } catch {
      setNotice(c.invalidDate);
    }
  }
  return (
    <details className="lski-method" data-review-schedule-control>
      <summary>{c.manualTitle}</summary>
      <p className="lm-help">{c.manualHint}</p>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "end",
        }}
      >
        <button
          className="lm-button"
          disabled={disabled}
          onClick={() => schedule(new Date(Date.now() + 86400000))}
        >
          {c.tomorrow}
        </button>
        <label
          htmlFor={id}
          style={{ display: "grid", gap: 6, maxWidth: "100%" }}
        >
          {c.date}
          <input
            id={id}
            type="datetime-local"
            value={when}
            disabled={disabled}
            onChange={(e) => setWhen(e.target.value)}
            style={{ maxWidth: "100%", minHeight: 44, padding: 8 }}
          />
        </label>
        <button
          className="lm-button"
          disabled={disabled || !when}
          onClick={() => schedule(new Date(when))}
        >
          {c.apply}
        </button>
        {chosen && (
          <button
            className="lm-button"
            disabled={disabled}
            onClick={() => {
              update((old) =>
                clearReviewSchedule(old, cardKey(card.itemId, card.cardId)),
              );
              setNotice(c.reset);
            }}
          >
            {c.clear}
          </button>
        )}
      </div>
      <p role="status" className="lm-help">
        {disabled && notice ? c.unsavedSchedule : notice}
      </p>
    </details>
  );
}
export function Review({
  locale,
  items,
  state,
  update,
  library,
  open,
  storageError = false,
}: {
  locale: Locale;
  items: LearningItem[];
  state: LearningState;
  update: (fn: (old: LearningState) => LearningState) => void;
  library: () => void;
  open: (item: LearningItem) => void;
  storageError?: boolean;
}) {
  const c = learningCopy[locale],
    [revealed, setRevealed] = useState(false),
    [now, setNow] = useState(() => new Date()),
    [count, setCount] = useState(0),
    queue = dueCards(items, state, now),
    current = queue[0],
    total = items.reduce((sum, i) => sum + i.cards.length, 0);
  const sc = studyV3Copy[locale],
    helpId = useId(),
    cardRef = useRef<HTMLButtonElement>(null),
    ratingLock = useRef(false);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    setRevealed(false);
    ratingLock.current = false;
    if (count > 0) cardRef.current?.focus({ preventScroll: true });
  }, [current?.card.id, current?.item.id, current?.fingerprint]);
  function rate(rating: ReviewRating) {
    if (!current || !revealed || ratingLock.current) return;
    ratingLock.current = true;
    const at = new Date(),
      next = scheduleReview(
        current.review,
        rating,
        {
          itemId: current.item.id,
          cardId: current.card.id,
          fingerprint: current.fingerprint,
        },
        at,
      );
    update((old) => ({
      ...old,
      reviews: [...old.reviews.filter((r) => r.key !== next.key), next],
      ...(old.reviewOverrides
        ? {
            reviewOverrides: old.reviewOverrides.filter(
              (r) => r.key !== next.key,
            ),
          }
        : {}),
      events: [
        ...old.events,
        {
          id: crypto.randomUUID(),
          at: at.toISOString(),
          kind: "review" as const,
          rating,
          itemId: current.item.id,
        },
      ].slice(-10000),
    }));
    setRevealed(false);
    setCount((n) => n + 1);
    setNow(at);
  }
  const scheduled = items
    .flatMap((item) =>
      item.cards.flatMap((card) => {
        const key = cardKey(item.id, card.id),
          fingerprint = cardFingerprint(card.front, card.back),
          review = state.reviews.find(
            (r) => r.key === key && r.fingerprint === fingerprint,
          ),
          override = state.reviewOverrides?.find(
            (r) => r.key === key && r.fingerprint === fingerprint,
          ),
          dueAt = override?.dueAt || review?.dueAt;
        return dueAt
          ? [{ key, item, card, fingerprint, dueAt, manual: !!override }]
          : [];
      }),
    )
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 8);
  return (
    <div className="lx-page lx-review-page lsv-review-page">
      <div className="lx-page-title">
        <div>
          <span className="lx-kicker">LUMIO / {c.review}</span>
          <h1>{c.reviewDone}</h1>
          <p>{c.reviewHint}</p>
        </div>
        <span className="lx-title-symbol">
          <Layers size={30} />
        </span>
      </div>
      <div className="lx-review-stats">
        <span>
          <strong>{queue.length}</strong>
          {c.due}
        </span>
        <span aria-live="polite" aria-atomic="true">
          <strong>{count}</strong>
          {c.reviewed}
        </span>
        <span>
          <strong>{total}</strong>
          {c.allCards}
        </span>
      </div>
      {storageError && (
        <p role="alert" className="lm-help" data-review-storage-warning>
          {learningPlanCopy[locale].unsavedSchedule}
        </p>
      )}
      {current ? (
        <section
          className="lx-review-session"
          onKeyDown={(event) => {
            const editable =
              event.target instanceof HTMLElement &&
              !!event.target.closest(
                "input,textarea,select,[contenteditable='true']",
              );
            if (
              !revealed ||
              !shortcutMayRun(event, editable) ||
              (event.target instanceof HTMLElement &&
                event.target.closest("dialog,[role='dialog']"))
            )
              return;
            const rating = reviewRatingForKey(event.key);
            if (rating) {
              event.preventDefault();
              rate(rating);
            }
          }}
        >
          <div className="lx-card-heading">
            <button
              className="lx-text-button"
              onClick={() => open(current.item)}
            >
              <BookOpen size={15} />
              {current.item.title}
            </button>
            <span>{c.reviewSource}</span>
          </div>
          <ReviewScheduleControl
            key={`${current.item.id}:${current.card.id}:${current.fingerprint}`}
            card={{
              itemId: current.item.id,
              cardId: current.card.id,
              fingerprint: current.fingerprint,
            }}
            state={state}
            update={update}
            locale={locale}
            disabled={storageError}
          />
          <StudyFlipCard
            front={current.card.front}
            back={current.card.back}
            flipped={revealed}
            onFlip={() => setRevealed((v) => !v)}
            frontLabel={sc.questionSide}
            backLabel={sc.answerSide}
            hint={revealed ? c.recall : c.reveal}
            className="lsv-review-card"
            buttonRef={cardRef}
            describedBy={helpId}
          />
          {revealed && (
            <SourceReferences
              references={current.card.references}
              source={current.item.text}
              evidence={current.item.sourceEvidence}
              item={current.item}
              locale={locale}
              onOpenSource={() => open(current.item)}
            />
          )}
          <p className="lsv-keyboard-hint" id={helpId}>
            <Keyboard size={14} />
            {sc.reviewKeyboard}
          </p>
          {revealed ? (
            <div className="lx-rating-grid">
              {(["again", "hard", "good", "easy"] as const).map(
                (rating, index) => {
                  const next = scheduleReview(
                    current.review,
                    rating,
                    {
                      itemId: current.item.id,
                      cardId: current.card.id,
                      fingerprint: current.fingerprint,
                    },
                    now,
                  );
                  return (
                    <button
                      key={rating}
                      className={rating}
                      onClick={() => rate(rating)}
                    >
                      <kbd aria-hidden="true">{index + 1}</kbd>
                      <strong>{c[rating]}</strong>
                      <small>
                        {rating === "again"
                          ? c.tenMinutes
                          : `${next.interval} ${next.interval === 1 ? c.day : c.days}`}
                      </small>
                    </button>
                  );
                },
              )}
            </div>
          ) : (
            <button
              className="lm-button primary lx-reveal-button"
              onClick={() => {
                setRevealed(true);
                cardRef.current?.focus({ preventScroll: true });
              }}
            >
              {c.reveal}
              <ArrowRight size={17} />
            </button>
          )}
        </section>
      ) : (
        <section className="lx-empty-state">
          <span className="lx-review-done-symbol">
            {total ? <Check size={38} /> : <Layers size={38} />}
          </span>
          <h2>{total ? c.dueEmpty : c.noCards}</h2>
          <p>{total ? c.reviewDoneHint : c.noCardsHint}</p>
          <button className="lm-button" onClick={library}>
            {c.library}
            <ArrowRight size={16} />
          </button>
        </section>
      )}
      {scheduled.length > 0 && (
        <section className="lx-card lx-schedule">
          <h2>{c.reviewSchedule}</h2>
          <p className="lx-caption">{c.reviewAlgorithm}</p>
          {scheduled.map((r) => {
            const { item, card } = r;
            return (
              <div key={r.key} style={{ display: "block", minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    minWidth: 0,
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <strong>{card.front}</strong>
                    <small>{item.title}</small>
                  </span>
                  <span>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(r.dueAt))}
                    {r.manual && (
                      <small>{learningPlanCopy[locale].manual}</small>
                    )}
                  </span>
                </div>
                {(!current ||
                  r.key !== cardKey(current.item.id, current.card.id)) && (
                  <ReviewScheduleControl
                    card={{
                      itemId: item.id,
                      cardId: card.id,
                      fingerprint: r.fingerprint,
                    }}
                    state={state}
                    update={update}
                    locale={locale}
                    disabled={storageError}
                  />
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
