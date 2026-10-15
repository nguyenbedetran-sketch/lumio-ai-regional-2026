"use client";
import { useEffect, useId, useRef, useState, type Ref } from "react";
import {
  Plus,
  RotateCcw,
  Check,
  Trash2,
  ArrowRight,
  Layers,
  ClipboardCheck,
  ArrowLeft,
  CircleCheck,
  CircleX,
  Keyboard,
} from "lucide-react";
import {
  LearningItem,
  uid,
  type Question,
  type Flashcard,
} from "../../lib/lumio/types";
import type { Messages, Locale } from "../../lib/lumio/i18n";
import { MathText } from "./math-text";
import { SourceReferences } from "./source-references";
import { studyV3Copy } from "../../lib/lumio/study-v3-copy";
import {
  createSkillEvidence,
  type SkillDifficulty,
} from "../../lib/lumio/skill-evidence";
import {
  skillById,
  skillTaxonomy,
  skillLabel,
  type SkillId,
} from "../../lib/lumio/skill-taxonomy";
import { skillCopy } from "../../lib/lumio/skill-copy";
import {
  answeredQuizScore,
  quizChoiceForKey,
  quizSnapshot,
  shortcutMayRun,
} from "../../lib/lumio/study-v3";

export type FlashcardDrafts = {
  adding: boolean;
  front: string;
  back: string;
  index: number;
  flipped: boolean;
  reviewed: number;
  shownCard?: Flashcard;
};
export type QuizDrafts = {
  adding: boolean;
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
  active: boolean;
  index: number;
  selected: number | null;
  score: number;
  finished: boolean;
  session: Question[];
  answers: (number | null)[];
  skillChoice?: SkillId;
  difficultyChoice?: SkillDifficulty;
};

export function StudyFlipCard({
  front,
  back,
  flipped,
  onFlip,
  frontLabel,
  backLabel,
  hint,
  className = "",
  buttonRef,
  describedBy,
}: {
  front: string;
  back: string;
  flipped: boolean;
  onFlip: () => void;
  frontLabel: string;
  backLabel: string;
  hint: string;
  className?: string;
  buttonRef?: Ref<HTMLButtonElement>;
  describedBy?: string;
}) {
  return (
    <button
      type="button"
      ref={buttonRef}
      className={`lsv-flip-card ${className} ${flipped ? "is-flipped" : ""}`}
      onClick={onFlip}
      aria-pressed={flipped}
      aria-describedby={describedBy}
    >
      <span className="lsv-flip-inner">
        <span className="lsv-flip-face lsv-flip-front" aria-hidden={flipped}>
          <span className="lsv-face-label">{frontLabel}</span>
          <strong>
            <MathText text={front} inline />
          </strong>
          <span className="lsv-flip-hint">
            <RotateCcw size={15} />
            {hint}
          </span>
        </span>
        <span className="lsv-flip-face lsv-flip-back" aria-hidden={!flipped}>
          <span className="lsv-face-label">{backLabel}</span>
          <strong>
            <MathText text={back} inline />
          </strong>
          <span className="lsv-flip-hint">
            <RotateCcw size={15} />
            {hint}
          </span>
        </span>
      </span>
    </button>
  );
}
export function Flashcards({
  item,
  t,
  locale = "vi",
  update,
  drafts,
  onDraft,
}: {
  item: LearningItem;
  t: Messages;
  locale?: Locale;
  update: (item: LearningItem) => void;
  drafts?: FlashcardDrafts;
  onDraft?: (value: FlashcardDrafts) => void;
}) {
  const [adding, setAdding] = useState(drafts?.adding ?? false),
    [front, setFront] = useState(drafts?.front ?? ""),
    [back, setBack] = useState(drafts?.back ?? ""),
    [index, setIndex] = useState(drafts?.index ?? 0),
    [flipped, setFlipped] = useState(drafts?.flipped ?? false),
    [reviewed, setReviewed] = useState(drafts?.reviewed ?? 0);
  const c = studyV3Copy[locale],
    helpId = useId(),
    cardRef = useRef<HTMLButtonElement>(null);
  const card = item.cards[index % Math.max(item.cards.length, 1)];
  const previousCard = useRef(drafts?.shownCard ?? card);
  useEffect(() => {
    if (
      previousCard.current?.id !== card?.id ||
      previousCard.current?.front !== card?.front ||
      previousCard.current?.back !== card?.back
    )
      setFlipped(false);
    previousCard.current = card;
  }, [card]);
  useEffect(
    () =>
      onDraft?.({
        adding,
        front,
        back,
        index,
        flipped,
        reviewed,
        shownCard: card ? { ...card } : undefined,
      }),
    [adding, front, back, index, flipped, reviewed, card, onDraft],
  );
  function browse(offset: number) {
    setIndex(
      (old) =>
        (old + offset + item.cards.length) % Math.max(item.cards.length, 1),
    );
    setFlipped(false);
    cardRef.current?.focus({ preventScroll: true });
  }
  return (
    <div
      className="lm-study lsv-study"
      onKeyDown={(event) => {
        const editable =
          event.target instanceof HTMLElement &&
          !!event.target.closest(
            "input,textarea,select,[contenteditable='true']",
          );
        if (
          !card ||
          item.cards.length < 2 ||
          !shortcutMayRun(event, editable) ||
          (event.target instanceof HTMLElement &&
            event.target.closest("dialog,[role='dialog']"))
        )
          return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          browse(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}
    >
      <div className="lm-section-head">
        <h3>
          {t.cards} <span>{item.cards.length}</span>
        </h3>
        <button className="lm-button" onClick={() => setAdding(!adding)}>
          <Plus size={16} />
          {t.newCard}
        </button>
      </div>
      {adding && (
        <form
          className="lm-editor"
          onSubmit={(e) => {
            e.preventDefault();
            if (front.trim() && back.trim()) {
              update({
                ...item,
                cards: [
                  ...item.cards,
                  { id: uid(), front: front.trim(), back: back.trim() },
                ],
              });
              setFront("");
              setBack("");
              setAdding(false);
            }
          }}
        >
          <label className="lm-field">
            {t.front}
            <textarea
              value={front}
              maxLength={2000}
              required
              onChange={(e) => setFront(e.target.value)}
            />
          </label>
          <label className="lm-field">
            {t.back}
            <textarea
              value={back}
              maxLength={5000}
              required
              onChange={(e) => setBack(e.target.value)}
            />
          </label>
          <button className="lm-button primary">{t.saveCard}</button>
        </form>
      )}
      {card ? (
        <>
          <div className="lm-study-meta">
            <span>
              {(index % item.cards.length) + 1} / {item.cards.length}
            </span>
            <span>
              {t.reviewed}: {reviewed}
            </span>
            <button
              className="lm-icon"
              aria-label={t.deleteCard}
              onClick={() => {
                update({
                  ...item,
                  cards: item.cards.filter((c) => c.id !== card.id),
                });
                setFlipped(false);
                setIndex(0);
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
          <StudyFlipCard
            front={card.front}
            back={card.back}
            flipped={flipped}
            onFlip={() => setFlipped((old) => !old)}
            frontLabel={t.front}
            backLabel={t.back}
            hint={t.flip}
            buttonRef={cardRef}
            describedBy={helpId}
          />
          {flipped && (
            <SourceReferences
              references={card.references}
              source={item.text}
              evidence={item.sourceEvidence}
              item={item}
              locale={locale}
            />
          )}
          <div className="lsv-card-navigation">
            <button
              className="lm-button"
              disabled={item.cards.length < 2}
              onClick={() => browse(-1)}
              aria-label={c.previousCard}
            >
              <ArrowLeft size={16} />
              <span>{c.previousCard}</span>
            </button>
            <span role="status" className="lsv-card-position">
              {c.cardStatus} {(index % item.cards.length) + 1} /{" "}
              {item.cards.length}
            </span>
            <button
              className="lm-button"
              disabled={item.cards.length < 2}
              onClick={() => browse(1)}
              aria-label={c.nextCard}
            >
              <span>{c.nextCard}</span>
              <ArrowRight size={16} />
            </button>
          </div>
          <p className="lsv-keyboard-hint" id={helpId}>
            <Keyboard size={14} />
            {c.cardKeyboard}
          </p>
          <div className="lm-row lm-center">
            {flipped ? (
              <>
                <button
                  className="lm-button"
                  onClick={() => {
                    setFlipped(false);
                    setReviewed((old) => old + 1);
                    cardRef.current?.focus({ preventScroll: true });
                  }}
                >
                  {t.again}
                </button>
                <button
                  className="lm-button primary"
                  onClick={() => {
                    setFlipped(false);
                    setIndex((old) => old + 1);
                    setReviewed((old) => old + 1);
                    cardRef.current?.focus({ preventScroll: true });
                  }}
                >
                  <Check size={16} />
                  {t.known}
                </button>
              </>
            ) : (
              <button className="lm-button" onClick={() => setFlipped(true)}>
                {t.flip}
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="lm-empty compact">
          <Layers size={32} />
          <p>{t.emptyCards}</p>
        </div>
      )}
    </div>
  );
}
export function Quiz({
  item,
  t,
  locale,
  update,
  drafts,
  onDraft,
}: {
  item: LearningItem;
  t: Messages;
  locale: Locale;
  update: (item: LearningItem) => void;
  drafts?: QuizDrafts;
  onDraft?: (value: QuizDrafts) => void;
}) {
  const [adding, setAdding] = useState(drafts?.adding ?? false),
    [prompt, setPrompt] = useState(drafts?.prompt ?? ""),
    [options, setOptions] = useState(drafts?.options ?? ["", "", "", ""]),
    [correct, setCorrect] = useState(drafts?.correct ?? 0),
    [explanation, setExplanation] = useState(drafts?.explanation ?? ""),
    [active, setActive] = useState(drafts?.active ?? false),
    [index, setIndex] = useState(drafts?.index ?? 0),
    [selected, setSelected] = useState<number | null>(drafts?.selected ?? null),
    [score, setScore] = useState(drafts?.score ?? 0),
    [finished, setFinished] = useState(drafts?.finished ?? false),
    [session, setSession] = useState<Question[]>(drafts?.session ?? []),
    [answers, setAnswers] = useState<(number | null)[]>(drafts?.answers ?? []);
  const [skillChoice, setSkillChoice] = useState<SkillId | undefined>(
      drafts?.skillChoice,
    ),
    [difficultyChoice, setDifficultyChoice] = useState<SkillDifficulty>(
      drafts?.difficultyChoice ?? "unknown",
    );
  const sc = skillCopy[locale];
  const c = studyV3Copy[locale],
    quizHelpId = useId(),
    questionRef = useRef<HTMLHeadingElement>(null),
    resultRef = useRef<HTMLHeadingElement>(null),
    nextRef = useRef<HTMLButtonElement>(null),
    completionRef = useRef(drafts?.finished ?? false),
    answerLock = useRef(
      drafts?.selected !== undefined && drafts.selected !== null,
    ),
    nextLock = useRef(false);
  const q = session[index];
  useEffect(
    () =>
      onDraft?.({
        adding,
        prompt,
        options,
        correct,
        explanation,
        active,
        index,
        selected,
        score,
        finished,
        session,
        answers,
        skillChoice,
        difficultyChoice,
      }),
    [
      adding,
      prompt,
      options,
      correct,
      explanation,
      active,
      index,
      selected,
      score,
      finished,
      session,
      answers,
      skillChoice,
      difficultyChoice,
      onDraft,
    ],
  );
  useEffect(() => {
    nextLock.current = false;
  }, [index]);
  useEffect(() => {
    if (active && selected === null)
      questionRef.current?.focus({ preventScroll: true });
    if (active && selected !== null)
      nextRef.current?.focus({ preventScroll: true });
  }, [active, index, selected]);
  useEffect(() => {
    if (finished) resultRef.current?.focus({ preventScroll: true });
  }, [finished]);
  function choose(choice: number) {
    if (
      !q ||
      selected !== null ||
      answerLock.current ||
      choice < 0 ||
      choice >= q.options.length
    )
      return;
    answerLock.current = true;
    setSelected(choice);
    setAnswers((old) => old.map((value, i) => (i === index ? choice : value)));
  }
  function start() {
    const snapshot = quizSnapshot(item.questions);
    if (!snapshot.length) return;
    setSession(snapshot);
    setAnswers(snapshot.map(() => null));
    setActive(true);
    setAdding(false);
    setFinished(false);
    setIndex(0);
    setSelected(null);
    setScore(0);
    completionRef.current = false;
    answerLock.current = false;
    nextLock.current = false;
  }
  function next() {
    if (!q || selected === null || completionRef.current || nextLock.current)
      return;
    nextLock.current = true;
    const total = answeredQuizScore(session, answers);
    setScore(total);
    if (index + 1 === session.length) {
      completionRef.current = true;
      update({
        ...item,
        attempts: [
          ...item.attempts,
          {
            date: new Date().toISOString(),
            score: total,
            total: session.length,
            skillEvidence: createSkillEvidence(
              session,
              answers,
              item.attempts,
              uid(),
              { skillId: skillChoice, difficulty: difficultyChoice },
            ),
            answers: session.flatMap((question, questionIndex) => {
              const choice = answers[questionIndex];
              if (choice === null || !Number.isInteger(choice)) return [];
              return [
                {
                  questionId: question.id,
                  selected: choice,
                  correct: choice === question.correct,
                  ...(question.topic ? { topic: question.topic } : {}),
                },
              ];
            }),
          },
        ],
      });
      setFinished(true);
      setActive(false);
    } else {
      setIndex(index + 1);
      setSelected(null);
      answerLock.current = false;
    }
  }
  return (
    <div
      className="lm-study lsv-study lsv-quiz"
      onKeyDown={(event) => {
        const editable =
          event.target instanceof HTMLElement &&
          !!event.target.closest(
            "input,textarea,select,[contenteditable='true']",
          );
        if (
          !active ||
          selected !== null ||
          !q ||
          !shortcutMayRun(event, editable) ||
          (event.target instanceof HTMLElement &&
            event.target.closest("dialog,[role='dialog']"))
        )
          return;
        const choice = quizChoiceForKey(event.key, q.options.length);
        if (choice !== null) {
          event.preventDefault();
          choose(choice);
        }
      }}
    >
      <div className="lm-section-head">
        <h3>
          {t.quiz} <span>{item.questions.length}</span>
        </h3>
        {!active && (
          <button className="lm-button" onClick={() => setAdding(!adding)}>
            <Plus size={16} />
            {t.newQuestion}
          </button>
        )}
      </div>
      {adding && (
        <form
          className="lm-editor"
          onSubmit={(e) => {
            e.preventDefault();
            if (prompt.trim() && options.every((o) => o.trim())) {
              update({
                ...item,
                questions: [
                  ...item.questions,
                  {
                    id: uid(),
                    prompt: prompt.trim(),
                    options: options.map((o) => o.trim()),
                    correct,
                    explanation: explanation.trim(),
                  },
                ],
              });
              setAdding(false);
              setPrompt("");
              setOptions(["", "", "", ""]);
              setExplanation("");
            }
          }}
        >
          <label className="lm-field">
            {t.question}
            <textarea
              required
              maxLength={2000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          {options.map((o, i) => (
            <label className="lm-field" key={i}>
              {t.option} {i + 1}
              <input
                required
                maxLength={1000}
                value={o}
                onChange={(e) =>
                  setOptions(
                    options.map((v, j) => (i === j ? e.target.value : v)),
                  )
                }
              />
            </label>
          ))}
          <label className="lm-field">
            {t.correct}
            <select
              value={correct}
              onChange={(e) => setCorrect(Number(e.target.value))}
            >
              {options.map((_, i) => (
                <option value={i} key={i}>
                  {t.option} {i + 1}
                </option>
              ))}
            </select>
          </label>
          <label className="lm-field">
            {t.explanation}
            <textarea
              maxLength={5000}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
            />
          </label>
          <button className="lm-button primary">{t.saveQuestion}</button>
        </form>
      )}
      {active && q ? (
        <>
          <div className="lm-study-meta">
            <span>
              {t.question} {index + 1} / {session.length}
            </span>
            <span>
              {c.answered} {index + (selected !== null ? 1 : 0)} /{" "}
              {session.length}
            </span>
          </div>
          <progress
            aria-label={t.progress}
            value={index + (selected !== null ? 1 : 0)}
            max={session.length}
            title={c.progressHint}
          />
          <h2 className="lm-question" ref={questionRef} tabIndex={-1}>
            <MathText text={q.prompt} inline />
          </h2>
          <p className="lsv-keyboard-hint" id={quizHelpId}>
            <Keyboard size={14} />
            {c.quizKeyboard}
          </p>
          <div className="lm-answers" aria-describedby={quizHelpId}>
            {q.options.map((o, i) => (
              <button
                key={i}
                disabled={selected !== null}
                className={
                  selected !== null && q.correct === i
                    ? "correct"
                    : selected === i
                      ? "incorrect"
                      : ""
                }
                onClick={() => choose(i)}
              >
                <span className="lm-answer-letter">
                  {String.fromCharCode(65 + i)}
                </span>
                <MathText text={o} inline />
                {selected !== null && q.correct === i && <Check size={18} />}
                {selected === i && q.correct !== i && <CircleX size={18} />}
              </button>
            ))}
          </div>
          {selected !== null && (
            <>
              <div
                className={`lm-feedback lsv-quiz-feedback ${selected === q.correct ? "is-correct" : "is-learning"}`}
                role="status"
                aria-live="polite"
              >
                <div className="lsv-feedback-title">
                  {selected === q.correct ? (
                    <CircleCheck size={23} />
                  ) : (
                    <CircleX size={23} />
                  )}
                  <strong>
                    {selected === q.correct
                      ? c.correctAnswer
                      : c.incorrectAnswer}
                  </strong>
                </div>
                <strong>
                  {c.correctOption}:{" "}
                  <MathText text={q.options[q.correct]} inline />
                </strong>
                {q.explanation && (
                  <p>
                    <MathText text={q.explanation} inline />
                  </p>
                )}
                <SourceReferences
                  references={q.references}
                  source={item.text}
                  evidence={item.sourceEvidence}
                  item={item}
                  locale={locale}
                />
              </div>
              <button
                className="lm-button primary"
                ref={nextRef}
                onClick={next}
              >
                {index + 1 === session.length ? t.result : t.next}
                <ArrowRight size={16} />
              </button>
            </>
          )}
        </>
      ) : finished ? (
        <>
          <div className="lm-quiz-result lsv-quiz-result" role="status">
            <div
              className="lsv-result-ring"
              style={
                {
                  "--lsv-score": `${session.length ? Math.round((score / session.length) * 100) : 0}%`,
                } as React.CSSProperties
              }
            >
              <span>
                {score}
                <small> / {session.length}</small>
              </span>
            </div>
            <h2 ref={resultRef} tabIndex={-1}>
              {t.quizDone}
            </h2>
            <p>
              {c.accuracy}:{" "}
              {session.length ? Math.round((score / session.length) * 100) : 0}%
              · {c.answered} {session.length}
            </p>
            <p className="lsv-result-caption">{c.resultHint}</p>
            {score === session.length && <p>{c.allCorrect}</p>}
            <button className="lm-button primary" onClick={start}>
              {c.retryAll}
              <RotateCcw size={16} />
            </button>
          </div>
          <details className="lsv-answer-review" open={score < session.length}>
            <summary>
              {c.reviewAnswers}
              <span>
                {session.length - score} {c.missed.toLowerCase()}
              </span>
            </summary>
            <div>
              {session.map((question, i) => (
                <article
                  key={`${i}:${question.id}`}
                  className={
                    answers[i] === question.correct
                      ? "is-correct"
                      : "is-learning"
                  }
                >
                  <div className="lsv-review-question">
                    {answers[i] === question.correct ? (
                      <CircleCheck size={18} />
                    ) : (
                      <CircleX size={18} />
                    )}
                    <strong>
                      {i + 1}. <MathText text={question.prompt} inline />
                    </strong>
                  </div>
                  <p>
                    <span>{c.yourAnswer}: </span>
                    <MathText
                      text={question.options[answers[i] ?? -1] || "—"}
                      inline
                    />
                  </p>
                  {answers[i] !== question.correct && (
                    <p>
                      <span>{c.correctOption}: </span>
                      <MathText
                        text={question.options[question.correct]}
                        inline
                      />
                    </p>
                  )}
                  <p className="lsv-review-explanation">
                    <MathText
                      text={question.explanation || c.noExplanation}
                      inline
                    />
                  </p>
                </article>
              ))}
            </div>
          </details>
        </>
      ) : item.questions.length ? (
        <>
          <p className="lm-help">
            {item.questions.length} {t.questionCount} · {t.manual}
          </p>
          <fieldset className="lski-quiz-scope">
            <legend>{sc.quizScope}</legend>
            <label>
              {sc.graph}
              <select
                value={skillChoice || ""}
                onChange={(e) => setSkillChoice(skillById(e.target.value)?.id)}
              >
                <option value="">{sc.auto}</option>
                {skillTaxonomy.map((s) => (
                  <option key={s.id} value={s.id}>
                    {skillLabel(s.id, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {sc.level}
              <select
                value={difficultyChoice}
                onChange={(e) =>
                  setDifficultyChoice(e.target.value as SkillDifficulty)
                }
              >
                <option value="unknown">{sc.difficultyAuto}</option>
                {(["beginner", "intermediate", "advanced"] as const).map(
                  (d) => (
                    <option key={d} value={d}>
                      {sc[d]}
                    </option>
                  ),
                )}
              </select>
            </label>
            <p className="lm-help">{sc.quizHint}</p>
          </fieldset>
          <button className="lm-button primary" onClick={start}>
            <ClipboardCheck size={17} />
            {t.startQuiz}
          </button>
          <div className="lm-question-list">
            {item.questions.map((question, i) => (
              <div key={question.id}>
                <span>
                  {i + 1}. <MathText text={question.prompt} inline />
                </span>
                <button
                  className="lm-icon"
                  aria-label={`${t.deleteQuestion} ${i + 1}`}
                  onClick={() =>
                    update({
                      ...item,
                      questions: item.questions.filter(
                        (q) => q.id !== question.id,
                      ),
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="lm-empty compact">
          <ClipboardCheck size={32} />
          <p>{t.emptyQuiz}</p>
        </div>
      )}
      {!active && item.attempts.length > 0 && (
        <div className="lm-attempts">
          <h4>{t.attempts}</h4>
          {item.attempts
            .slice(-5)
            .reverse()
            .map((a, i) => (
              <div key={i}>
                <span>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(a.date))}
                </span>
                <strong>
                  {a.score}/{a.total}
                </strong>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
