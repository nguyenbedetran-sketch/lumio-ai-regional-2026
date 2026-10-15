export const VOICE_IDS = ["clear", "calm", "warm"] as const;
export type VoiceId = (typeof VOICE_IDS)[number];
export const VOICE_LANGUAGES = ["vi", "en", "zh-CN", "ja", "ko"] as const;
export type VoiceLanguage = (typeof VOICE_LANGUAGES)[number];
export const VOICE_LIMITS = {
  recordingSeconds: 120,
  audioBytes: 8 * 1024 * 1024,
  questionCharacters: 4000,
  speechCharacters: 3000,
} as const;
export const RECORDING_MIMES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;
export function recordingExtension(mime: string) {
  return mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
}
