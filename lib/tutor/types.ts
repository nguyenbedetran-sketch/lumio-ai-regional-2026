export const REQUIRED_HINTS = 3;
export const TUTOR_RETENTION_MS = 7 * 86400000;
export type TutorState = {
  sessionId: string;
  hintCount: number;
  requiredHints: 3;
  canUnlock: boolean;
  guidance: "hints" | "full";
  revision: number;
  expiresAt: string;
  needsClarification?: boolean;
};
export type MathVerification = {
  status: "verified" | "not_supported" | "inconsistent";
  equation?: string;
  method?: string;
  candidates?: { value: number; valid: boolean; reason?: string }[];
  conditions?: string[];
  complete?: boolean;
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
  studentCheck?: MathVerification;
  triedSolutions?: number[];
};
