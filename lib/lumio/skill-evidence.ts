import type { Attempt, LearningItem, Question } from "./types";
import {
  SKILL_TAXONOMY_VERSION,
  skillById,
  skillForTopic,
  skillTaxonomy,
  type SkillId,
} from "./skill-taxonomy";
export type SkillDifficulty =
  "beginner" | "intermediate" | "advanced" | "unknown";
export type SkillAttemptEvidence = {
  version: 1;
  attemptId: string;
  taxonomyVersion: typeof SKILL_TAXONOMY_VERSION;
  answers: {
    questionId: string;
    fingerprint: string;
    skillId?: SkillId;
    skillOrigin: "topic-alias" | "learner-selected" | "unknown";
    difficulty: SkillDifficulty;
    difficultyOrigin: "declared" | "learner-selected" | "unknown";
    /** First choice observed in this app; never a guarantee of unaided work elsewhere. */
    exposure: "first-choice" | "previous-attempt" | "unknown";
    selected: number;
    correct: boolean;
  }[];
};
const DAY = 86400000;
export const SKILL_RULES = {
  version: "evidence-1",
  windowDays: 90,
  recentErrorDays: 14,
  minQuestions: 8,
  minDays: 3,
  minSpanDays: 7,
  minKnownLevels: 2,
  minAccuracy: 0.8,
  minLowerBound: 0.55,
} as const;
export const skillDifficulties: SkillDifficulty[] = [
  "beginner",
  "intermediate",
  "advanced",
  "unknown",
];

/** Deduplication key only, not a cryptographic signature or proof of source authenticity. */
export function questionFingerprint(
  q: Pick<Question, "prompt" | "options" | "correct">,
) {
  const raw = JSON.stringify([
    q.prompt.normalize("NFC").trim(),
    q.options.map((o) => o.normalize("NFC").trim()),
    q.correct,
  ]);
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < raw.length; i++) {
    a = Math.imul(a ^ raw.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ raw.charCodeAt(i);
  }
  return `q1:${raw.length}:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}`;
}
export function createSkillEvidence(
  questions: readonly Question[],
  answers: readonly (number | null)[],
  prior: readonly Attempt[],
  attemptId: string,
  selection: { skillId?: SkillId; difficulty?: SkillDifficulty } = {},
): SkillAttemptEvidence {
  return {
    version: 1,
    attemptId,
    taxonomyVersion: SKILL_TAXONOMY_VERSION,
    answers: questions.map((q, i) => {
      const selected = answers[i];
      if (
        !Number.isInteger(selected) ||
        selected === null ||
        selected! < 0 ||
        selected! >= q.options.length
      )
        throw new Error("INCOMPLETE_SKILL_ATTEMPT");
      const fingerprint = questionFingerprint(q);
      const seen = prior.some(
        (p) =>
          (Array.isArray(p.skillEvidence?.answers) &&
            p.skillEvidence.answers.some(
              (a) => a?.fingerprint === fingerprint,
            )) ||
          (Array.isArray(p.answers) &&
            p.answers.some((a) => a?.questionId === q.id)),
      );
      const skillId = selection.skillId || skillForTopic(q.topic || "");
      const chosenDifficulty =
        selection.difficulty && selection.difficulty !== "unknown"
          ? selection.difficulty
          : undefined;
      const difficulty = chosenDifficulty || q.difficulty || "unknown";
      return {
        questionId: q.id,
        fingerprint,
        ...(skillId ? { skillId } : {}),
        skillOrigin: selection.skillId
          ? "learner-selected"
          : skillId
            ? "topic-alias"
            : "unknown",
        difficulty,
        difficultyOrigin: chosenDifficulty
          ? "learner-selected"
          : q.difficulty
            ? "declared"
            : "unknown",
        exposure: seen ? "previous-attempt" : "first-choice",
        selected: selected!,
        correct: selected === q.correct,
      };
    }),
  };
}
/** Imported evidence is still local, untrusted study data; it cannot grant server credits. */
export function parseSkillEvidence(
  raw: unknown,
  attempt: Pick<Attempt, "score" | "total" | "answers">,
): SkillAttemptEvidence {
  const e = raw as SkillAttemptEvidence;
  if (
    !e ||
    e.version !== 1 ||
    e.taxonomyVersion !== SKILL_TAXONOMY_VERSION ||
    typeof e.attemptId !== "string" ||
    !e.attemptId.trim() ||
    e.attemptId.length > 100 ||
    !Array.isArray(e.answers) ||
    e.answers.length !== attempt.total ||
    e.answers.length > 100 ||
    !Array.isArray(attempt.answers) ||
    attempt.answers.length !== attempt.total
  )
    throw new Error("INVALID_SKILL_EVIDENCE");
  const used = new Set<string>();
  const answers = e.answers.map((a) => {
    const observed = attempt.answers!.find(
      (o) => o.questionId === a?.questionId,
    );
    if (
      !a ||
      typeof a.questionId !== "string" ||
      !a.questionId.trim() ||
      a.questionId.length > 100 ||
      used.has(a.questionId) ||
      typeof a.fingerprint !== "string" ||
      !/^q1:\d{1,7}:[0-9a-f]{1,8}:[0-9a-f]{1,8}$/.test(a.fingerprint) ||
      !["topic-alias", "learner-selected", "unknown"].includes(a.skillOrigin) ||
      !skillDifficulties.includes(a.difficulty) ||
      !["declared", "learner-selected", "unknown"].includes(
        a.difficultyOrigin,
      ) ||
      !["first-choice", "previous-attempt", "unknown"].includes(a.exposure) ||
      !Number.isInteger(a.selected) ||
      a.selected < 0 ||
      a.selected > 3 ||
      typeof a.correct !== "boolean" ||
      !observed ||
      observed.selected !== a.selected ||
      observed.correct !== a.correct ||
      (a.skillId !== undefined && !skillById(a.skillId)) ||
      !!a.skillId !== (a.skillOrigin !== "unknown") ||
      (a.difficulty === "unknown") !== (a.difficultyOrigin === "unknown")
    )
      throw new Error("INVALID_SKILL_EVIDENCE");
    used.add(a.questionId);
    return {
      questionId: a.questionId,
      fingerprint: a.fingerprint,
      ...(a.skillId ? { skillId: a.skillId } : {}),
      skillOrigin: a.skillOrigin,
      difficulty: a.difficulty,
      difficultyOrigin: a.difficultyOrigin,
      exposure: a.exposure,
      selected: a.selected,
      correct: a.correct,
    };
  });
  if (answers.filter((a) => a.correct).length !== attempt.score)
    throw new Error("INVALID_SKILL_EVIDENCE");
  return {
    version: 1,
    attemptId: e.attemptId,
    taxonomyVersion: SKILL_TAXONOMY_VERSION,
    answers,
  };
}

export type SkillStatus =
  "insufficient" | "practicing" | "review" | "consistent";
export type SkillStats = {
  id: SkillId;
  status: SkillStatus;
  observations: number;
  independent: number;
  correct: number;
  days: number;
  spanDays: number;
  lastAt: string | null;
  repeated: number;
  recentErrors: number;
  interval: [number, number];
  levels: Record<SkillDifficulty, { total: number; correct: number }>;
  itemIds: string[];
  prerequisites: SkillId[];
};
/** Wilson descriptive interval for the observed unique-question sample; not a mastery probability. */
export function observedInterval(
  correct: number,
  total: number,
): [number, number] {
  if (!total) return [0, 1];
  const z = 1.96,
    p = correct / total,
    d = 1 + (z * z) / total,
    center = (p + (z * z) / (2 * total)) / d,
    margin =
      (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) /
      d;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}
export function buildSkillProfile(
  items: readonly LearningItem[],
  enabled: boolean,
  now = Date.now(),
) {
  type Observation = SkillAttemptEvidence["answers"][number] & {
    at: string;
    time: number;
    itemId: string;
  };
  const observations: Observation[] = [],
    ids = new Set<string>();
  let legacyAnswers = 0,
    unclassified = 0,
    invalidAttempts = 0;
  // The caller supplies only this account's library; never reads global/local storage.
  if (enabled)
    for (const item of items.slice(-1000))
      for (const a of item.attempts.slice(-1000)) {
        const time = Date.parse(a.date);
        if (
          !Number.isFinite(time) ||
          time > now ||
          now - time > SKILL_RULES.windowDays * DAY ||
          !Number.isInteger(a.total) ||
          a.total < 1 ||
          !Number.isInteger(a.score) ||
          a.score < 0 ||
          a.score > a.total
        )
          continue;
        if (!a.skillEvidence) {
          legacyAnswers += a.total;
          continue;
        }
        try {
          const e = parseSkillEvidence(a.skillEvidence, a);
          if (ids.has(e.attemptId)) continue;
          ids.add(e.attemptId);
          for (const answer of e.answers) {
            if (!answer.skillId) {
              unclassified++;
              continue;
            }
            observations.push({ ...answer, at: a.date, time, itemId: item.id });
          }
        } catch {
          invalidAttempts++;
        }
      }
  observations.sort(
    (a, b) => a.time - b.time || a.fingerprint.localeCompare(b.fingerprint),
  );
  const skills: SkillStats[] = skillTaxonomy.map((skill) => {
    const all = observations.filter((o) => o.skillId === skill.id),
      unique = new Map<string, Observation>();
    // First observed choice of a question, not its best repeated result. Same content
    // copied to another document cannot create more independent questions.
    for (const o of all)
      if (o.exposure === "first-choice" && !unique.has(o.fingerprint))
        unique.set(o.fingerprint, o);
    const sample = [...unique.values()],
      days = new Set(
        sample.map((o) => new Date(o.time).toISOString().slice(0, 10)),
      ).size;
    const spanDays =
      sample.length > 1
        ? Math.floor((sample.at(-1)!.time - sample[0].time) / DAY)
        : 0;
    const levels = Object.fromEntries(
      skillDifficulties.map((d) => [d, { total: 0, correct: 0 }]),
    ) as SkillStats["levels"];
    for (const o of sample) {
      levels[o.difficulty].total++;
      if (o.correct) levels[o.difficulty].correct++;
    }
    const correct = sample.filter((o) => o.correct).length,
      interval = observedInterval(correct, sample.length);
    const latest = new Map<string, Observation>();
    for (const o of all) latest.set(o.fingerprint, o);
    const recentErrors = new Set(
      [...latest.values()]
        .filter(
          (o) =>
            !o.correct && now - o.time <= SKILL_RULES.recentErrorDays * DAY,
        )
        .map((o) => o.fingerprint),
    ).size;
    const coverage =
      sample.length >= SKILL_RULES.minQuestions &&
      days >= SKILL_RULES.minDays &&
      spanDays >= SKILL_RULES.minSpanDays &&
      skillDifficulties.filter((d) => d !== "unknown" && levels[d].total >= 2)
        .length >= SKILL_RULES.minKnownLevels;
    const status: SkillStatus =
      recentErrors >= 2
        ? "review"
        : coverage &&
            correct / sample.length >= SKILL_RULES.minAccuracy &&
            interval[0] >= SKILL_RULES.minLowerBound
          ? "consistent"
          : sample.length >= 3 && days >= 2
            ? "practicing"
            : "insufficient";
    return {
      id: skill.id,
      status,
      observations: all.length,
      independent: sample.length,
      correct,
      days,
      spanDays,
      lastAt: all.at(-1)?.at || null,
      repeated: all.length - sample.length,
      recentErrors,
      interval,
      levels,
      itemIds: [...new Set(all.map((o) => o.itemId))],
      prerequisites: [...skill.prerequisites] as SkillId[],
    };
  });
  return {
    version: SKILL_RULES.version,
    enabled,
    skills,
    legacyAnswers,
    unclassified,
    invalidAttempts,
  };
}
export function matchingSkillItems(
  items: readonly LearningItem[],
  id: SkillId,
) {
  return items
    .filter(
      (item) =>
        item.questions.some((q) => skillForTopic(q.topic || "") === id) ||
        item.attempts.some(
          (a) =>
            Array.isArray(a.skillEvidence?.answers) &&
            a.skillEvidence.answers.some((s) => s.skillId === id),
        ),
    )
    .slice(0, 3);
}
export function stripSkillEvidence(
  items: readonly LearningItem[],
): LearningItem[] {
  return items.map((i) => ({
    ...i,
    attempts: i.attempts.map(({ skillEvidence: _removed, ...a }) => a),
  }));
}
export type SkillSuggestion = {
  skillId: SkillId;
  basisId: SkillId;
  reason: "review" | "foundation" | "sample" | "next";
  item: LearningItem;
  errors: number;
  questions: number;
};
/** Explainable suggestions use observed skill evidence and declared prerequisites only. */
export function skillPracticeSuggestions(
  items: readonly LearningItem[],
  profile: ReturnType<typeof buildSkillProfile>,
): SkillSuggestion[] {
  if (!profile.enabled) return [];
  const candidates: SkillSuggestion[] = [],
    used = new Set<string>();
  const add = (
    skill: SkillStats,
    basis: SkillStats,
    reason: SkillSuggestion["reason"],
  ) => {
    const item = matchingSkillItems(items, skill.id).find(
      (i) => !used.has(i.id),
    );
    if (!item) return;
    used.add(item.id);
    candidates.push({
      skillId: skill.id,
      basisId: basis.id,
      reason,
      item,
      errors: basis.recentErrors,
      questions: basis.independent,
    });
  };
  for (const skill of [...profile.skills]
    .filter((s) => s.status === "review")
    .sort((a, b) => b.recentErrors - a.recentErrors)) {
    const foundation = skill.prerequisites
      .map((id) => profile.skills.find((s) => s.id === id)!)
      .find((s) => s.status === "review");
    if (foundation) add(foundation, skill, "foundation");
    add(skill, skill, "review");
  }
  for (const skill of profile.skills.filter(
    (s) =>
      s.independent > 0 && s.status !== "review" && s.status !== "consistent",
  ))
    add(skill, skill, "sample");
  for (const skill of profile.skills.filter(
    (s) =>
      s.independent === 0 &&
      s.prerequisites.length > 0 &&
      s.prerequisites.every(
        (id) =>
          profile.skills.find((v) => v.id === id)?.status === "consistent",
      ),
  ))
    add(skill, skill, "next");
  return candidates.slice(0, 3);
}
