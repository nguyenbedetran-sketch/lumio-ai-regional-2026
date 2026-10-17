import type { LearningItem, Space } from "./types";
import type { StudyTask } from "./learning-engine";

export type CommandView =
  | "home"
  | "library"
  | "search"
  | "history"
  | "favorites"
  | "settings"
  | "space"
  | "planner"
  | "progress"
  | "review"
  | "focus"
  | "personal"
  | "billing"
  | "voice"
  | "experience";
export type CommandDestination = {
  id: CommandView;
  label: string;
  keywords?: readonly string[];
};
export const COMMAND_QUERY_LIMIT = 160;
export const COMMAND_CONTENT_LIMIT = 12000;
export const COMMAND_RESULT_LIMIT = 20;
export type MatchField =
  "title" | "file" | "space" | "notes" | "text" | "study";
type IndexedItem = {
  item: LearningItem;
  fields: Record<MatchField, string>;
  order: number;
};

/** Accent-insensitive local matching; nothing is sent or persisted. */
export function commandFold(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
export function commandQuery(value: string): string {
  return commandFold(value.slice(0, COMMAND_QUERY_LIMIT));
}
export function buildCommandIndex(
  items: readonly LearningItem[],
  spaces: readonly Space[] = [],
): IndexedItem[] {
  const names = new Map(spaces.map((space) => [space.id, space.name]));
  return items.map((item, order) => ({
    item,
    order,
    fields: {
      title: commandFold(item.title),
      file: commandFold(item.fileName || ""),
      space: commandFold(names.get(item.spaceId) || ""),
      notes: commandFold(item.notes.slice(0, COMMAND_CONTENT_LIMIT)),
      text: commandFold(item.text.slice(0, COMMAND_CONTENT_LIMIT)),
      study: commandFold(
        [
          ...item.cards
            .slice(0, 100)
            .flatMap((card) => [card.front, card.back]),
          ...item.questions
            .slice(0, 100)
            .flatMap((q) => [q.prompt, q.topic || "", q.explanation]),
          ...(item.artifacts || [])
            .slice(0, 20)
            .flatMap((a) => [
              a.summary.title,
              a.summary.overview,
              ...a.summary.keyPoints,
              ...a.summary.chapters.map((c) => c.title + " " + c.summary),
            ]),
        ]
          .map((value) => value.slice(0, COMMAND_CONTENT_LIMIT))
          .join("\n")
          .slice(0, COMMAND_CONTENT_LIMIT),
      ),
    },
  }));
}
const fieldPriority: MatchField[] = [
  "title",
  "file",
  "space",
  "notes",
  "text",
  "study",
];
const openedTime = (item: LearningItem) => {
  const time = Date.parse(item.lastOpenedAt || item.createdAt);
  return Number.isFinite(time) ? time : 0;
};
export function searchCommandItems(
  index: readonly IndexedItem[],
  input: string,
  limit = COMMAND_RESULT_LIMIT,
) {
  const query = commandQuery(input);
  const cap = Math.max(
    0,
    Math.min(
      COMMAND_RESULT_LIMIT,
      Number.isFinite(limit) ? Math.floor(limit) : COMMAND_RESULT_LIMIT,
    ),
  );
  const terms = query.split(" ").filter(Boolean);
  const scored = index.flatMap((entry) => {
    const { fields } = entry;
    if (
      terms.some(
        (term) => !fieldPriority.some((field) => fields[field].includes(term)),
      )
    )
      return [];
    const matchedIn =
      fieldPriority.find((field) => query && fields[field].includes(query)) ||
      fieldPriority.find((field) =>
        terms.some((term) => fields[field].includes(term)),
      ) ||
      "title";
    let score = 0;
    if (query) {
      score =
        fields.title === query
          ? 1000
          : fields.title.startsWith(query)
            ? 800
            : fields.title.includes(query)
              ? 600
              : 0;
      for (const term of terms)
        score += fieldPriority.reduce(
          (best, field, rank) =>
            Math.max(best, fields[field].includes(term) ? (6 - rank) * 10 : 0),
          0,
        );
    }
    return [{ ...entry, score, matchedIn }];
  });
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      openedTime(b.item) - openedTime(a.item) ||
      a.order - b.order,
  );
  return {
    items: scored
      .slice(0, query ? cap : Math.min(6, cap))
      .map(({ item, matchedIn }) => ({ item, matchedIn })),
    total: scored.length,
    query,
  };
}
/** User-owned study plans already loaded in this workspace, never a server query. */
export function searchCommandTasks(tasks: readonly StudyTask[], input: string) {
  const query = commandQuery(input);
  if (!query) return [];
  const terms = query.split(" ").filter(Boolean);
  return tasks
    .filter((task) => {
      const text = commandFold(`${task.title} ${task.date}`);
      return terms.every((term) => text.includes(term));
    })
    .slice()
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        a.date.localeCompare(b.date) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, COMMAND_RESULT_LIMIT);
}
export function commandMatches(
  input: string,
  label: string,
  keywords: readonly string[] = [],
): boolean {
  const query = commandQuery(input);
  const value = commandFold([label, ...keywords].join(" "));
  return query
    .split(" ")
    .filter(Boolean)
    .every((term) => value.includes(term));
}

/** Keep composition/editor shortcuts intact; an open modal owns its keyboard. */
export function isCommandShortcut(
  event: Pick<
    KeyboardEvent,
    | "key"
    | "ctrlKey"
    | "metaKey"
    | "altKey"
    | "shiftKey"
    | "repeat"
    | "isComposing"
    | "defaultPrevented"
  >,
): boolean {
  return (
    !event.defaultPrevented &&
    !event.repeat &&
    !event.isComposing &&
    !event.altKey &&
    !event.shiftKey &&
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "k"
  );
}
