import type { StudySummary } from "../ai/summary";
export const SUMMARY_JOB_LIMITS = {
  sourceCharacters: 120000,
  chunkCharacters: 10000,
  parts: 12,
  videoSeconds: 7200,
  attempts: 3,
  // Longer than the shared 180s runtime AI lease: crashed work cannot be
  // reclaimed while its own quota lease is still active.
  leaseMs: 210000,
  retentionMs: 7 * 86400000,
  activePerAccount: 3,
  retainedPerAccount: 12,
} as const;
export type SummaryJobStatus =
  | "queued"
  | "running"
  | "retry_wait"
  | "paused"
  | "completed"
  | "cancelled"
  | "failed";
export type SummaryJobInput = {
  title: string;
  clientItemId?: string;
  source?: string;
  youtubeUrl?: string;
  durationSeconds?: number;
  language: "vi" | "en" | "ja" | "ko" | "zh-CN";
};
export type SummaryJobView = {
  id: string;
  title: string;
  clientItemId?: string;
  sourceDigest: string;
  sourceType: "text" | "youtube";
  status: SummaryJobStatus;
  completed: number;
  total: number;
  attempts: number;
  error?: string;
  nextAttemptAt?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};
export type SummaryJobResult = {
  summary: StudySummary;
  /** Real source coverage; does not assert semantic accuracy of generated content. */
  coverage:
    | {
        type: "text";
        characters: number;
        parts: { start: number; end: number }[];
      }
    | {
        type: "youtube";
        durationSeconds: number;
        durationBasis: "declared";
        parts: { startSeconds: number; endSeconds: number }[];
      };
};
export type SummaryJobDetail = SummaryJobView & { result?: SummaryJobResult };
