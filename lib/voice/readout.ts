import { VOICE_LANGUAGES, VOICE_LIMITS, type VoiceLanguage } from "./options";

export const READOUT_LIMITS = {
  characters: 200000,
  parts: 100,
  partCharacters: VOICE_LIMITS.speechCharacters,
} as const;

/** Keep all meaningful text, preferring sentence/paragraph boundaries. */
export function splitReadoutText(text: string): string[] {
  if (typeof text !== "string" || !text.trim())
    throw new Error("READOUT_EMPTY");
  if (text.length > READOUT_LIMITS.characters)
    throw new Error("READOUT_TOO_LONG");
  const source = text.trim();
  const parts: string[] = [];
  let offset = 0;
  while (offset < source.length) {
    if (parts.length >= READOUT_LIMITS.parts)
      throw new Error("READOUT_TOO_LONG");
    const remaining = source.length - offset;
    let length: number = Math.min(remaining, READOUT_LIMITS.partCharacters);
    if (remaining > length) {
      const minimum = Math.max(
        Math.floor(length / 2),
        Math.ceil(remaining / (READOUT_LIMITS.parts - parts.length)),
      );
      let sentence = 0;
      let space = 0;
      for (let index = minimum - 1; index < length; index++) {
        const char = source[offset + index];
        if (/\s/u.test(char)) space = index + 1;
        if (
          char === "\n" ||
          /[。！？]/u.test(char) ||
          (/[.!?]/u.test(char) && /\s/u.test(source[offset + index + 1] || ""))
        )
          sentence = index + 1;
      }
      length = sentence || space || length;
      const last = source.charCodeAt(offset + length - 1);
      const next = source.charCodeAt(offset + length);
      if (last >= 0xd800 && last <= 0xdbff && next >= 0xdc00 && next <= 0xdfff)
        length--;
    }
    const part = source.slice(offset, offset + length);
    if (part.trim()) parts.push(part);
    offset += length;
  }
  return parts;
}

export function readoutLanguage(
  language: string,
  fallback: VoiceLanguage = "vi",
) {
  return VOICE_LANGUAGES.includes(language as VoiceLanguage)
    ? (language as VoiceLanguage)
    : fallback;
}

export type ReadoutPhase =
  "idle" | "loading" | "ready" | "playing" | "paused" | "finished" | "error";
export type ReadoutState = {
  phase: ReadoutPhase;
  part: number;
  total: number;
  hasAudio: boolean;
  blocked: boolean;
  error: string | null;
};
export const initialReadoutState: ReadoutState = {
  phase: "idle",
  part: 0,
  total: 0,
  hasAudio: false,
  blocked: false,
  error: null,
};
type AudioPort = Pick<
  HTMLAudioElement,
  | "src"
  | "currentTime"
  | "play"
  | "pause"
  | "load"
  | "removeAttribute"
  | "addEventListener"
  | "removeEventListener"
>;
type ReadoutOptions = {
  audio: AudioPort;
  generate: (
    text: string,
    language: VoiceLanguage,
    signal: AbortSignal,
  ) => Promise<Blob>;
  onState: (state: ReadoutState) => void;
  createURL?: (blob: Blob) => string;
  revokeURL?: (url: string) => void;
};

/** One lazy request at a time. Only Start and a completed track advance it. */
export class ReadoutPlayback {
  private state: ReadoutState = { ...initialReadoutState };
  private parts: string[] = [];
  private language: VoiceLanguage = "vi";
  private generation = 0;
  private abort: AbortController | null = null;
  private url: string | null = null;
  private disposed = false;
  private readonly createURL: (blob: Blob) => string;
  private readonly revokeURL: (url: string) => void;
  private readonly ended = () => {
    if (!this.url || this.disposed || this.state.phase === "error") return;
    if (this.state.part + 1 >= this.parts.length) {
      this.emit({ phase: "finished", blocked: false });
      return;
    }
    void this.loadPart(this.state.part + 1, this.generation);
  };
  private readonly play = () => {
    if (this.url && !this.disposed && this.state.phase !== "loading")
      this.emit({ phase: "playing", blocked: false, error: null });
  };
  private readonly pause = () => {
    if (this.url && this.state.phase === "playing")
      this.emit({ phase: "paused" });
  };
  private readonly audioError = () => {
    if (this.url && !this.disposed)
      this.emit({
        phase: "error",
        error: "READOUT_PLAYBACK_FAILED",
        blocked: false,
      });
  };

  constructor(private readonly options: ReadoutOptions) {
    this.createURL = options.createURL || ((blob) => URL.createObjectURL(blob));
    this.revokeURL = options.revokeURL || ((url) => URL.revokeObjectURL(url));
    options.audio.addEventListener("ended", this.ended);
    options.audio.addEventListener("play", this.play);
    options.audio.addEventListener("pause", this.pause);
    options.audio.addEventListener("error", this.audioError);
  }

  snapshot() {
    return { ...this.state };
  }

  private emit(patch: Partial<ReadoutState>) {
    this.state = { ...this.state, ...patch };
    if (!this.disposed) this.options.onState(this.snapshot());
  }

  private releaseAudio() {
    this.options.audio.pause();
    this.options.audio.removeAttribute("src");
    this.options.audio.load();
    if (this.url) this.revokeURL(this.url);
    this.url = null;
  }

  stop() {
    this.generation++;
    this.abort?.abort();
    this.abort = null;
    this.emit({ ...initialReadoutState });
    this.releaseAudio();
    this.parts = [];
  }

  async start(text: string, language: VoiceLanguage) {
    if (this.disposed) return;
    this.stop();
    try {
      this.parts = splitReadoutText(text);
    } catch (error) {
      this.emit({
        phase: "error",
        error: error instanceof Error ? error.message : "READOUT_EMPTY",
      });
      return;
    }
    this.language = language;
    this.emit({ total: this.parts.length });
    await this.loadPart(0, this.generation);
  }

  private async loadPart(part: number, generation: number) {
    if (this.disposed || generation !== this.generation) return;
    this.abort?.abort();
    const controller = new AbortController();
    this.abort = controller;
    this.emit({
      phase: "loading",
      part,
      hasAudio: false,
      blocked: false,
      error: null,
    });
    this.releaseAudio();
    try {
      const blob = await this.options.generate(
        this.parts[part],
        this.language,
        controller.signal,
      );
      if (
        this.disposed ||
        controller.signal.aborted ||
        generation !== this.generation
      )
        return;
      if (
        !blob.size ||
        blob.size > 12 * 1024 * 1024 ||
        !blob.type.startsWith("audio/")
      )
        throw new Error("EMPTY_AI_OUTPUT");
      this.url = this.createURL(blob);
      this.options.audio.src = this.url;
      this.options.audio.load();
      this.emit({ phase: "ready", hasAudio: true });
      try {
        await this.options.audio.play();
        if (
          !this.disposed &&
          generation === this.generation &&
          !controller.signal.aborted
        )
          this.emit({ phase: "playing", blocked: false });
      } catch (error) {
        if (
          this.disposed ||
          generation !== this.generation ||
          controller.signal.aborted
        )
          return;
        if (error instanceof Error && error.name === "NotAllowedError")
          this.emit({ phase: "ready", blocked: true });
        else this.emit({ phase: "error", error: "READOUT_PLAYBACK_FAILED" });
      }
    } catch (error) {
      if (
        this.disposed ||
        generation !== this.generation ||
        controller.signal.aborted
      )
        return;
      this.emit({
        phase: "error",
        error: error instanceof Error ? error.message : "PROVIDER_UNAVAILABLE",
      });
    } finally {
      if (this.abort === controller) this.abort = null;
    }
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.options.audio.removeEventListener("ended", this.ended);
    this.options.audio.removeEventListener("play", this.play);
    this.options.audio.removeEventListener("pause", this.pause);
    this.options.audio.removeEventListener("error", this.audioError);
  }
}
