import { RECORDING_MIMES, VOICE_LIMITS, recordingExtension } from "./options";

export const MEETING_LIMITS = {
  seconds: 10 * 60,
  sessionSeconds: 30 * 60,
  bytes: VOICE_LIMITS.audioBytes,
  audioBitsPerSecond: 64_000,
} as const;
export type MeetingSource = "tab" | "window" | "screen" | "unknown";
export type MeetingPhase =
  "idle" | "selecting" | "recording" | "paused" | "finishing";
export type MeetingError =
  | "unsupported"
  | "denied"
  | "unavailable"
  | "noAudio"
  | "microphone"
  | "failed"
  | "empty"
  | "size";
export type MeetingNotice = "duration" | "session" | "ended" | null;
export type MeetingRecording = {
  blob: Blob;
  filename: string;
  mime: string;
  seconds: number;
  source: MeetingSource;
  microphone: boolean;
};
export type MeetingSnapshot = {
  phase: MeetingPhase;
  seconds: number;
  bytes: number;
  source: MeetingSource;
  label: string;
  microphone: boolean;
  error: MeetingError | null;
  notice: MeetingNotice;
};
export const initialMeetingSnapshot = (): MeetingSnapshot => ({
  phase: "idle",
  seconds: 0,
  bytes: 0,
  source: "unknown",
  label: "",
  microphone: false,
  error: null,
  notice: null,
});
export function meetingSource(surface: unknown): MeetingSource {
  return surface === "browser"
    ? "tab"
    : surface === "window"
      ? "window"
      : surface === "monitor"
        ? "screen"
        : "unknown";
}
export function meetingClock(seconds: number) {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
export function meetingCaptureError(error: unknown): MeetingError {
  const name =
    error && typeof error === "object" && "name" in error
      ? String(error.name)
      : "";
  return name === "NotAllowedError"
    ? "denied"
    : name === "NotFoundError" || name === "NotReadableError"
      ? "unavailable"
      : "failed";
}
export function stopCaptureStreams(
  ...streams: Array<MediaStream | null | undefined>
) {
  const tracks = new Set(
    streams.flatMap((stream) => stream?.getTracks() || []),
  );
  for (const track of tracks) {
    try {
      track.stop();
    } catch {
      /* Continue stopping all remaining owned tracks. */
    }
  }
}
export type MeetingEnvironment = {
  sourceOverride?: MeetingSource;
  display: () => Promise<MediaStream>;
  microphone: () => Promise<MediaStream>;
  supportsMime: (mime: string) => boolean;
  audioStream: (tracks: MediaStreamTrack[]) => MediaStream;
  recorder: (
    stream: MediaStream,
    options: MediaRecorderOptions,
  ) => MediaRecorder;
  mix: (
    display: MediaStream,
    microphone: MediaStream,
    signal: AbortSignal,
  ) => Promise<{ stream: MediaStream; dispose: () => void | Promise<void> }>;
  now: () => number;
  repeat: (callback: () => void) => ReturnType<typeof setInterval>;
  clearRepeat: (id: ReturnType<typeof setInterval>) => void;
};

/** Owns every capture resource. No network transport or permission persistence. */
export class MeetingCapture {
  private state = initialMeetingSnapshot();
  private displayStream: MediaStream | null = null;
  private microphoneStream: MediaStream | null = null;
  private audio: MediaStream | null = null;
  private mixer: { dispose: () => void | Promise<void> } | null = null;
  private setupAbort: AbortController | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private ended: Array<{ track: MediaStreamTrack; listener: () => void }> = [];
  private generation = 0;
  private disposed = false;
  private startedAt = 0;
  private sessionAt = 0;
  private accumulated = 0;
  constructor(
    private env: MeetingEnvironment,
    private changed: (state: MeetingSnapshot) => void,
    private completed: (recording: MeetingRecording) => void,
  ) {}
  private publish(patch: Partial<MeetingSnapshot>) {
    this.state = { ...this.state, ...patch };
    if (!this.disposed) this.changed({ ...this.state });
  }
  private duration() {
    return (
      this.accumulated +
      (this.state.phase === "recording"
        ? Math.max(0, this.env.now() - this.startedAt)
        : 0)
    );
  }
  private watch(stream: MediaStream, pendingError: MeetingError) {
    for (const track of stream.getTracks()) {
      const listener = () => {
        if (this.state.phase === "selecting") this.abort(pendingError);
        else this.stop("ended");
      };
      track.addEventListener("ended", listener);
      this.ended.push({ track, listener });
    }
  }
  private release() {
    this.setupAbort?.abort();
    this.setupAbort = null;
    if (this.timer !== null) this.env.clearRepeat(this.timer);
    this.timer = null;
    for (const entry of this.ended)
      entry.track.removeEventListener("ended", entry.listener);
    this.ended = [];
    stopCaptureStreams(this.displayStream, this.microphoneStream, this.audio);
    this.displayStream = this.microphoneStream = this.audio = null;
    const mixer = this.mixer;
    this.mixer = null;
    if (mixer) {
      try {
        void Promise.resolve(mixer.dispose()).catch(() => {});
      } catch {
        /* Tracks already stopped. */
      }
    }
  }
  private abort(error: MeetingError | null = null) {
    this.generation++;
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder) {
      recorder.ondataavailable = recorder.onstop = recorder.onerror = null;
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        /* Always release below. */
      }
    }
    this.chunks = [];
    this.release();
    this.publish({ phase: "idle", error, notice: null });
  }
  async start(includeMicrophone = false) {
    if (this.disposed || this.state.phase !== "idle") return;
    const mime = RECORDING_MIMES.find((type) => this.env.supportsMime(type));
    if (!mime) {
      this.publish({ error: "unsupported" });
      return;
    }
    const ticket = ++this.generation;
    this.setupAbort = new AbortController();
    this.chunks = [];
    this.accumulated = 0;
    this.publish({
      ...initialMeetingSnapshot(),
      phase: "selecting",
      microphone: includeMicrophone,
    });
    let stage: "display" | "microphone" | "record" = "display";
    try {
      // Called synchronously from the Start button before the first await.
      const display = await this.env.display();
      if (this.disposed || ticket !== this.generation) {
        stopCaptureStreams(display);
        return;
      }
      this.displayStream = display;
      this.watch(display, "unavailable");
      if (
        !display.getAudioTracks().some((track) => track.readyState === "live")
      ) {
        this.abort("noAudio");
        return;
      }
      const video = display.getVideoTracks()[0];
      this.sessionAt = this.env.now();
      this.timer = this.env.repeat(() => this.tick());
      this.publish({
        source:
          this.env.sourceOverride ||
          meetingSource(video?.getSettings().displaySurface),
        label: this.env.sourceOverride
          ? ""
          : (video?.label || "").slice(0, 160),
      });
      if (includeMicrophone) {
        stage = "microphone";
        const microphone = await this.env.microphone();
        if (this.disposed || ticket !== this.generation) {
          stopCaptureStreams(microphone);
          return;
        }
        this.microphoneStream = microphone;
        this.watch(microphone, "microphone");
        if (
          !microphone
            .getAudioTracks()
            .some((track) => track.readyState === "live")
        ) {
          this.abort("microphone");
          return;
        }
        stage = "record";
        const mixed = await this.env.mix(
          display,
          microphone,
          this.setupAbort!.signal,
        );
        if (this.disposed || ticket !== this.generation) {
          stopCaptureStreams(mixed.stream);
          await mixed.dispose();
          return;
        }
        this.mixer = mixed;
        this.audio = mixed.stream;
      } else {
        stage = "record";
        this.audio = this.env.audioStream(display.getAudioTracks());
      }
      if (this.audio.getVideoTracks().length)
        throw new Error("Audio-only recording required");
      if (
        !display
          .getAudioTracks()
          .some((track) => track.readyState === "live") ||
        display.getVideoTracks().some((track) => track.readyState === "ended")
      ) {
        this.abort("unavailable");
        return;
      }
      if (
        includeMicrophone &&
        !this.microphoneStream
          ?.getAudioTracks()
          .some((track) => track.readyState === "live")
      ) {
        this.abort("microphone");
        return;
      }
      if (
        !this.audio
          .getAudioTracks()
          .some((track) => track.readyState === "live")
      ) {
        this.abort("noAudio");
        return;
      }
      const recorder = this.env.recorder(this.audio, {
        mimeType: mime,
        audioBitsPerSecond: MEETING_LIMITS.audioBitsPerSecond,
      });
      this.recorder = recorder;
      recorder.ondataavailable = (event) => {
        if (ticket !== this.generation || this.disposed || !event.data.size)
          return;
        const bytes = this.state.bytes + event.data.size;
        // Discard an oversized take rather than export a truncated invalid container.
        if (bytes > MEETING_LIMITS.bytes) {
          this.abort("size");
          return;
        }
        this.chunks.push(event.data);
        this.publish({ bytes });
        if (this.state.phase === "recording" || this.state.phase === "paused")
          this.tick();
      };
      recorder.onerror = () => {
        if (ticket === this.generation) this.abort("failed");
      };
      recorder.onstop = () => {
        if (ticket !== this.generation || this.disposed) return;
        const type = recorder.mimeType || mime;
        const blob = new Blob(this.chunks, { type });
        this.chunks = [];
        this.recorder = null;
        recorder.ondataavailable = recorder.onstop = recorder.onerror = null;
        this.release();
        if (!blob.size || !type.startsWith("audio/")) {
          this.publish({ phase: "idle", error: "empty" });
          return;
        }
        const recording: MeetingRecording = {
          blob,
          mime: type,
          filename: `lumio-meeting.${recordingExtension(type)}`,
          seconds: this.state.seconds,
          source: this.state.source,
          microphone: this.state.microphone,
        };
        this.publish({ phase: "idle" });
        this.completed(recording);
      };
      // A source might end while the microphone prompt is open.
      if (
        !display
          .getAudioTracks()
          .some((track) => track.readyState === "live") ||
        display.getVideoTracks().some((track) => track.readyState === "ended")
      ) {
        this.abort("unavailable");
        return;
      }
      if (
        includeMicrophone &&
        !this.microphoneStream
          ?.getAudioTracks()
          .some((track) => track.readyState === "live")
      ) {
        this.abort("microphone");
        return;
      }
      if (
        !this.audio
          .getAudioTracks()
          .some((track) => track.readyState === "live")
      ) {
        this.abort("noAudio");
        return;
      }
      this.startedAt = this.env.now();
      recorder.start(1000);
      this.publish({ phase: "recording" });
    } catch (error) {
      if (ticket !== this.generation || this.disposed) return;
      this.abort(
        stage === "microphone" ? "microphone" : meetingCaptureError(error),
      );
    }
  }
  private tick() {
    if (this.state.phase === "selecting") {
      if (
        this.env.now() - this.sessionAt >=
        MEETING_LIMITS.sessionSeconds * 1000
      )
        this.abort("unavailable");
      return;
    }
    if (this.state.phase !== "recording" && this.state.phase !== "paused")
      return;
    const seconds = Math.min(
      MEETING_LIMITS.seconds,
      Math.floor(this.duration() / 1000),
    );
    if (seconds !== this.state.seconds) this.publish({ seconds });
    if (this.duration() >= MEETING_LIMITS.seconds * 1000) this.stop("duration");
    else if (
      this.env.now() - this.sessionAt >=
      MEETING_LIMITS.sessionSeconds * 1000
    )
      this.stop("session");
  }
  pause() {
    if (this.state.phase !== "recording" || !this.recorder) return;
    try {
      this.recorder.pause();
      this.accumulated = this.duration();
      this.publish({
        phase: "paused",
        seconds: Math.floor(this.accumulated / 1000),
      });
    } catch {
      this.abort("failed");
    }
  }
  resume() {
    if (this.state.phase !== "paused" || !this.recorder) return;
    try {
      this.recorder.resume();
      this.startedAt = this.env.now();
      this.publish({ phase: "recording" });
    } catch {
      this.abort("failed");
    }
  }
  stop(notice: MeetingNotice = null) {
    if (this.state.phase !== "recording" && this.state.phase !== "paused")
      return;
    this.accumulated = this.duration();
    this.publish({
      phase: "finishing",
      seconds: Math.min(
        MEETING_LIMITS.seconds,
        Math.floor(this.accumulated / 1000),
      ),
      notice,
    });
    try {
      this.recorder?.stop();
      this.release();
    } catch {
      this.abort("failed");
    }
  }
  cancel() {
    if (!this.disposed) this.abort();
  }
  dispose() {
    this.disposed = true;
    this.abort();
  }
}

export function browserMeetingEnvironment(
  systemAudio = false,
): MeetingEnvironment {
  return {
    ...(systemAudio ? { sourceOverride: "screen" as const } : {}),
    display: () =>
      navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
        systemAudio: "include",
        windowAudio: "system",
        selfBrowserSurface: "exclude",
        surfaceSwitching: "exclude",
      } as DisplayMediaStreamOptions),
    microphone: () =>
      navigator.mediaDevices.getUserMedia({
        video: false,
        audio: { echoCancellation: true, noiseSuppression: true },
      }),
    supportsMime: (mime) => MediaRecorder.isTypeSupported(mime),
    audioStream: (tracks) => new MediaStream(tracks),
    recorder: (stream, options) => new MediaRecorder(stream, options),
    async mix(display, microphone, signal) {
      signal.throwIfAborted();
      const context = new AudioContext();
      const nodes: AudioNode[] = [];
      let destination: MediaStreamAudioDestinationNode | null = null;
      let disposal: Promise<void> | null = null;
      const dispose = () => {
        if (disposal) return disposal;
        signal.removeEventListener("abort", aborted);
        for (const node of nodes) {
          try {
            node.disconnect();
          } catch {
            /* Continue closing resources. */
          }
        }
        stopCaptureStreams(destination?.stream);
        disposal =
          context.state === "closed" ? Promise.resolve() : context.close();
        return disposal;
      };
      const aborted = () => {
        void dispose().catch(() => {});
      };
      signal.addEventListener("abort", aborted, { once: true });
      try {
        destination = context.createMediaStreamDestination();
        nodes.push(destination);
        for (const stream of [display, microphone]) {
          const source = context.createMediaStreamSource(
            new MediaStream(stream.getAudioTracks()),
          );
          const gain = context.createGain();
          gain.gain.value = 0.7;
          source.connect(gain);
          gain.connect(destination);
          nodes.push(source, gain);
        }
        // Never connect capture audio to context.destination (speakers).
        await context.resume();
        signal.throwIfAborted();
        return {
          stream: destination.stream,
          dispose,
        };
      } catch (error) {
        await dispose();
        throw error;
      }
    },
    now: () => performance.now(),
    repeat: (callback) => setInterval(callback, 250),
    clearRepeat: (id) => clearInterval(id),
  };
}
