import { exportLibrary, importLibrary } from "../lumio/storage";
import { parseLearning, type LearningState } from "../lumio/learning-engine";
import { parsePreferences, type Preferences } from "../lumio/recommendations";
import type { LibraryState } from "../lumio/types";
export const MAX_SYNC_BYTES = 2 * 1024 * 1024;
export type SyncEnvelope = {
  version: 1;
  library: LibraryState;
  learning: LearningState;
  preferences: Preferences;
};
export type SyncSnapshot = {
  epoch: string;
  revision: number;
  digest: string | null;
  updatedAt: string;
  expiresAt: string;
  data: SyncEnvelope | null;
};
/** Missing additive controls mean an older writer cannot express that field.
 * Explicit [] / null clears are retained. Call after validation, then validate
 * the combined envelope again so preservation cannot exceed size limits. */
export function preserveOptionalLearningFields(
  previous: SyncEnvelope | null,
  incoming: SyncEnvelope,
): SyncEnvelope {
  if (!previous) return incoming;
  return {
    ...incoming,
    learning: {
      ...incoming.learning,
      ...(incoming.learning.reviewOverrides === undefined &&
      previous.learning.reviewOverrides !== undefined
        ? { reviewOverrides: previous.learning.reviewOverrides }
        : {}),
    },
    preferences: {
      ...incoming.preferences,
      ...(incoming.preferences.excludedSkillAttemptIds === undefined &&
      previous.preferences.excludedSkillAttemptIds !== undefined
        ? {
            excludedSkillAttemptIds:
              previous.preferences.excludedSkillAttemptIds,
          }
        : {}),
      ...(incoming.preferences.studyFocusSkillId === undefined &&
      previous.preferences.studyFocusSkillId !== undefined
        ? { studyFocusSkillId: previous.preferences.studyFocusSkillId }
        : {}),
    },
  };
}
/** The shared contract contains no binary files, live timer, auth token or API key. */
export function normalizeSyncEnvelope(value: unknown): SyncEnvelope {
  if (
    !value ||
    typeof value !== "object" ||
    (value as SyncEnvelope).version !== 1
  )
    throw Error("INVALID_SYNC_DATA");
  const v = value as SyncEnvelope;
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_SYNC_BYTES)
    throw Error("SYNC_TOO_LARGE");
  const library = importLibrary(exportLibrary(v.library));
  // Saved JPEG frame previews are media bytes too; they stay on the device.
  library.items = library.items.map((item) => ({
    ...item,
    ...(item.artifacts
      ? { artifacts: item.artifacts.map(({ frames, ...artifact }) => artifact) }
      : {}),
  }));
  if (library.items.length > 100) throw Error("SYNC_TOO_LARGE");
  const learning = parseLearning(v.learning),
    p = parsePreferences(v.preferences);
  if (
    new Set(learning.events.map((event) => event.id)).size !==
    learning.events.length
  )
    throw Error("INVALID_SYNC_DATA");
  const preferences: Preferences = {
    ...p,
    ...(p.controls
      ? {
          controls: {
            topics: [...p.controls.topics],
            difficulty: p.controls.difficulty,
            goal: p.controls.goal,
          },
        }
      : {}),
  };
  // A running focus timer and custom alarm media belong to the current device.
  const result: SyncEnvelope = {
    version: 1,
    library,
    learning: {
      version: 1,
      focus: null,
      tasks: learning.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        date: t.date,
        minutes: t.minutes,
        itemId: t.itemId,
        done: t.done,
        createdAt: t.createdAt,
        ...(t.completedAt === undefined ? {} : { completedAt: t.completedAt }),
      })),
      reviews: learning.reviews.map((r) => ({
        key: r.key,
        itemId: r.itemId,
        cardId: r.cardId,
        fingerprint: r.fingerprint,
        interval: r.interval,
        ease: r.ease,
        repetitions: r.repetitions,
        reviewedAt: r.reviewedAt,
        dueAt: r.dueAt,
      })),
      ...(learning.reviewOverrides === undefined
        ? {}
        : {
            reviewOverrides: learning.reviewOverrides.map((r) => ({
              key: r.key,
              itemId: r.itemId,
              cardId: r.cardId,
              fingerprint: r.fingerprint,
              dueAt: r.dueAt,
              updatedAt: r.updatedAt,
            })),
          }),
      events: learning.events.map((e) => ({
        id: e.id,
        at: e.at,
        kind: e.kind,
        ...(e.localDay === undefined ? {} : { localDay: e.localDay }),
        ...(e.minutes === undefined ? {} : { minutes: e.minutes }),
        ...(e.rating === undefined ? {} : { rating: e.rating }),
        ...(e.itemId === undefined ? {} : { itemId: e.itemId }),
      })),
    },
    preferences,
  };
  // URL canonicalization may expand Unicode into percent escapes. A stored
  // snapshot must satisfy the exact same contract when read back later.
  importLibrary(exportLibrary(result.library));
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_SYNC_BYTES)
    throw Error("SYNC_TOO_LARGE");
  return result;
}
