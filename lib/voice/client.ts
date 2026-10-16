import { accountHeaders, paidFetch } from "../ai/request-client";
import type { AIResult } from "../ai/contracts";
import type { SourceEvidence, SourceReference } from "../ai/grounding";
import type {
  TutorIntent,
  TutorTurnIdentity,
  MathVerification,
  TutorSessionView,
} from "../tutor/types";
import {
  recordingExtension,
  VOICE_LIMITS,
  type VoiceId,
  type VoiceLanguage,
} from "./options";
export type VoiceTutorResult = Pick<
  AIResult,
  "text" | "tutor" | "references" | "verification"
>;
export type VoiceTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  turn?: TutorTurnIdentity;
  references?: SourceReference[];
  verification?: MathVerification;
};
export async function responseError(response: Response) {
  const data = await response.json().catch(() => null);
  return new Error(
    typeof data?.error === "string" ? data.error : "PROVIDER_UNAVAILABLE",
  );
}
export async function transcribeRecording(
  blob: Blob,
  language: VoiceLanguage,
  signal: AbortSignal,
  account = "guest",
) {
  if (!blob.size || blob.size > VOICE_LIMITS.audioBytes)
    throw new Error("INVALID_MEDIA");
  const form = new FormData();
  form.set("language", language);
  form.set("file", blob, `lumio-recording.${recordingExtension(blob.type)}`);
  const response = await paidFetch(
    "/api/voice",
    {
      method: "POST",
      body: form,
      signal,
    },
    account,
  );
  if (!response.ok) throw await responseError(response);
  const result = await response.json();
  signal.throwIfAborted();
  if (typeof result.text !== "string" || !result.text.trim())
    throw new Error("EMPTY_AI_OUTPUT");
  return result.text as string;
}
export async function askVoiceTutor(
  question: string,
  turns: VoiceTurn[],
  language: VoiceLanguage,
  source: string,
  signal: AbortSignal,
  tutorSessionId?: string,
  onTutorState?: (state: import("../tutor/types").TutorState) => void,
  guidance: "hints" | "full" = "hints",
  account = "guest",
  options?: {
    sourceEvidence?: SourceEvidence;
    tutorIntent?: TutorIntent;
    onResult?: (result: VoiceTutorResult) => void;
    onRestored?: (session: TutorSessionView) => void;
  },
) {
  if (
    !question.trim() ||
    question.length > VOICE_LIMITS.questionCharacters ||
    source.length > 200000
  )
    throw new Error("INVALID_INPUT");
  const response = await paidFetch(
    "/api/ai",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        task: "chat",
        mode: "tutor",
        language,
        question: question.trim(),
        source,
        sourceEvidence: options?.sourceEvidence,
        ...(options?.tutorIntent && options.tutorIntent !== "progress"
          ? { tutorIntent: options.tutorIntent }
          : {}),
        tutorSessionId,
        guidance,
        goal: "This is a spoken tutoring conversation. Keep the reply concise and natural to read aloud; invite the learner to think before giving a full answer.",
        // Canonical history is loaded from the owned server session.
        history: [],
      }),
    },
    account,
  );
  const result = await response.json();
  signal.throwIfAborted();
  if (
    response.status === 409 &&
    result.error === "AI_REQUEST_COMPLETED" &&
    typeof result.receipt?.tutorSessionId === "string"
  ) {
    const restored = await fetch(
      `/api/tutor/session?sessionId=${encodeURIComponent(result.receipt.tutorSessionId)}`,
      { headers: accountHeaders(account), signal, cache: "no-store" },
    );
    if (!restored.ok) throw await responseError(restored);
    const session = (await restored.json()) as TutorSessionView;
    signal.throwIfAborted();
    const turn = session.turns.at(-1);
    if (!turn) throw new Error("EMPTY_AI_OUTPUT");
    onTutorState?.(session);
    options?.onRestored?.(session);
    options?.onResult?.({
      text: turn.assistant,
      tutor: session,
      references: turn.references,
      verification: turn.verification,
    });
    return turn.assistant;
  }
  if (result.tutor) onTutorState?.(result.tutor);
  if (!response.ok)
    throw new Error(
      typeof result.error === "string" ? result.error : "PROVIDER_UNAVAILABLE",
    );
  if (typeof result.text !== "string" || !result.text.trim())
    throw new Error("EMPTY_AI_OUTPUT");
  options?.onResult?.(result as AIResult);
  return result.text as string;
}
export async function synthesizeVoice(
  text: string,
  language: VoiceLanguage,
  voice: VoiceId,
  signal: AbortSignal,
  account = "guest",
) {
  const response = await paidFetch(
    "/api/voice",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        text: text.slice(0, VOICE_LIMITS.speechCharacters),
        language,
        voice,
      }),
    },
    account,
  );
  if (!response.ok) throw await responseError(response);
  if (!response.headers.get("content-type")?.startsWith("audio/"))
    throw new Error("EMPTY_AI_OUTPUT");
  const blob = await response.blob();
  signal.throwIfAborted();
  if (!blob.size || blob.size > 12 * 1024 * 1024)
    throw new Error("EMPTY_AI_OUTPUT");
  return blob;
}
export function voiceTranscript(
  turns: VoiceTurn[],
  labels: { you: string; assistant: string },
) {
  return turns
    .map(
      (turn) =>
        `${turn.role === "user" ? labels.you : labels.assistant}:\n${turn.text}`,
    )
    .join("\n\n");
}
