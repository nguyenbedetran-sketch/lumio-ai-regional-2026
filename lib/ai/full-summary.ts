import type { AIInput, AIResult } from "./contracts";
import {
  formatTime,
  validateSummary,
  type StudySummary,
  type SummaryCoverage,
} from "./summary";

// Each request keeps the existing server authentication, entitlement and credit checks.
// Ten-minute parts are accepted by the initial Free video entitlement.
export const FULL_SUMMARY_LIMITS = {
  partSeconds: 600,
  durationSeconds: 43200,
  parts: 72,
} as const;
export type VideoPart = { startSeconds: number; endSeconds: number };
export type SummaryProgress = {
  completed: number;
  total: number;
  part: VideoPart;
};

export function wholeVideoParts(duration: number): VideoPart[] {
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > FULL_SUMMARY_LIMITS.durationSeconds
  )
    throw new Error("FULL_DURATION_REQUIRED");
  const end = Math.ceil(duration);
  const parts: VideoPart[] = [];
  for (let start = 0; start < end; start += FULL_SUMMARY_LIMITS.partSeconds)
    parts.push({
      startSeconds: start,
      endSeconds: Math.min(end, start + FULL_SUMMARY_LIMITS.partSeconds),
    });
  return parts;
}

export function validateCoverage(value: unknown): SummaryCoverage {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_COVERAGE");
  const v = value as Record<string, unknown>;
  if (
    v.scope !== "whole" ||
    !["segmented-video", "full-media", "full-text"].includes(String(v.method))
  )
    throw new Error("INVALID_COVERAGE");
  if (v.method !== "segmented-video") {
    if (
      v.parts !== undefined ||
      v.durationSeconds !== undefined ||
      v.durationBasis !== undefined
    )
      throw new Error("INVALID_COVERAGE");
    return { scope: "whole", method: v.method as "full-media" | "full-text" };
  }
  if (
    !Number.isInteger(v.durationSeconds) ||
    !["metadata", "declared"].includes(String(v.durationBasis))
  )
    throw new Error("INVALID_COVERAGE");
  const expected = wholeVideoParts(Number(v.durationSeconds));
  if (!Array.isArray(v.parts) || v.parts.length !== expected.length)
    throw new Error("INVALID_COVERAGE");
  for (let i = 0; i < expected.length; i++) {
    const actual = v.parts[i];
    if (
      !actual ||
      actual.startSeconds !== expected[i].startSeconds ||
      actual.endSeconds !== expected[i].endSeconds
    )
      throw new Error("INVALID_COVERAGE");
  }
  return {
    scope: "whole",
    method: "segmented-video",
    durationSeconds: Number(v.durationSeconds),
    durationBasis: v.durationBasis as "metadata" | "declared",
    parts: expected,
  };
}

export function mergeWholeVideo(
  title: string,
  parts: VideoPart[],
  summaries: StudySummary[],
): StudySummary {
  if (
    !parts.length ||
    parts.length !== summaries.length ||
    parts.length > FULL_SUMMARY_LIMITS.parts
  )
    throw new Error("INCOMPLETE_FULL_SUMMARY");
  const expected = wholeVideoParts(parts.at(-1)!.endSeconds);
  if (
    expected.length !== parts.length ||
    parts.some(
      (p, i) =>
        p.startSeconds !== expected[i].startSeconds ||
        p.endSeconds !== expected[i].endSeconds,
    )
  )
    throw new Error("INCOMPLETE_FULL_SUMMARY");
  const validated = summaries.map((s, i) =>
    validateSummary(s, { restore: true, range: parts[i] }),
  );
  const chapters = validated.flatMap((s) => s.chapters);
  // Preserve every chapter. The overview and map are compact navigation to all parts,
  // not a new model response that might silently omit the later source.
  const overview = validated
    .map(
      (s, i) =>
        `${formatTime(parts[i].startSeconds)}–${formatTime(parts[i].endSeconds)} · ${s.overview.slice(0, 600)}`,
    )
    .join("\n\n");
  const keyPoints = validated.map((s) =>
    (s.keyPoints[0] || s.chapters[0].summary).slice(0, 1500),
  );
  const nodes: StudySummary["mindMap"]["nodes"] = [
    {
      id: "whole",
      label: title.slice(0, 100),
      detail: `${parts.length} · ${formatTime(parts.at(-1)!.endSeconds)}`,
    },
  ];
  const edges: StudySummary["mindMap"]["edges"] = [];
  const groupSize = Math.ceil(parts.length / 24);
  let chapterOffset = 0;
  for (let i = 0; i < parts.length; i += groupSize) {
    const last = Math.min(parts.length - 1, i + groupSize - 1);
    const id = `part_${i}`;
    nodes.push({
      id,
      label: validated[i].title.slice(0, 100),
      detail:
        `${formatTime(parts[i].startSeconds)}–${formatTime(parts[last].endSeconds)} · ` +
        validated
          .slice(i, last + 1)
          .map((s) => s.title)
          .join(" · ")
          .slice(0, 1500),
      chapterIndex: chapterOffset,
    });
    edges.push({ source: "whole", target: id });
    chapterOffset += validated
      .slice(i, last + 1)
      .reduce((n, s) => n + s.chapters.length, 0);
  }
  return validateSummary(
    {
      title: title.slice(0, 200),
      overview,
      keyPoints,
      chapters,
      mindMap: { nodes, edges },
    },
    {
      restore: true,
      aggregate: true,
      range: { startSeconds: 0, endSeconds: parts.at(-1)!.endSeconds },
    },
  );
}

export async function runWholeVideoSummary(options: {
  input: AIInput;
  title: string;
  duration: number;
  signal: AbortSignal;
  request: (input: AIInput, signal: AbortSignal) => Promise<AIResult>;
  onProgress?: (progress: SummaryProgress) => void;
  completed?: StudySummary[];
  onPart?: (summaries: StudySummary[]) => void;
}): Promise<{ summary: StudySummary; parts: VideoPart[] }> {
  if (
    options.input.task !== "summary" ||
    (!options.input.youtubeUrl &&
      !options.input.media?.mimeType.startsWith("video/"))
  )
    throw new Error("INVALID_FULL_SUMMARY_SOURCE");
  const parts = wholeVideoParts(options.duration);
  if ((options.completed?.length || 0) > parts.length)
    throw new Error("INVALID_FULL_SUMMARY_CACHE");
  const summaries = (options.completed || []).map((s, i) =>
    validateSummary(s, { restore: true, range: parts[i] }),
  );
  for (let i = summaries.length; i < parts.length; i++) {
    options.signal.throwIfAborted();
    options.onProgress?.({ completed: i, total: parts.length, part: parts[i] });
    const result = await options.request(
      { ...options.input, videoRange: parts[i] },
      options.signal,
    );
    options.signal.throwIfAborted();
    if (!result.summary) throw new Error("INVALID_AI_OUTPUT");
    summaries.push(
      validateSummary(result.summary, { restore: true, range: parts[i] }),
    );
    options.onPart?.([...summaries]);
    options.onProgress?.({
      completed: i + 1,
      total: parts.length,
      part: parts[i],
    });
  }
  options.signal.throwIfAborted();
  return { summary: mergeWholeVideo(options.title, parts, summaries), parts };
}
