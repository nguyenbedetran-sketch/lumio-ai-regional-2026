import type { LearningItem } from "./types";

export type ReviewRating = "again" | "hard" | "good" | "easy";
export type StudyTask = {
  id: string;
  title: string;
  date: string;
  minutes: number;
  itemId: string;
  done: boolean;
  completedAt?: string;
  createdAt: string;
};
export type ReviewState = {
  key: string;
  itemId: string;
  cardId: string;
  fingerprint: string;
  interval: number;
  ease: number;
  repetitions: number;
  reviewedAt: string;
  dueAt: string;
};
export type LearningEvent = {
  id: string;
  at: string;
  kind: "review" | "focus" | "goal" | StudyActivity;
  /** Local calendar date when activity happened, retained across time zone changes. */
  localDay?: string;
  minutes?: number;
  rating?: ReviewRating;
  itemId?: string;
};
export type StudyActivity = "read" | "chat" | "summary" | "notes" | "quiz";
export type AlarmPreset = "chime" | "bell" | "forest" | "custom" | "silent";
export type AlarmSettings = {
  preset: AlarmPreset;
  volume: number;
  customName?: string;
};
export const defaultAlarm: AlarmSettings = { preset: "chime", volume: 0.65 };
export type FocusState = {
  id: string;
  seconds: number;
  remaining: number;
  deadline: number | null;
};
export type LearningState = {
  version: 1;
  tasks: StudyTask[];
  reviews: ReviewState[];
  events: LearningEvent[];
  focus: FocusState | null;
  /** Optional so all version-1 backups remain readable. Custom audio stays in IndexedDB. */
  alarm?: AlarmSettings;
  lastAlarmId?: string;
};
export const emptyLearning = (): LearningState => ({
  version: 1,
  tasks: [],
  reviews: [],
  events: [],
  focus: null,
});
export function dayKey(date: Date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function shiftDay(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  return dayKey(new Date(year, month - 1, day + days, 12));
}
function isDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
function isDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [y, m, d] = value.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d, 12)) === value;
}
function string(value: unknown, max = 200) {
  return typeof value === "string" && value.length <= max;
}
function number(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
/** Reject corrupt backups instead of silently manufacturing progress. */
export function parseLearning(value: unknown): LearningState {
  if (
    !object(value) ||
    value.version !== 1 ||
    !Array.isArray(value.tasks) ||
    !Array.isArray(value.reviews) ||
    !Array.isArray(value.events)
  )
    throw new Error("INVALID_LEARNING_DATA");
  if (
    value.tasks.length > 2000 ||
    value.reviews.length > 20000 ||
    value.events.length > 10000
  )
    throw new Error("LEARNING_LIMIT");
  if (value.lastAlarmId !== undefined && !string(value.lastAlarmId, 100))
    throw new Error("INVALID_ALARM_RECEIPT");
  const ids = new Set<string>();
  for (const task of value.tasks) {
    if (
      !object(task) ||
      !string(task.id, 100) ||
      ids.has(task.id as string) ||
      !string(task.title) ||
      !String(task.title).trim() ||
      !isDay(task.date) ||
      !number(task.minutes, 5, 240) ||
      !Number.isInteger(task.minutes) ||
      !string(task.itemId, 100) ||
      typeof task.done !== "boolean" ||
      !isDate(task.createdAt) ||
      (task.completedAt !== undefined && !isDate(task.completedAt))
    )
      throw new Error("INVALID_TASK");
    ids.add(task.id as string);
  }
  const keys = new Set<string>();
  for (const review of value.reviews) {
    if (
      !object(review) ||
      !string(review.key, 250) ||
      keys.has(review.key as string) ||
      !string(review.itemId, 100) ||
      !string(review.cardId, 100) ||
      !string(review.fingerprint, 30) ||
      !number(review.interval, 0, 3650) ||
      !number(review.ease, 1.3, 3.5) ||
      !number(review.repetitions, 0, 100000) ||
      !isDate(review.reviewedAt) ||
      !isDate(review.dueAt)
    )
      throw new Error("INVALID_REVIEW");
    keys.add(review.key as string);
  }
  for (const event of value.events) {
    if (
      !object(event) ||
      !string(event.id, 100) ||
      !isDate(event.at) ||
      ![
        "review",
        "focus",
        "goal",
        "read",
        "chat",
        "summary",
        "notes",
        "quiz",
      ].includes(String(event.kind)) ||
      (event.localDay !== undefined && !isDay(event.localDay)) ||
      (event.itemId !== undefined && !string(event.itemId, 100)) ||
      (event.minutes !== undefined && !number(event.minutes, 0, 240)) ||
      (event.rating !== undefined &&
        !["again", "hard", "good", "easy"].includes(String(event.rating)))
    )
      throw new Error("INVALID_EVENT");
  }
  if (
    value.alarm !== undefined &&
    (!object(value.alarm) ||
      !["chime", "bell", "forest", "custom", "silent"].includes(
        String(value.alarm.preset),
      ) ||
      !number(value.alarm.volume, 0, 1) ||
      (value.alarm.customName !== undefined &&
        !string(value.alarm.customName, 180)))
  )
    throw new Error("INVALID_ALARM");
  if (value.focus !== null) {
    const f = value.focus;
    if (
      !object(f) ||
      !string(f.id, 100) ||
      !number(f.seconds, 300, 5400) ||
      !number(f.remaining, 0, 5400) ||
      !Number.isInteger(f.seconds) ||
      !Number.isInteger(f.remaining) ||
      f.remaining > f.seconds ||
      (f.deadline !== null && !number(f.deadline, 0, 8640000000000000))
    )
      throw new Error("INVALID_FOCUS");
  }
  return value as unknown as LearningState;
}
/** Successful learning interactions only. Opening the app or signing in never calls this. */
export function recordStudyActivity(
  state: LearningState,
  kind: StudyActivity,
  itemId: string,
  now = new Date(),
): LearningState {
  if (
    !itemId.trim() ||
    itemId.length > 100 ||
    !["read", "chat", "summary", "notes", "quiz"].includes(kind)
  )
    return state;
  const localDay = dayKey(now);
  // One interaction type per material per day. Re-renders, repeated saves and tab switches cannot inflate it.
  if (
    state.events.some(
      (e) =>
        e.kind === kind &&
        e.itemId === itemId &&
        (e.localDay || dayKey(new Date(e.at))) === localDay,
    )
  )
    return state;
  const event: LearningEvent = {
    id: `activity:${kind}:${localDay}:${cardFingerprint(itemId, "")}`,
    kind,
    itemId,
    at: now.toISOString(),
    localDay,
  };
  return { ...state, events: [...state.events, event].slice(-10000) };
}
/** A paused, reset or already completed timer cannot produce another completion. */
export function finishFocus(
  state: LearningState,
  expectedId: string,
  now = Date.now(),
): LearningState {
  const focus = state.focus;
  if (
    !focus ||
    focus.id !== expectedId ||
    focus.deadline === null ||
    focus.deadline > now
  )
    return state;
  const completed = new Date(focus.deadline);
  return {
    ...state,
    focus: null,
    events: state.events.some((e) => e.id === focus.id)
      ? state.events
      : [
          ...state.events,
          {
            id: focus.id,
            kind: "focus" as const,
            at: completed.toISOString(),
            localDay: dayKey(completed),
            minutes: focus.seconds / 60,
          },
        ].slice(-10000),
  };
}
export function learningKey(account: string) {
  return `lumio-learning-v1:${encodeURIComponent(account)}`;
}
export function cardFingerprint(front: string, back: string) {
  let hash = 2166136261;
  for (const char of `${front}\0${back}`)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}
export const cardKey = (itemId: string, cardId: string) =>
  `${itemId}:${cardId}`;
/** A transparent interval scheduler inspired by SM-2. Does not claim mastery. */
export function scheduleReview(
  previous: ReviewState | undefined,
  rating: ReviewRating,
  card: { itemId: string; cardId: string; fingerprint: string },
  now = new Date(),
): ReviewState {
  const prior =
    previous?.fingerprint === card.fingerprint ? previous : undefined;
  const ease = Math.max(
    1.3,
    Math.min(
      3.5,
      (prior?.ease ?? 2.5) +
        { again: -0.2, hard: -0.15, good: 0, easy: 0.15 }[rating],
    ),
  );
  const repetitions = rating === "again" ? 0 : (prior?.repetitions ?? 0) + 1;
  const interval =
    rating === "again"
      ? 0
      : rating === "hard"
        ? Math.max(1, Math.round((prior?.interval ?? 0) * 1.2))
        : rating === "easy"
          ? Math.max(4, Math.round((prior?.interval ?? 0) * ease * 1.3))
          : repetitions === 1
            ? 1
            : repetitions === 2
              ? 3
              : Math.max(1, Math.round((prior?.interval ?? 1) * ease));
  const bounded = Math.min(3650, interval);
  return {
    ...card,
    key: cardKey(card.itemId, card.cardId),
    ease,
    repetitions,
    interval: bounded,
    reviewedAt: now.toISOString(),
    dueAt: new Date(
      now.getTime() + (rating === "again" ? 10 * 60000 : bounded * 86400000),
    ).toISOString(),
  };
}
export function dueCards(
  items: LearningItem[],
  state: LearningState,
  now = new Date(),
) {
  const reviews = new Map(state.reviews.map((r) => [r.key, r]));
  return items
    .flatMap((item) =>
      item.cards
        .filter((c) => c.front.trim() && c.back.trim())
        .map((card) => {
          const fingerprint = cardFingerprint(card.front, card.back),
            saved = reviews.get(cardKey(item.id, card.id));
          const review = saved?.fingerprint === fingerprint ? saved : undefined;
          return { item, card, fingerprint, review };
        }),
    )
    .filter((c) => !c.review || Date.parse(c.review.dueAt) <= now.getTime())
    .sort(
      (a, b) =>
        (a.review ? Date.parse(a.review.dueAt) : 0) -
        (b.review ? Date.parse(b.review.dueAt) : 0),
    );
}
export function learningMetrics(
  items: LearningItem[],
  state: LearningState,
  now = new Date(),
) {
  const attempts = items
    .flatMap((item) =>
      item.attempts.map((a) => ({ ...a, itemId: item.id, title: item.title })),
    )
    .filter(
      (a) =>
        a.total > 0 &&
        a.score >= 0 &&
        a.score <= a.total &&
        isDate(a.date) &&
        Date.parse(a.date) <= now.getTime(),
    );
  const correct = attempts.reduce((n, a) => n + a.score, 0),
    total = attempts.reduce((n, a) => n + a.total, 0);
  const eventDay = (e: LearningEvent) => e.localDay || dayKey(new Date(e.at));
  const events = [
    ...new Map(
      state.events
        .filter((event) => Date.parse(event.at) <= now.getTime())
        .map((event) => [event.id, event]),
    ).values(),
  ];
  const summaryDays = new Set(
    events
      .filter((e) => e.kind === "summary")
      .map((e) => `${e.itemId}:${eventDay(e)}`),
  );
  // Earlier versions saved real summaries before they recorded activity events. Reuse that evidence without changing their data.
  for (const item of items)
    for (const artifact of item.artifacts || []) {
      if (
        artifact.kind !== "summary" ||
        !artifact.summary?.overview?.trim() ||
        !isDate(artifact.createdAt) ||
        Date.parse(artifact.createdAt) > now.getTime()
      )
        continue;
      const localDay = dayKey(new Date(artifact.createdAt)),
        key = `${item.id}:${localDay}`;
      if (summaryDays.has(key)) continue;
      summaryDays.add(key);
      events.push({
        id: `summary-evidence:${artifact.id}`,
        kind: "summary",
        at: artifact.createdAt,
        itemId: item.id,
        localDay,
      });
    }
  const activeDays = new Set([
    ...events.map(eventDay),
    ...attempts.map((a) => dayKey(new Date(a.date))),
  ]);
  const today = dayKey(now);
  let cursor = activeDays.has(today) ? today : shiftDay(today, -1),
    streak = 0;
  while (activeDays.has(cursor)) {
    streak++;
    cursor = shiftDay(cursor, -1);
  }
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDay(today, index - 6);
    const dayEvents = events.filter(
      (e) =>
        eventDay(e) === date &&
        !(
          e.kind === "quiz" &&
          attempts.some(
            (a) => a.itemId === e.itemId && dayKey(new Date(a.date)) === date,
          )
        ),
    );
    return {
      date,
      count:
        dayEvents.length +
        attempts.filter((a) => dayKey(new Date(a.date)) === date).length,
      minutes: dayEvents.reduce(
        (n, e) => n + (e.kind === "focus" ? e.minutes || 0 : 0),
        0,
      ),
    };
  });
  const topics = items
    .filter((i) => i.attempts.some((a) => a.total > 0))
    .map((item) => {
      const recent = item.attempts
        .filter((a) => a.total > 0 && a.score <= a.total)
        .slice(-3);
      const all = recent.reduce((n, a) => n + a.total, 0),
        scored = recent.reduce((n, a) => n + a.score, 0);
      return {
        item,
        accuracy: all ? Math.round((scored / all) * 100) : 0,
        attempts: recent.length,
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy);
  return {
    attempts: attempts.sort((a, b) => b.date.localeCompare(a.date)),
    accuracy: total ? Math.round((correct / total) * 100) : null,
    total,
    correct,
    streak,
    todayActive: activeDays.has(today),
    week,
    topics,
    focusMinutes: events.reduce(
      (n, e) => n + (e.kind === "focus" ? e.minutes || 0 : 0),
      0,
    ),
    reviews: events.filter((e) => e.kind === "review").length,
  };
}
