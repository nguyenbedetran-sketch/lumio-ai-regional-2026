import {
  recordingExtension,
  VOICE_LIMITS,
  type VoiceId,
  type VoiceLanguage,
} from "./options";
export type VoiceTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
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
) {
  if (!blob.size || blob.size > VOICE_LIMITS.audioBytes)
    throw new Error("INVALID_MEDIA");
  const form = new FormData();
  form.set("language", language);
  form.set("file", blob, `lumio-recording.${recordingExtension(blob.type)}`);
  const response = await fetch("/api/voice", {
    method: "POST",
    body: form,
    signal,
  });
  if (!response.ok) throw await responseError(response);
  const result = await response.json();
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
) {
  if (!question.trim() || question.length > VOICE_LIMITS.questionCharacters)
    throw new Error("INVALID_INPUT");
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      task: "chat",
      mode: "tutor",
      language,
      question: question.trim(),
      source: source.slice(0, 200000),
      tutorSessionId,
      guidance,
      goal: "This is a spoken tutoring conversation. Keep the reply concise and natural to read aloud; invite the learner to think before giving a full answer.",
      history: turns
        .slice(-6)
        .map(({ role, text }) => ({ role, text: text.slice(0, 4000) })),
    }),
  });
  if (!response.ok) throw await responseError(response);
  const result = await response.json();
  if (result.tutor) onTutorState?.(result.tutor);
  if (typeof result.text !== "string" || !result.text.trim())
    throw new Error("EMPTY_AI_OUTPUT");
  return result.text as string;
}
export async function synthesizeVoice(
  text: string,
  language: VoiceLanguage,
  voice: VoiceId,
  signal: AbortSignal,
) {
  const response = await fetch("/api/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      text: text.slice(0, VOICE_LIMITS.speechCharacters),
      language,
      voice,
    }),
  });
  if (!response.ok) throw await responseError(response);
  if (!response.headers.get("content-type")?.startsWith("audio/"))
    throw new Error("EMPTY_AI_OUTPUT");
  const blob = await response.blob();
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
