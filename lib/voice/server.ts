import { AIError, record } from "../ai/contracts";
import {
  VOICE_IDS,
  VOICE_LANGUAGES,
  VOICE_LIMITS,
  type VoiceId,
  type VoiceLanguage,
} from "./options";

// Provider-specific identifiers never leave this server module.
const voices: Record<VoiceId, string> = {
  clear: "eve",
  calm: "luna",
  warm: "ara",
};
export function voiceLanguage(
  value: unknown,
  optional = false,
): VoiceLanguage | undefined {
  if (optional && (value === null || value === undefined || value === ""))
    return undefined;
  if (!VOICE_LANGUAGES.includes(value as VoiceLanguage))
    throw new AIError("INVALID_LANGUAGE");
  return value as VoiceLanguage;
}
export function speechInput(raw: unknown) {
  const input = record(raw);
  if (
    typeof input.text !== "string" ||
    !input.text.trim() ||
    input.text.length > VOICE_LIMITS.speechCharacters
  )
    throw new AIError("INVALID_INPUT");
  const language = voiceLanguage(input.language)!;
  if (input.voice !== undefined && !VOICE_IDS.includes(input.voice as VoiceId))
    throw new AIError("INVALID_VOICE");
  return {
    text: input.text.trim(),
    language: language === "zh-CN" ? "zh" : language,
    voice_id:
      input.voice === undefined
        ? process.env.XAI_VOICE || "eve"
        : voices[input.voice as VoiceId],
    output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 128000 },
  };
}
export function transcriptionForm(data: FormData, model: string) {
  const file = data.get("file");
  if (
    !(file instanceof File) ||
    !file.size ||
    file.size > VOICE_LIMITS.audioBytes ||
    !/^audio\/(webm|ogg|mp4|mpeg|mp3|wav|x-wav|flac|aac|m4a)(?:;|$)/i.test(
      file.type,
    )
  )
    throw new AIError("INVALID_MEDIA");
  const language = voiceLanguage(data.get("language"), true);
  const form = new FormData();
  form.set("model", model);
  // Chinese is not documented for formatted STT; automatic transcription remains available.
  if (language && language !== "zh-CN") {
    form.set("language", language);
    form.set("format", "true");
  }
  // The upstream batch API requires the file field after all other fields.
  form.set("file", file);
  return form;
}
