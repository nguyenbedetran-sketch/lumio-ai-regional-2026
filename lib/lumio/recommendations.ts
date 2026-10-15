import type { LearningItem } from "./types";
import type { LearningState } from "./learning-engine";
import { cardFingerprint } from "./learning-engine";

export type Feedback = { itemId: string; value: 0 | 1; at: string };
export type RecommendationDifficulty =
  "any" | "beginner" | "intermediate" | "advanced";
export type RecommendationGoal = "balanced" | "review" | "practice" | "explore";
export type RecommendationControls = {
  topics: string[];
  difficulty: RecommendationDifficulty;
  goal: RecommendationGoal;
};
/** Explicit post-study self-report, kept separate from preference labels and quiz results. */
export type RecommendationOutcome = {
  itemId: string;
  useful: boolean;
  at: string;
};
export const defaultRecommendationControls = (): RecommendationControls => ({
  topics: [],
  difficulty: "any",
  goal: "balanced",
});
export type Preferences = {
  version: 1;
  enabled: boolean;
  feedback: Feedback[];
  controls?: RecommendationControls;
  outcomes?: RecommendationOutcome[];
  skillTracking?: boolean;
};
export const emptyPreferences = (): Preferences => ({
  version: 1,
  enabled: true,
  feedback: [],
});
export const preferenceKey = (account: string) =>
  `lumio-personalization-v1:${encodeURIComponent(account)}`;
export function parsePreferences(raw: unknown): Preferences {
  const p = raw as Preferences;
  if (
    !p ||
    p.version !== 1 ||
    typeof p.enabled !== "boolean" ||
    !Array.isArray(p.feedback) ||
    p.feedback.length > 1000
  )
    throw new Error("INVALID_PREFERENCES");
  if (p.skillTracking !== undefined && typeof p.skillTracking !== "boolean")
    throw new Error("INVALID_PREFERENCES");
  const ids = new Set<string>();
  for (const f of p.feedback) {
    if (
      !f ||
      typeof f.itemId !== "string" ||
      !f.itemId.trim() ||
      f.itemId.length > 200 ||
      ids.has(f.itemId) ||
      ![0, 1].includes(f.value) ||
      typeof f.at !== "string" ||
      !Number.isFinite(Date.parse(f.at))
    )
      throw new Error("INVALID_PREFERENCES");
    ids.add(f.itemId);
  }
  if (
    p.controls !== undefined &&
    (!p.controls ||
      !Array.isArray(p.controls.topics) ||
      p.controls.topics.length > 8 ||
      !["any", "beginner", "intermediate", "advanced"].includes(
        p.controls.difficulty,
      ) ||
      !["balanced", "review", "practice", "explore"].includes(
        p.controls.goal,
      ) ||
      p.controls.topics.some(
        (t) => typeof t !== "string" || !t.trim() || t.length > 80,
      ) ||
      new Set(p.controls.topics.map((t) => t.trim().toLocaleLowerCase()))
        .size !== p.controls.topics.length)
  )
    throw new Error("INVALID_PREFERENCES");
  if (p.outcomes !== undefined) {
    if (!Array.isArray(p.outcomes) || p.outcomes.length > 1000)
      throw new Error("INVALID_PREFERENCES");
    const outcomeIds = new Set<string>();
    for (const o of p.outcomes) {
      if (
        !o ||
        typeof o.itemId !== "string" ||
        !o.itemId.trim() ||
        o.itemId.length > 200 ||
        outcomeIds.has(o.itemId) ||
        typeof o.useful !== "boolean" ||
        typeof o.at !== "string" ||
        !Number.isFinite(Date.parse(o.at))
      )
        throw new Error("INVALID_PREFERENCES");
      outcomeIds.add(o.itemId);
    }
  }
  return {
    version: 1,
    enabled: p.enabled,
    ...(p.skillTracking === undefined
      ? {}
      : { skillTracking: p.skillTracking }),
    feedback: p.feedback.map((f) => ({
      itemId: f.itemId,
      value: f.value,
      at: f.at,
    })),
    ...(p.controls
      ? {
          controls: {
            ...p.controls,
            topics: p.controls.topics.map((t) => t.trim()),
          },
        }
      : {}),
    ...(p.outcomes
      ? {
          outcomes: p.outcomes.map((o) => ({
            itemId: o.itemId,
            useful: o.useful,
            at: o.at,
          })),
        }
      : {}),
  };
}
const SIZE = 48;
export const MAX_TRAINING_EXAMPLES = 200;
const STOP = new Set(
  "the and that this with from into for are was have you your một các của trong những được với là và cho khi học bài nội dung video phần về có này những một không liệu tài học tập".split(
    " ",
  ),
);
export function words(text: string): string[] {
  return (
    text
      .toLocaleLowerCase()
      .normalize("NFC")
      .match(/[\p{L}\p{N}][\p{L}\p{N}+#.-]{1,30}/gu) || []
  )
    .filter((w) => !STOP.has(w))
    .slice(0, 6000);
}
function hash(word: string) {
  let h = 2166136261;
  for (const letter of word) h = Math.imul(h ^ letter.charCodeAt(0), 16777619);
  return h >>> 0;
}
function norm(x: number[]) {
  const length = Math.sqrt(x.reduce((sum, v) => sum + v * v, 0)) || 1;
  return x.map((v) => v / length);
}
export function featureVector(item: LearningItem): number[] {
  const vector = Array<number>(SIZE).fill(0);
  const tokens = [
    ...words(item.title).flatMap((w) => [w, w, w, w]),
    ...words(item.text.slice(0, 16000)),
  ];
  for (const token of tokens) vector[hash(token) % (SIZE - 6)]++;
  ["text", "pdf", "image", "audio", "video", "link"].forEach(
    (kind, i) => (vector[SIZE - 6 + i] = item.kind === kind ? 2 : 0),
  );
  return norm(vector.map((v) => Math.log1p(v)));
}
const dot = (a: number[], b: number[]) =>
  a.reduce((s, n, i) => s + n * (b[i] || 0), 0);
const sigmoid = (n: number) =>
  1 / (1 + Math.exp(-Math.max(-30, Math.min(30, n))));
export type TrainingExample = { x: number[]; y: 0 | 1 };
export type Ranker = {
  method: "logistic" | "neural";
  predict: (x: number[]) => number;
  loss: number;
};
function validVector(x: number[]) {
  if (!Array.isArray(x) || x.length !== SIZE) return false;
  // Index every coordinate so sparse arrays cannot bypass Array.some/every checks.
  for (let i = 0; i < SIZE; i++)
    if (
      typeof x[i] !== "number" ||
      !Number.isFinite(x[i]) ||
      Math.abs(x[i]) > 1
    )
      return false;
  return true;
}

/** Small, deterministic supervised ranker. Only explicit user ratings become labels. */
export function trainRanker(
  examples: TrainingExample[],
  neural = false,
): Ranker {
  if (
    !Array.isArray(examples) ||
    !examples.length ||
    examples.length > MAX_TRAINING_EXAMPLES
  )
    throw new Error("INVALID_TRAINING_DATA");
  for (let i = 0; i < examples.length; i++) {
    const e = examples[i];
    if (!e || !validVector(e.x) || ![0, 1].includes(e.y))
      throw new Error("INVALID_TRAINING_DATA");
  }
  const data = examples.map((e) => ({ x: [...e.x], y: e.y }));
  if (!neural) {
    const weights = Array<number>(SIZE).fill(0);
    let bias = 0;
    for (let epoch = 0; epoch < 160; epoch++) {
      const gradients = Array<number>(SIZE).fill(0);
      let delta = 0;
      for (const { x, y } of data) {
        const error = sigmoid(dot(weights, x) + bias) - y;
        delta += error;
        for (let j = 0; j < SIZE; j++) gradients[j] += error * x[j];
      }
      for (let j = 0; j < SIZE; j++)
        weights[j] -= 0.7 * (gradients[j] / data.length + 0.002 * weights[j]);
      bias -= (0.7 * delta) / data.length;
    }
    const predict = (x: number[]) => {
      if (!validVector(x)) throw new Error("INVALID_FEATURE_VECTOR");
      return sigmoid(dot(weights, x) + bias);
    };
    return { method: "logistic", predict, loss: loss(data, predict) };
  }
  // Two hidden layers (48 → 12 → 6 → 1), trained locally with backpropagation.
  let seed = 1207;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return (seed / 4294967296 - 0.5) * 0.8;
  };
  const w1 = Array.from({ length: 12 }, () =>
    Array.from({ length: SIZE }, random),
  );
  const w2 = Array.from({ length: 6 }, () =>
    Array.from({ length: 12 }, random),
  );
  // Small nonzero hidden biases break odd-function symmetry on nonlinear labels.
  const w3 = Array.from({ length: 6 }, random),
    b1 = Array.from({ length: 12 }, () => random() * 0.2),
    b2 = Array.from({ length: 6 }, () => random() * 0.2);
  let b3 = 0;
  function forward(x: number[]) {
    const a = w1.map((w, j) => Math.tanh(dot(w, x) + b1[j]));
    const b = w2.map((w, j) => Math.tanh(dot(w, a) + b2[j]));
    return { a, b, p: sigmoid(dot(w3, b) + b3) };
  }
  for (let epoch = 0; epoch < 200; epoch++) {
    // Alternating order avoids a fixed positive/negative block dominating the last update.
    const batch = epoch % 2 ? [...data].reverse() : data;
    for (const { x, y } of batch) {
      const { a, b, p } = forward(x),
        d3 = p - y;
      const d2 = b.map((v, k) => d3 * w3[k] * (1 - v * v));
      const d1 = a.map(
        (v, j) => d2.reduce((s, n, k) => s + n * w2[k][j], 0) * (1 - v * v),
      );
      const rate = 0.06 / (1 + epoch / 200);
      w3.forEach((v, k) => {
        w3[k] -= rate * (d3 * b[k] + 0.001 * v);
      });
      b3 -= rate * d3;
      w2.forEach((w, k) => {
        w.forEach((v, j) => {
          w[j] -= rate * (d2[k] * a[j] + 0.001 * v);
        });
        b2[k] -= rate * d2[k];
      });
      w1.forEach((w, j) => {
        w.forEach((v, k) => {
          w[k] -= rate * (d1[j] * x[k] + 0.001 * v);
        });
        b1[j] -= rate * d1[j];
      });
    }
  }
  const predict = (x: number[]) => {
    if (!validVector(x)) throw new Error("INVALID_FEATURE_VECTOR");
    return forward(x).p;
  };
  return { method: "neural", predict, loss: loss(data, predict) };
}
function loss(data: TrainingExample[], predict: (x: number[]) => number) {
  return (
    data.reduce((sum, e) => {
      const p = Math.max(0.000001, Math.min(0.999999, predict(e.x)));
      return sum - e.y * Math.log(p) - (1 - e.y) * Math.log(1 - p);
    }, 0) / data.length
  );
}
export type Recommendation = {
  item: LearningItem;
  score: number;
  reason:
    | "review"
    | "practice"
    | "interest"
    | "favorite"
    | "explore"
    | "topic"
    | "goal";
  terms: string[];
  feedback?: 0 | 1;
  evidence: {
    due: number;
    attempts: number;
    correct: number;
    total: number;
    /** Observed wrong answers by declared quiz topic, not a diagnosed misconception. */
    wrongTopics: { topic: string; wrong: number; total: number }[];
    topics: string[];
    difficulty: Exclude<RecommendationDifficulty, "any"> | null;
    goal: RecommendationGoal;
  };
  outcome?: boolean;
};
const DAY = 86400000;
const recentDate = (date: string, now: number) =>
  Number.isFinite(Date.parse(date)) &&
  Date.parse(date) <= now &&
  now - Date.parse(date) <= 90 * DAY;

/** Valid results only. Preferences are never interpreted as knowledge or mastery. */
export function recommendationEvidence(
  item: LearningItem,
  learning: LearningState,
  now: number,
) {
  const due = learning.reviews.filter(
    (r) =>
      r.itemId === item.id &&
      item.cards.some(
        (c) =>
          c.id === r.cardId &&
          cardFingerprint(c.front, c.back) === r.fingerprint,
      ) &&
      Number.isFinite(Date.parse(r.dueAt)) &&
      Date.parse(r.dueAt) <= now,
  ).length;
  const attempts = item.attempts
    .filter(
      (a) =>
        recentDate(a.date, now) &&
        Number.isInteger(a.total) &&
        a.total > 0 &&
        Number.isInteger(a.score) &&
        a.score >= 0 &&
        a.score <= a.total,
    )
    .slice(-3);
  const total = attempts.reduce((sum, a) => sum + a.total, 0),
    correct = attempts.reduce((sum, a) => sum + a.score, 0);
  const topics = new Map<string, { wrong: number; total: number }>();
  for (const attempt of attempts) {
    if (
      !Array.isArray(attempt.answers) ||
      attempt.answers.length !== attempt.total ||
      attempt.answers.filter((a) => a.correct === true).length !==
        attempt.score ||
      new Set(attempt.answers.map((a) => a.questionId)).size !==
        attempt.answers.length
    )
      continue;
    const used = new Set<string>();
    for (const a of attempt.answers || []) {
      if (used.has(a.questionId) || typeof a.correct !== "boolean") continue;
      used.add(a.questionId);
      const q = item.questions?.find((q) => q.id === a.questionId);
      // A recorded topic is valid evidence even if a newer quiz replaced its question.
      const topic = (a.topic || q?.topic || "").trim().slice(0, 120);
      if (!topic) continue;
      const count = topics.get(topic) || { wrong: 0, total: 0 };
      count.total++;
      if (!a.correct) count.wrong++;
      topics.set(topic, count);
    }
  }
  const known = (item.questions || [])
    .map((q) => q.difficulty)
    .filter(
      (d): d is "beginner" | "intermediate" | "advanced" =>
        !!d && ["beginner", "intermediate", "advanced"].includes(d),
    );
  // A mixed or incompletely labelled set is unknown; do not invent a document level.
  const difficulty =
    known.length &&
    known.length === item.questions.length &&
    new Set(known).size === 1
      ? known[0]
      : null;
  return {
    due,
    attempts: attempts.length,
    correct,
    total,
    wrongTopics: [...topics]
      .filter(([, v]) => v.wrong > 0)
      .map(([topic, count]) => ({ topic, ...count }))
      .sort((a, b) => b.wrong - a.wrong)
      .slice(0, 3),
    difficulty,
  };
}

export function canEvaluateRecommendation(
  item: LearningItem,
  learning: LearningState,
  now = Date.now(),
) {
  return (
    recommendationEvidence(item, learning, now).attempts > 0 ||
    learning.events.some(
      (e) =>
        e.itemId === item.id &&
        recentDate(e.at, now) &&
        ["read", "chat", "summary", "notes", "quiz", "review"].includes(e.kind),
    ) ||
    learning.reviews.some(
      (r) =>
        r.itemId === item.id &&
        recentDate(r.reviewedAt, now) &&
        item.cards.some(
          (c) =>
            c.id === r.cardId &&
            cardFingerprint(c.front, c.back) === r.fingerprint,
        ),
    )
  );
}

/** Greedy variety reranking: a repeated subject or format cannot monopolise the first page. */
function diversify(ranked: Recommendation[], vectors: Map<string, number[]>) {
  const remaining = [...ranked],
    selected: Recommendation[] = [];
  while (remaining.length && selected.length < 12) {
    let best = 0,
      bestValue = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const similarity = selected.length
        ? Math.max(
            ...selected.map((s) =>
              dot(vectors.get(s.item.id)!, vectors.get(candidate.item.id)!),
            ),
          )
        : 0;
      const formatCount = selected.filter(
        (s) => s.item.kind === candidate.item.kind,
      ).length;
      const value =
        candidate.score -
        similarity * 0.13 -
        Math.max(0, formatCount - 1) * 0.08;
      if (value > bestValue) {
        bestValue = value;
        best = i;
      }
    }
    selected.push(remaining.splice(best, 1)[0]);
  }
  return [...selected, ...remaining];
}
export function recommend(
  items: LearningItem[],
  learning: LearningState,
  preferences: Preferences,
  now = Date.now(),
) {
  const candidates = items.slice(-1000),
    byId = new Map(candidates.map((i) => [i.id, i]));
  const vectors = new Map(candidates.map((i) => [i.id, featureVector(i)]));
  const explicit = preferences.feedback
    .filter(
      (f) =>
        byId.has(f.itemId) &&
        Number.isFinite(Date.parse(f.at)) &&
        Date.parse(f.at) <= now,
    )
    .slice(-MAX_TRAINING_EXAMPLES);
  const positives = explicit.filter((f) => f.value === 1).length,
    negatives = explicit.length - positives;
  const examples = explicit.map((f) => ({
    x: vectors.get(f.itemId)!,
    y: f.value,
  }));
  const model =
    preferences.enabled &&
    positives >= 4 &&
    negatives >= 4 &&
    examples.length >= 12
      ? trainRanker(
          examples,
          examples.length >= 40 && positives >= 10 && negatives >= 10,
        )
      : null;
  const profile = Array<number>(SIZE).fill(0),
    topics = new Map<string, number>();
  if (preferences.enabled) {
    const recent = learning.events
      .filter(
        (e) =>
          e.itemId &&
          now - Date.parse(e.at) <= 90 * 86400000 &&
          Date.parse(e.at) <= now,
      )
      .slice(-500);
    for (const event of recent) {
      const item = byId.get(event.itemId!);
      if (!item) continue;
      const age = (now - Date.parse(event.at)) / 86400000;
      const weight = Math.exp(-age / 30);
      vectors.get(item.id)!.forEach((n, j) => (profile[j] += n * weight));
      words(item.title).forEach((w) =>
        topics.set(w, (topics.get(w) || 0) + weight),
      );
    }
    for (const f of explicit.filter((f) => f.value === 1)) {
      vectors.get(f.itemId)!.forEach((n, j) => (profile[j] += n * 2));
      words(byId.get(f.itemId)!.title).forEach((w) =>
        topics.set(w, (topics.get(w) || 0) + 2),
      );
    }
  }
  const unitProfile = norm(profile),
    topTerms = [...topics]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([w]) => w);
  const controls = preferences.controls || defaultRecommendationControls();
  const outcomes = (preferences.outcomes || []).filter(
    (o) =>
      byId.has(o.itemId) &&
      Number.isFinite(Date.parse(o.at)) &&
      Date.parse(o.at) <= now,
  );
  const ranked: Recommendation[] = candidates
    .map((item) => {
      const feedback = explicit.find((f) => f.itemId === item.id)?.value;
      const evidence = recommendationEvidence(item, learning, now);
      const due = evidence.due > 0;
      const practice =
        evidence.total > 0 && evidence.correct / evidence.total < 0.7;
      const tokens = new Set(
        words(
          item.title +
            " " +
            item.text.slice(0, 16000) +
            " " +
            (item.questions || []).map((q) => q.topic || "").join(" "),
        ),
      );
      const chosenTopics = preferences.enabled
        ? controls.topics.filter((t) => words(t).some((w) => tokens.has(w)))
        : [];
      const levelFit =
        preferences.enabled &&
        controls.difficulty !== "any" &&
        evidence.difficulty === controls.difficulty;
      const goal = preferences.enabled ? controls.goal : "balanced";
      const goalBonus =
        goal === "review" && due
          ? 0.2
          : goal === "practice" &&
              (practice || (item.questions?.length || 0) > 0)
            ? 0.16
            : goal === "explore" && !item.lastOpenedAt
              ? 0.14
              : 0;
      const terms = topTerms.filter((w) => tokens.has(w)).slice(0, 3);
      // Hashed vectors also encode format and can collide. A related-content
      // explanation requires an actual shared topic word, not cosine alone.
      const similarity =
        preferences.enabled && terms.length > 0
          ? dot(unitProfile, vectors.get(item.id)!)
          : 0;
      const base =
        (due ? 0.28 : 0) +
        (practice ? 0.22 : 0) +
        similarity * 0.4 +
        (item.favorite ? 0.08 : 0) +
        (!item.lastOpenedAt ? 0.06 : 0) +
        chosenTopics.length * 0.12 +
        (levelFit ? 0.1 : 0) +
        goalBonus;
      const value =
        (model
          ? model.predict(vectors.get(item.id)!) * 0.55 + base * 0.45
          : base) - (preferences.enabled && feedback === 0 ? 2 : 0);
      return {
        item,
        score: value,
        reason: due
          ? "review"
          : practice
            ? "practice"
            : chosenTopics.length
              ? "topic"
              : goalBonus
                ? "goal"
                : similarity > 0.1
                  ? "interest"
                  : item.favorite
                    ? "favorite"
                    : "explore",
        terms,
        feedback,
        evidence: { ...evidence, topics: chosenTopics, goal },
        outcome: outcomes.find((o) => o.itemId === item.id)?.useful,
      } as Recommendation;
    })
    .sort(
      (a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title),
    );
  return {
    items: diversify(ranked, vectors),
    method:
      model?.method ||
      (preferences.enabled && profile.some((v) => v) ? "content" : "baseline"),
    ratings: explicit.length,
    positives,
    negatives,
    topics: topTerms,
    trainingLoss: model?.loss,
    outcomes: {
      total: outcomes.length,
      useful: outcomes.filter((o) => o.useful).length,
    },
  };
}
