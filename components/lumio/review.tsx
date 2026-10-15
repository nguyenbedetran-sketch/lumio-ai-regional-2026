"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Layers, ArrowRight, Check, BookOpen, Keyboard } from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import type { LearningItem } from "../../lib/lumio/types";
import {
  cardKey,
  dueCards,
  scheduleReview,
  type LearningState,
  type ReviewRating,
} from "../../lib/lumio/learning-engine";
import { learningCopy } from "../../lib/lumio/learning-copy";
import { studyV3Copy } from "../../lib/lumio/study-v3-copy";
import { reviewRatingForKey, shortcutMayRun } from "../../lib/lumio/study-v3";
import { StudyFlipCard } from "./study-tools";
import { SourceReferences } from "./source-references";
export function Review({
  locale,
  items,
  state,
  update,
  library,
  open,
}: {
  locale: Locale;
  items: LearningItem[];
  state: LearningState;
  update: (fn: (old: LearningState) => LearningState) => void;
  library: () => void;
  open: (item: LearningItem) => void;
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
  const scheduled = state.reviews
    .filter((r) =>
      items.some(
        (i) =>
          i.id === r.itemId &&
          i.cards.some((c) => cardKey(i.id, c.id) === r.key),
      ),
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
            const item = items.find((i) => i.id === r.itemId)!,
              card = item.cards.find((c) => c.id === r.cardId)!;
            return (
              <div key={r.key}>
                <span>
                  <strong>{card.front}</strong>
                  <small>{item.title}</small>
                </span>
                <span>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(r.dueAt))}
                </span>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
