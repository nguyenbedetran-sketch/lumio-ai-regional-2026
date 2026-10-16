export const REQUIRED_HINTS = 3;
export const TUTOR_RETENTION_MS = 7 * 86400000;
export const TUTOR_INTENTS = [
  "progress",
  "simpler",
  "example",
  "approach",
] as const;
export type TutorIntent = (typeof TUTOR_INTENTS)[number];
export type TutorFeedback = {
  revision: number;
  usefulness: "helpful" | "not_helpful" | null;
  correctness: "possible_error" | "not_sure" | null;
  updatedAt: string;
};
export type TutorFeedbackMutation = {
  sessionId: string;
  turnId: string;
  requestId: string;
  expectedRevision: number;
  action: "set" | "delete";
  usefulness?: TutorFeedback["usefulness"];
  correctness?: TutorFeedback["correctness"];
};
export type TutorTurnIdentity = {
  id: string;
  ordinal: number;
  intent: TutorIntent;
  counted: boolean;
  feedbackRevision: number;
  feedback: TutorFeedback | null;
};
export type TutorState = {
  sessionId: string;
  hintCount: number;
  requiredHints: 3;
  canUnlock: boolean;
  guidance: "hints" | "full";
  revision: number;
  expiresAt: string;
  needsClarification?: boolean;
  latestTurn?: TutorTurnIdentity;
};
export type TutorStoredTurn = TutorTurnIdentity & {
  student: string;
  assistant: string;
  hint?: string;
  question?: string;
  guidance: "hints" | "full";
  misconception?: string;
  step?: string;
  createdAt: string;
  needsClarification: boolean;
  references?: import("../ai/grounding").SourceReference[];
  verification?: MathVerification;
};
export type TutorSessionView = TutorState & {
  problem: string;
  turns: TutorStoredTurn[];
  retentionDays: 7;
  continuity: {
    lastQuestion: string | null;
    lastStudentAttempt: string | null;
    lastStep: string | null;
    note: "recorded-not-verified";
  };
};
export type MathVerification = {
  status: "verified" | "not_supported" | "inconsistent";
  equation?: string;
  method?: string;
  candidates?: { value: number; valid: boolean; reason?: string }[];
  conditions?: string[];
  complete?: boolean;
  /** Optional V3 fields; older saved turns and mobile clients remain valid. */
  scope?: {
    candidates: "exact" | "approximate_only" | "not_supported";
    domain: "checked" | "partial" | "not_supported";
    completeness: "proved" | "incomplete" | "not_supported" | "not_requested";
    steps: "exact" | "inconsistent" | "partial" | "not_checked";
    arithmetic: "exact" | "inconsistent" | "partial" | "not_checked";
    reasoning: "not_checked";
  };
  explicitSteps?: {
    from: string;
    to: string;
    status: "equivalent" | "not_equivalent" | "not_supported";
    method: "exact_rational_polynomial";
    note: string;
  }[];
  calculations?: {
    equation: string;
    status: "exact" | "invalid" | "unknown";
  }[];
  note: string;
};
export type TutorReply = {
  hint?: string;
  question?: string;
  feedback?: string;
  misconception?: string;
  step?: string;
  solution?: string;
  candidateSolutions?: number[];
  references?: unknown;
  needsClarification?: boolean;
};
/** Server-owned context. validateInput deliberately never copies it from JSON. */
export type TutorContext = {
  problem: string;
  hints: string[];
  hintCount: number;
  guidance: "hints" | "full";
  intent?: TutorIntent;
  previousQuestion?: string;
  previousStudentAttempt?: string;
  studentCheck?: MathVerification;
  triedSolutions?: number[];
};
