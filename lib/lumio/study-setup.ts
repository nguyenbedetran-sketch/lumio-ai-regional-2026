import {
  emptyPreferences,
  parsePreferences,
  type RecommendationControls,
} from "./recommendations";

/** Same controls codec used by backup/sync and the existing recommendation engine. */
export function studyControls(values: {
  topics: unknown;
  difficulty: unknown;
  goal: unknown;
}): RecommendationControls {
  return parsePreferences({
    ...emptyPreferences(),
    controls: {
      topics: String(values.topics || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      difficulty: String(values.difficulty),
      goal: String(values.goal),
    },
  }).controls!;
}
