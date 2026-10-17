import type { LearningItem } from "./types";
import { dueCards, type LearningState } from "./learning-engine";
import type { Preferences } from "./recommendations";
import {
  buildSkillProfile,
  matchingSkillItems,
  skillPracticeSuggestions,
} from "./skill-evidence";
import type { SkillId } from "./skill-taxonomy";
import { commandFold } from "./command-search";

export type LearningPlanAction = {
  id: string;
  kind: "review" | "practice" | "read";
  reason:
    | "due"
    | "focus"
    | "review"
    | "foundation"
    | "sample"
    | "next"
    | "continue"
    | "goal";
  item: LearningItem;
  skillId?: SkillId;
  basisId?: SkillId;
  dueCount: number;
  errors: number;
  questions: number;
};
/** A bounded local plan, not a diagnosis, generated curriculum or evidence of improvement. */
export function buildLearningPlan(
  items: readonly LearningItem[],
  learning: LearningState,
  preferences: Preferences,
  now = Date.now(),
) {
  if (!Number.isFinite(now)) throw Error("INVALID_PLAN_CLOCK");
  const available = items.slice(0, 1000),
    profile = buildSkillProfile(
      available,
      preferences.enabled && preferences.skillTracking !== false,
      now,
      preferences.excludedSkillAttemptIds,
    ),
    candidates: LearningPlanAction[] = [];
  const add = (
    item: LearningItem | undefined,
    reason: LearningPlanAction["reason"],
    detail: Partial<LearningPlanAction> = {},
  ) => {
    if (!item) return;
    candidates.push({
      id: `${reason}:${item.id}`,
      item,
      kind: item.questions.length ? "practice" : "read",
      reason,
      dueCount: 0,
      errors: 0,
      questions: 0,
      ...detail,
    });
  };
  if (preferences.enabled && preferences.studyFocusSkillId)
    add(
      matchingSkillItems(available, preferences.studyFocusSkillId)[0],
      "focus",
      { skillId: preferences.studyFocusSkillId },
    );
  const controls = preferences.enabled ? preferences.controls : undefined;
  if (controls && controls.goal !== "balanced") {
    const goalItems = available.filter((item) => {
      if (controls.goal === "review" && !item.cards.length) return false;
      if (
        controls.goal === "practice" &&
        !item.questions.some(
          (q) =>
            controls.difficulty === "any" ||
            q.difficulty === controls.difficulty,
        )
      )
        return false;
      const text = commandFold(
        [
          item.title,
          item.text.slice(0, 12000),
          ...item.questions.map((q) => q.topic || ""),
        ].join(" "),
      );
      return (
        !controls.topics.length ||
        controls.topics.some((topic) => text.includes(commandFold(topic)))
      );
    });
    add(goalItems[0], "goal", {
      kind:
        controls.goal === "review"
          ? "review"
          : controls.goal === "practice"
            ? "practice"
            : "read",
    });
  }
  const due = dueCards([...available], learning, new Date(now)).filter(
    (c) => c.dueAt,
  );
  const dueItems = new Map<string, { item: LearningItem; count: number }>();
  for (const card of due) {
    const entry = dueItems.get(card.item.id) || { item: card.item, count: 0 };
    entry.count++;
    dueItems.set(card.item.id, entry);
  }
  for (const entry of dueItems.values())
    add(entry.item, "due", { kind: "review", dueCount: entry.count });
  for (const suggestion of skillPracticeSuggestions(available, profile))
    add(suggestion.item, suggestion.reason, {
      skillId: suggestion.skillId,
      basisId: suggestion.basisId,
      errors: suggestion.errors,
      questions: suggestion.questions,
    });
  const recency = (i: LearningItem) => {
    const time = Date.parse(i.lastOpenedAt || i.updatedAt || i.createdAt);
    return Number.isFinite(time) && time <= now ? time : 0;
  };
  for (const item of [...available]
    .filter((i) => recency(i) > 0)
    .sort((a, b) => recency(b) - recency(a) || a.id.localeCompare(b.id)))
    add(item, "continue");
  const seen = new Set<string>();
  const actions = candidates
    .filter((a) => {
      if (seen.has(a.item.id)) return false;
      seen.add(a.item.id);
      return true;
    })
    .slice(0, 3);
  return {
    actions,
    primary: actions[0] || null,
    alternatives: actions.slice(1),
    profile,
    dueCount: due.length,
  };
}
