import type { Question } from "./types";
import { createSkillEvidence } from "./skill-evidence";

// Provenance records who supplied a local key, never assessment approval.
export function parseAnswerKeyProvenance(value: unknown) {
  if (value === undefined) return undefined;
  if (value === "ai-unreviewed" || value === "learner-authored") return value;
  throw new Error("INVALID_BACKUP");
}

export function localQuizSkillEvidence(
  ...args: Parameters<typeof createSkillEvidence>
): ReturnType<typeof createSkillEvidence> | undefined {
  const questions: readonly Question[] = args[0];
  // Unknown legacy keys and AI output must not become new skill observations.
  if (
    !questions.length ||
    questions.some(
      (question) => question.answerKeyProvenance !== "learner-authored",
    )
  )
    return undefined;
  return createSkillEvidence(...args);
}
