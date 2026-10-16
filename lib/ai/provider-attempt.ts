/** Trusted server-only transport observer. Never copied from client AIInput JSON. */
export const PROVIDER_ATTEMPT_FEATURES = [
  "learner.chat",
  "learner.tutor",
  "learner.summary",
  "learner.cards",
  "learner.quiz",
  "teacher.lesson",
  "teacher.questions",
  "teacher.feedback",
  "teacher.assistant",
  "job.summary-part",
] as const;
export type ProviderAttemptFeature = (typeof PROVIDER_ATTEMPT_FEATURES)[number];
export type ProviderAttemptPreparation = {
  provider: "openai" | "gemini";
  requestedModel: string;
  endpointKind: "responses" | "generate-content";
};
export type ProviderAttemptObservation = {
  status:
    | "response_received"
    | "network_unknown"
    | "timeout_unknown"
    | "cancelled_unknown";
  httpStatus?: number | null;
  responseModel?: string | null;
  providerRequestId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedTokens?: number | null;
  totalTokens?: number | null;
  reasoningTokens?: number | null;
  usageSource?: "openai-response-usage" | "gemini-usage-metadata" | null;
  latencyMs?: number | null;
  safeErrorCode?: string | null;
};
export type ProviderAttemptObserver = {
  prepare(details: ProviderAttemptPreparation): {
    finish(observation: ProviderAttemptObservation): void;
  };
};
export type ProviderAttemptContext = {
  userId: string;
  sessionVersion: number;
  requestId: string;
  reservationId: string;
  feature: ProviderAttemptFeature;
};
export const observedInteger = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
export function safeProviderIdentifier(value: unknown): string | null {
  return typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,99}$/.test(value) &&
    !/(?:sk-|xai-|AIza|GOCSPX-|Bearer)/i.test(value)
    ? value
    : null;
}
