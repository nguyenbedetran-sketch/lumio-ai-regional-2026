import type { Question } from "./types";

export type ReaderPreferences = {
  fontSize: 16 | 18 | 20;
  lineHeight: 1.6 | 1.9 | 2.2;
};
export const defaultReaderPreferences: ReaderPreferences = {
  fontSize: 18,
  lineHeight: 1.9,
};
export const readerPreferencesKey = "lumio:reader-preferences:v1";

/** Only typography is persisted; documents, drafts and account data stay in the library. */
export function normalizeReaderPreferences(value: unknown): ReaderPreferences {
  if (!value || typeof value !== "object")
    return { ...defaultReaderPreferences };
  const input = value as Record<string, unknown>;
  return {
    fontSize:
      input.fontSize === 16 || input.fontSize === 18 || input.fontSize === 20
        ? input.fontSize
        : defaultReaderPreferences.fontSize,
    lineHeight:
      input.lineHeight === 1.6 ||
      input.lineHeight === 1.9 ||
      input.lineHeight === 2.2
        ? input.lineHeight
        : defaultReaderPreferences.lineHeight,
  };
}

export function parseReaderPreferences(text: string | null): ReaderPreferences {
  try {
    return normalizeReaderPreferences(text ? JSON.parse(text) : null);
  } catch {
    return { ...defaultReaderPreferences };
  }
}

export function quizSnapshot(questions: readonly Question[]): Question[] {
  return questions
    .filter(
      (q) =>
        q.options.length >= 2 &&
        Number.isInteger(q.correct) &&
        q.correct >= 0 &&
        q.correct < q.options.length,
    )
    .map((q) => ({ ...q, options: [...q.options] }));
}

export function answeredQuizScore(
  questions: readonly Question[],
  answers: readonly (number | null)[],
): number {
  return questions.reduce(
    (score, q, index) =>
      score +
      (Number.isInteger(answers[index]) && answers[index] === q.correct
        ? 1
        : 0),
    0,
  );
}

export function quizChoiceForKey(
  key: string,
  optionCount: number,
): number | null {
  const choice = /^[1-9]$/.test(key)
    ? Number(key) - 1
    : /^[a-z]$/i.test(key)
      ? key.toLowerCase().charCodeAt(0) - 97
      : -1;
  return choice >= 0 && choice < Math.min(optionCount, 9) ? choice : null;
}

export function reviewRatingForKey(
  key: string,
): "again" | "hard" | "good" | "easy" | null {
  return /^[1-4]$/.test(key)
    ? (["again", "hard", "good", "easy"] as const)[Number(key) - 1]
    : null;
}

export function shortcutMayRun(
  event: {
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    repeat: boolean;
  },
  editable: boolean,
): boolean {
  return (
    !editable &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.repeat
  );
}
