import type { LearningItem } from "./types";
import {
  dayKey,
  dueCards,
  type LearningState,
  type StudyTask,
} from "./learning-engine";

export type DashboardAction =
  | { kind: "focus"; remainingMinutes: number }
  | { kind: "review"; count: number; item: LearningItem }
  | { kind: "goal"; task: StudyTask; item?: LearningItem }
  | { kind: "practice"; item: LearningItem; accuracy: number; attempts: number }
  | { kind: "continue"; item: LearningItem }
  | { kind: "start" };

function knownTime(value: string | undefined, snapshot: number) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time <= snapshot ? time : 0;
}

/** Read-only suggestions from saved evidence. A supplied clock keeps selection reproducible. */
export function dashboardInsights(
  items: readonly LearningItem[],
  state: LearningState,
  now: Date,
) {
  const snapshot = now.getTime();
  const today = dayKey(now);
  const goals = state.tasks.filter((task) => task.date === today);
  const completedGoals = goals.filter((task) => task.done).length;
  const due = dueCards([...items], state, now);
  const recent = items.slice().sort((a, b) => {
    const rank = (item: LearningItem) =>
      Math.max(
        knownTime(item.lastOpenedAt, snapshot),
        knownTime(item.updatedAt, snapshot),
        knownTime(item.createdAt, snapshot),
      );
    return rank(b) - rank(a) || a.id.localeCompare(b.id);
  });
  const practice = items
    .flatMap((item) => {
      const attempts = item.attempts
        .filter(
          (attempt) =>
            attempt.total > 0 &&
            attempt.score >= 0 &&
            attempt.score <= attempt.total &&
            knownTime(attempt.date, snapshot) > 0,
        )
        .slice()
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
        .slice(0, 3);
      const total = attempts.reduce((sum, attempt) => sum + attempt.total, 0);
      if (!total) return [];
      const accuracy = Math.round(
        (attempts.reduce((sum, attempt) => sum + attempt.score, 0) / total) *
          100,
      );
      return [{ item, accuracy, attempts: attempts.length }];
    })
    .sort(
      (a, b) => a.accuracy - b.accuracy || a.item.id.localeCompare(b.item.id),
    );
  const weakTopic = practice.find((topic) => topic.accuracy < 80);
  const quizAttempts = items.reduce(
    (sum, item) =>
      sum +
      item.attempts.filter(
        (attempt) =>
          attempt.total > 0 &&
          attempt.score >= 0 &&
          attempt.score <= attempt.total &&
          knownTime(attempt.date, snapshot) > 0,
      ).length,
    0,
  );
  const reviewEvents = new Map(
    state.events
      .filter(
        (event) => event.kind === "review" && knownTime(event.at, snapshot) > 0,
      )
      .map((event) => [event.id, event]),
  );
  let action: DashboardAction = { kind: "start" };
  const focusSeconds = state.focus
    ? state.focus.deadline === null
      ? state.focus.remaining
      : Math.max(0, (state.focus.deadline - snapshot) / 1000)
    : 0;
  const goal = goals.find((task) => !task.done);
  if (focusSeconds > 0)
    action = { kind: "focus", remainingMinutes: Math.ceil(focusSeconds / 60) };
  else if (due.length)
    action = { kind: "review", count: due.length, item: due[0].item };
  else if (goal)
    action = {
      kind: "goal",
      task: goal,
      item: items.find((item) => item.id === goal.itemId),
    };
  else if (weakTopic) action = { kind: "practice", ...weakTopic };
  else if (recent[0]) action = { kind: "continue", item: recent[0] };
  return {
    action,
    goals,
    completedGoals,
    goalPercent: goals.length
      ? Math.round((completedGoals / goals.length) * 100)
      : 0,
    due,
    recent: recent.slice(0, 3),
    weakTopic,
    quizAttempts,
    reviewCount: reviewEvents.size,
  };
}
