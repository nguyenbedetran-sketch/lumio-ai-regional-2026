"use client";
import { useAccountScope } from "./account-scope";
import { useEffect, useId, useRef, useState } from "react";
import {
  AudioLines,
  ArrowUp,
  Check,
  Download,
  Headphones,
  LoaderCircle,
  Mic,
  Pause,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import { languages } from "../../lib/lumio/i18n";
import type { LearningItem, ProviderStatus } from "../../lib/lumio/types";
import { aiErrorMessage } from "../../lib/lumio/ai-copy";
import { voiceCopy } from "../../lib/voice/copy";
import {
  RECORDING_MIMES,
  VOICE_IDS,
  VOICE_LIMITS,
  recordingExtension,
  type VoiceId,
  type VoiceLanguage,
} from "../../lib/voice/options";
import {
  askVoiceTutor,
  synthesizeVoice,
  transcribeRecording,
  voiceTranscript,
  type VoiceTurn,
  type VoiceTutorResult,
} from "../../lib/voice/client";
import { downloadText } from "../../lib/lumio/enhancements";
import { MathText } from "./math-text";
import { MeetingRecorder } from "./meeting-recorder";
import type { MeetingRecording } from "../../lib/voice/meeting-capture";
import { desktopCopy } from "../../lib/lumio/desktop-copy";
import { OutboundDataNotice } from "./outbound-data-notice";
import type {
  TutorState,
  TutorSessionView,
  TutorIntent,
} from "../../lib/tutor/types";
import { accountHeaders } from "../../lib/ai/request-client";
import { voiceSessionSlot, restoreVoiceTurns } from "../../lib/voice/session";
import { SourceReferences } from "./source-references";
import { TutorHelpIntent, TutorTurnFeedback } from "./tutor-support";
import {
  TutorProgress,
  MathVerificationNotice,
  tutorUICopy,
} from "./tutor-progress";

function usableVoiceSource(item: LearningItem) {
  return (
    !!item.text.trim() &&
    !(
      item.blob &&
      /\.(pdf|docx|pptx)$/i.test(item.fileName || "") &&
      !item.sourceEvidence
    )
  );
}

type Phase =
  | "idle"
  | "permission"
  | "recording"
  | "paused"
  | "transcribing"
  | "thinking"
  | "synthesizing";
export type VoiceStudioProps = {
  locale: Locale;
  providers?: ProviderStatus;
  signedIn?: boolean;
  onLogin?: () => void;
  sourceText?: string;
  materials?: readonly LearningItem[];
  onOpenMaterial?: (itemId: string) => void;
  onSaveTranscript?: (text: string) => void | Promise<void>;
  onSaveRecording?: (recording: MeetingRecording) => void | Promise<void>;
};
function useBlobURL(blob: Blob | null) {
  const [url, setURL] = useState("");
  useEffect(() => {
    if (!blob) {
      setURL("");
      return;
    }
    const next = URL.createObjectURL(blob);
    setURL(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}
function VoicePlayback({
  blob,
  locale,
  label,
  autoplay = false,
  disabled = false,
}: {
  blob: Blob;
  locale: Locale;
  label: string;
  autoplay?: boolean;
  disabled?: boolean;
}) {
  const url = useBlobURL(blob),
    c = voiceCopy[locale],
    speedId = useId();
  const player = useRef<HTMLAudioElement | null>(null);
  const requestedURL = useRef("");
  const [speed, setSpeed] = useState(1),
    [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const audio = player.current;
    if (!audio || !url) return;
    audio.playbackRate = speed;
    if (autoplay && !disabled && requestedURL.current !== url) {
      requestedURL.current = url;
      void audio.play().catch(() => setBlocked(true));
    }
    return () => audio.pause();
  }, [url, autoplay, disabled]); // Speed changes should not restart audio.
  const extension =
    blob.type.includes("mpeg") || blob.type.includes("mp3")
      ? "mp3"
      : blob.type.includes("wav")
        ? "wav"
        : recordingExtension(blob.type);
  return (
    <div className="lv-player">
      <div className="lv-player-label">
        <Headphones size={16} />
        <strong>{label}</strong>
      </div>
      <audio
        ref={player}
        controls
        preload="metadata"
        src={url || undefined}
        aria-label={label}
        onPlay={() => setBlocked(false)}
        onPlaying={() => {
          if (disabled) player.current?.pause();
        }}
      />
      <div className="lv-player-footer">
        <label htmlFor={speedId}>
          {c.speed}
          <select
            id={speedId}
            value={speed}
            onChange={(e) => {
              const value = Number(e.target.value);
              setSpeed(value);
              if (player.current) player.current.playbackRate = value;
            }}
          >
            {[0.75, 1, 1.25, 1.5, 2].map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        <a
          href={url || undefined}
          download={`lumio-voice.${extension}`}
          aria-disabled={!url}
        >
          <Download size={15} />
          {c.downloadAudio}
        </a>
      </div>
      {blocked && <small role="status">{c.playbackBlocked}</small>}
    </div>
  );
}

export function VoiceStudio({
  locale,
  providers,
  signedIn = false,
  onLogin,
  sourceText = "",
  materials = [],
  onOpenMaterial,
  onSaveTranscript,
  onSaveRecording,
}: VoiceStudioProps) {
  const c = voiceCopy[locale];
  const account = useAccountScope();
  const [sourceId, setSourceId] = useState("");
  const [sourceSelectionReady, setSourceSelectionReady] = useState(false);
  useEffect(() => {
    let value = "";
    try {
      value = localStorage.getItem(`lumio-voice-source-v2:${account}`) || "";
    } catch {}
    setSourceId(materials.some((item) => item.id === value) ? value : "");
    setSourceSelectionReady(true);
  }, [account]);
  function selectVoiceSource(id: string) {
    try {
      localStorage.setItem(`lumio-voice-source-v2:${account}`, id);
    } catch {}
    setSourceId(id);
  }
  const selectedMaterial = materials.find((item) => item.id === sourceId);
  const selectedSource = sourceId ? selectedMaterial?.text || "" : sourceText;
  const selectedEvidence = selectedMaterial?.sourceEvidence;
  const [tutorIntent, setTutorIntent] = useState<TutorIntent>("progress");
  const [restoring, setRestoring] = useState(true),
    [restoreFailed, setRestoreFailed] = useState(false),
    [restoreTick, setRestoreTick] = useState(0);
  const pointerSlot = useRef<string | null>(null);
  const [config, setConfig] = useState(providers);
  const [phase, setPhase] = useState<Phase>("idle"),
    [seconds, setSeconds] = useState(0);
  const [meetingActive, setMeetingActive] = useState(false);
  const meetingLock = useRef(false);
  const [recording, setRecording] = useState<Blob | null>(null),
    [question, setQuestion] = useState("");
  const [language, setLanguage] = useState<VoiceLanguage>(locale),
    [voice, setVoice] = useState<VoiceId>("calm");
  const [autoRead, setAutoRead] = useState(true),
    [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [tutorState, setTutorState] = useState<TutorState | null>(null);
  const [tutorGuidance, setTutorGuidance] = useState<"hints" | "full">("hints");
  const [spoken, setSpoken] = useState<{
    id: string;
    blob: Blob;
    truncated: boolean;
    autoplay: boolean;
  } | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [supported, setSupported] = useState(true),
    [saving, setSaving] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    context = useRef<AudioContext | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null),
    frame = useRef(0),
    abort = useRef<AbortController | null>(null);
  const generation = useRef(0),
    mounted = useRef(true),
    locked = useRef(false),
    elapsed = useRef(0);
  const studio = useRef<HTMLElement | null>(null);
  const transcriptId = useId(),
    uploadId = useId();
  const recordingActive = phase === "recording" || phase === "paused";
  const processing =
    phase === "transcribing" ||
    phase === "thinking" ||
    phase === "synthesizing";
  const busy = phase !== "idle",
    canTranscribe = signedIn && !!config?.capabilities?.transcription,
    canSpeak = signedIn && !!config?.capabilities?.speech,
    canAsk =
      signedIn &&
      !!config?.capabilities?.tutor &&
      (!sourceId ||
        (!!selectedMaterial && usableVoiceSource(selectedMaterial)));
  const blocked =
    busy ||
    meetingActive ||
    restoring ||
    restoreFailed ||
    !sourceSelectionReady;
  const capturing = meetingActive || recordingActive || phase === "permission";

  function pausePlayback() {
    studio.current?.querySelectorAll("audio").forEach((audio) => audio.pause());
  }

  function stopTracks() {
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    void context.current?.close().catch(() => {});
    context.current = null;
  }
  function releaseCapture() {
    try {
      if (recorder.current && recorder.current.state !== "inactive")
        recorder.current.stop();
    } catch {
      /* Track shutdown below is still required when recorder shutdown fails. */
    } finally {
      recorder.current = null;
      stopTracks();
    }
  }
  useEffect(() => {
    mounted.current = true;
    setSupported(
      window.isSecureContext &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined",
    );
    return () => {
      mounted.current = false;
      generation.current++;
      abort.current?.abort();
      releaseCapture();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    generation.current++;
    abort.current?.abort();
    releaseCapture();
    abort.current = null;
    locked.current = false;
    pausePlayback();
    setSpoken(null);
    setTurns([]);
    setTutorState(null);
    setTutorGuidance("hints");
    setTutorIntent("progress");
    setPhase("idle");
    setRestoring(true);
    setRestoreFailed(false);
    pointerSlot.current = null;
    void (async () => {
      try {
        if (!signedIn || account === "guest" || !sourceSelectionReady) return;
        const slot = await voiceSessionSlot(
          account,
          language,
          selectedSource,
          sourceId,
          selectedEvidence?.proof,
        );
        if (!active) return;
        pointerSlot.current = slot;
        const id = localStorage.getItem(slot);
        if (!id) return;
        if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id)) {
          localStorage.removeItem(slot);
          return;
        }
        const r = await fetch(
          `/api/tutor/session?sessionId=${encodeURIComponent(id)}`,
          {
            headers: accountHeaders(account),
            signal: controller.signal,
            cache: "no-store",
          },
        );
        if (!active) return;
        if (r.status === 404) {
          localStorage.removeItem(slot);
          setNotice(tutorUICopy[locale].expired);
          return;
        }
        if (!r.ok) throw new Error();
        const view = (await r.json()) as TutorSessionView;
        if (!active) return;
        setTutorState(view);
        setTurns(restoreVoiceTurns(view));
        setNotice(c.restored);
      } catch {
        if (active) setRestoreFailed(true);
      } finally {
        if (active) setRestoring(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
      generation.current++;
      abort.current?.abort();
      releaseCapture();
      pausePlayback();
    };
  }, [
    account,
    signedIn,
    sourceId,
    selectedSource,
    selectedEvidence?.proof,
    language,
    restoreTick,
    sourceSelectionReady,
  ]);
  function rememberVoice(state: TutorState) {
    setTutorState(state);
    if (pointerSlot.current)
      try {
        localStorage.setItem(pointerSlot.current, state.sessionId);
      } catch {}
  }
  function freshConversation() {
    pausePlayback();
    if (pointerSlot.current)
      try {
        localStorage.removeItem(pointerSlot.current);
      } catch {}
    setTutorState(null);
    setTutorGuidance("hints");
    setTutorIntent("progress");
    setTurns([]);
    setSpoken(null);
    setQuestion("");
    setError("");
    setNotice("");
  }
  async function deleteConversation() {
    if (!tutorState || blocked) return;
    const controller = task("thinking");
    if (!controller) return;
    try {
      const r = await fetch("/api/tutor/session", {
        method: "DELETE",
        headers: {
          ...accountHeaders(account),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId: tutorState.sessionId }),
        signal: controller.signal,
      });
      if (!r.ok) throw new Error();
      if (!controller.signal.aborted && mounted.current) freshConversation();
    } catch {
      if (!controller.signal.aborted) setError(c.deleteFailed);
    } finally {
      finish(controller);
    }
  }
  useEffect(() => {
    if (providers) {
      setConfig(providers);
      return;
    }
    const controller = new AbortController();
    fetch("/api/config", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((value) => {
        if (!controller.signal.aborted) setConfig(value || undefined);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [providers]);
  useEffect(() => {
    if (phase !== "recording") return;
    const started = performance.now(),
      base = elapsed.current;
    const timer = setInterval(() => {
      elapsed.current = base + (performance.now() - started) / 1000;
      setSeconds(
        Math.min(VOICE_LIMITS.recordingSeconds, Math.floor(elapsed.current)),
      );
      if (
        elapsed.current >= VOICE_LIMITS.recordingSeconds &&
        recorder.current?.state !== "inactive"
      )
        recorder.current?.stop();
    }, 200);
    return () => clearInterval(timer);
  }, [phase]);

  function meter(media: MediaStream) {
    try {
      const audio = new AudioContext(),
        analyser = audio.createAnalyser();
      context.current = audio;
      analyser.fftSize = 128;
      audio.createMediaStreamSource(media).connect(analyser);
      const values = new Uint8Array(analyser.frequencyBinCount);
      const draw = () => {
        const surface = canvas.current,
          pen = surface?.getContext("2d");
        if (surface && pen) {
          analyser.getByteFrequencyData(values);
          pen.clearRect(0, 0, surface.width, surface.height);
          const gradient = pen.createLinearGradient(0, 0, surface.width, 0);
          gradient.addColorStop(0, "#818cf8");
          gradient.addColorStop(1, "#c4b5fd");
          pen.fillStyle = gradient;
          for (let i = 0; i < 48; i++) {
            const height = 3 + (values[i] / 255) * 68;
            pen.beginPath();
            pen.roundRect(i * 6, (80 - height) / 2, 3, height, 2);
            pen.fill();
          }
        }
        frame.current = requestAnimationFrame(draw);
      };
      draw();
    } catch {
      /* Recording still works if a browser cannot create an audio meter. */
    }
  }
  async function startRecording() {
    if (locked.current || meetingLock.current) return;
    pausePlayback();
    if (!supported) {
      setError(c.unsupported);
      return;
    }
    locked.current = true;
    const current = ++generation.current;
    setError("");
    setNotice("");
    setPhase("permission");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!mounted.current || current !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const mime = RECORDING_MIMES.find((value) =>
        MediaRecorder.isTypeSupported(value),
      );
      const rec = new MediaRecorder(
        media,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = rec;
      const chunks: Blob[] = [];
      let bytes = 0,
        failed = false;
      setRecording(null);
      setSeconds(0);
      elapsed.current = 0;
      rec.ondataavailable = (event) => {
        if (event.data.size) {
          chunks.push(event.data);
          bytes += event.data.size;
        }
        if (bytes > VOICE_LIMITS.audioBytes && rec.state !== "inactive") {
          failed = true;
          rec.stop();
        }
      };
      rec.onerror = () => {
        failed = true;
        if (rec.state !== "inactive") rec.stop();
        media.getTracks().forEach((track) => track.stop());
        if (mounted.current && current === generation.current) {
          stopTracks();
          setError(c.recordingError);
          setPhase("idle");
          locked.current = false;
        }
      };
      rec.onstop = () => {
        media.getTracks().forEach((track) => track.stop());
        if (!mounted.current || current !== generation.current) return;
        stopTracks();
        locked.current = false;
        setPhase("idle");
        if (failed || bytes > VOICE_LIMITS.audioBytes) {
          setError(c.invalidAudio);
          return;
        }
        const blob = new Blob(chunks, { type: rec.mimeType });
        if (!blob.size) {
          setError(c.emptyAudio);
          return;
        }
        setRecording(blob);
      };
      rec.start(250);
      meter(media);
      setPhase("recording");
    } catch (caught) {
      if (!mounted.current || current !== generation.current) return;
      stopTracks();
      const name = caught instanceof DOMException ? caught.name : "";
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? c.micDenied
          : name === "NotFoundError"
            ? c.micMissing
            : c.micBusy,
      );
      setPhase("idle");
      locked.current = false;
    }
  }
  function cancel() {
    generation.current++;
    abort.current?.abort();
    abort.current = null;
    if (recorder.current?.state !== "inactive") recorder.current?.stop();
    stopTracks();
    locked.current = false;
    setPhase("idle");
    setNotice(c.cancelled);
    setError("");
  }
  function task(next: Phase) {
    if (locked.current || meetingLock.current || restoring || restoreFailed)
      return null;
    pausePlayback();
    locked.current = true;
    const controller = new AbortController();
    abort.current = controller;
    setPhase(next);
    setError("");
    setNotice("");
    return controller;
  }
  function finish(controller: AbortController) {
    if (abort.current !== controller || !mounted.current) return;
    abort.current = null;
    locked.current = false;
    setPhase("idle");
  }
  function showError(caught: unknown, controller: AbortController) {
    if (controller.signal.aborted || !mounted.current) return;
    const code =
      caught instanceof Error ? caught.message : "PROVIDER_UNAVAILABLE";
    setError(
      code === "INVALID_MEDIA" ? c.invalidAudio : aiErrorMessage(code, locale),
    );
  }
  async function transcribe() {
    if (!recording) return;
    const controller = task("transcribing");
    if (!controller) return;
    try {
      const text = await transcribeRecording(
        recording,
        language,
        controller.signal,
        account,
      );
      if (!controller.signal.aborted && mounted.current) setQuestion(text);
    } catch (caught) {
      showError(caught, controller);
    } finally {
      finish(controller);
    }
  }
  async function makeSpeech(turn: VoiceTurn, controller: AbortController) {
    setPhase("synthesizing");
    const blob = await synthesizeVoice(
      turn.text,
      language,
      voice,
      controller.signal,
      account,
    );
    if (!controller.signal.aborted && mounted.current)
      setSpoken({
        id: turn.id,
        blob,
        truncated: turn.text.length > VOICE_LIMITS.speechCharacters,
        autoplay: true,
      });
  }
  async function send() {
    if (
      !canAsk ||
      !question.trim() ||
      question.length > VOICE_LIMITS.questionCharacters
    )
      return;
    const controller = task("thinking");
    if (!controller) return;
    const input = question.trim();
    let metadata: VoiceTutorResult | undefined;
    let restored = false;
    try {
      const text = await askVoiceTutor(
        input,
        turns,
        language,
        selectedSource,
        controller.signal,
        tutorState?.sessionId,
        (state) => {
          if (!controller.signal.aborted && mounted.current)
            rememberVoice(state);
        },
        tutorGuidance,
        account,
        {
          sourceEvidence: selectedEvidence,
          tutorIntent,
          onResult: (value) => {
            metadata = value;
          },
          onRestored: (view) => {
            if (!controller.signal.aborted && mounted.current) {
              restored = true;
              setTurns(restoreVoiceTurns(view));
            }
          },
        },
      );
      if (controller.signal.aborted || !mounted.current) return;
      const reply: VoiceTurn = {
        id: metadata?.tutor?.latestTurn?.id || crypto.randomUUID(),
        role: "assistant",
        text,
        turn: metadata?.tutor?.latestTurn,
        references: metadata?.references,
        verification: metadata?.verification,
      };
      if (!restored)
        setTurns((previous) => [
          ...previous,
          { id: crypto.randomUUID(), role: "user", text: input },
          reply,
        ]);
      setQuestion("");
      setTutorIntent("progress");
      if (autoRead && canSpeak) await makeSpeech(reply, controller);
    } catch (caught) {
      showError(caught, controller);
    } finally {
      finish(controller);
    }
  }
  async function read(turn: VoiceTurn) {
    const controller = task("synthesizing");
    if (!controller) return;
    try {
      await makeSpeech(turn, controller);
    } catch (caught) {
      showError(caught, controller);
    } finally {
      finish(controller);
    }
  }
  async function save() {
    if (!onSaveTranscript || saving) return;
    setSaving(true);
    try {
      await onSaveTranscript(voiceTranscript(turns, c));
      setNotice(c.saved);
    } catch {
      setError(
        locale === "vi"
          ? "Chưa lưu được ghi chú. Hãy thử lại hoặc tải cuộc trò chuyện."
          : "Could not save notes. Retry or download the conversation.",
      );
    } finally {
      if (mounted.current) setSaving(false);
    }
  }
  const status = phase === "idle" ? c.ready : c[phase];
  useEffect(() => {
    const stop = () => {
      if (recorder.current && recorder.current.state !== "inactive")
        recorder.current.stop();
      else if (locked.current) cancel();
    };
    window.addEventListener("lumio:stop-capture", stop);
    return () => window.removeEventListener("lumio:stop-capture", stop);
  }, [locale]);
  return (
    <section ref={studio} className="lv-studio" aria-label="Lumio Voice">
      <header className="lv-header">
        <div>
          <span className="lv-eyebrow">
            <AudioLines size={16} />
            {c.eyebrow}
          </span>
          <h1>{c.title}</h1>
          <p>{c.subtitle}</p>
        </div>
        <span className="lv-turn-badge">
          <span />
          {c.turnBased}
        </span>
      </header>
      {config?.desktop && (
        <div className="lv-signin">
          <ShieldCheck size={19} />
          <p>{desktopCopy[locale].detail}</p>
          <a
            className="lm-button"
            href="http://localhost:3000/"
            target="_blank"
            rel="noreferrer"
          >
            {desktopCopy[locale].web}
          </a>
        </div>
      )}
      {!signedIn && !config?.publicDemo && !config?.desktop && (
        <div className="lv-signin">
          <ShieldCheck size={19} />
          <p>{c.signInHint}</p>
          {onLogin && (config?.google || config?.facebook) && (
            <button className="lm-button" onClick={onLogin}>
              {c.signIn}
            </button>
          )}
        </div>
      )}
      <MeetingRecorder
        locale={locale}
        disabled={busy}
        onActiveChange={(active) => {
          meetingLock.current = active;
          setMeetingActive(active);
          if (active) pausePlayback();
        }}
        onSaveRecording={onSaveRecording}
        onUseRecording={
          config?.desktop
            ? undefined
            : (result) => {
                if (locked.current) return;
                pausePlayback();
                setRecording(result.blob);
                setSeconds(Math.floor(result.seconds));
                setError("");
                setNotice("");
              }
        }
      />
      <div className="lm-panel" style={{ marginBlock: 16, minWidth: 0 }}>
        <label style={{ display: "grid", gap: 8, minWidth: 0 }}>
          {c.sourcePicker}
          <select
            style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
            value={sourceId}
            disabled={busy || meetingActive}
            onChange={(e) => selectVoiceSource(e.target.value)}
          >
            <option value="">{c.noSource}</option>
            {materials.map((item) => (
              <option
                key={item.id}
                value={item.id}
                disabled={!usableVoiceSource(item)}
              >
                {item.title}
                {!usableVoiceSource(item) ? ` — ${c.extractFirst}` : ""}
              </option>
            ))}
          </select>
        </label>
        <p>{c.sourceHelp}</p>
        {onOpenMaterial &&
          materials.some((item) => !usableVoiceSource(item)) && (
            <details>
              <summary>{c.extractFirst}</summary>
              {materials
                .filter((item) => !usableVoiceSource(item))
                .map((item) => (
                  <button
                    key={item.id}
                    className="lm-button"
                    onClick={() => onOpenMaterial(item.id)}
                  >
                    {item.title}
                  </button>
                ))}
            </details>
          )}
        {selectedMaterial && onOpenMaterial && (
          <button
            className="lm-button"
            onClick={() => onOpenMaterial(selectedMaterial.id)}
          >
            {selectedMaterial.title}
          </button>
        )}
      </div>
      {restoreFailed && (
        <div role="alert">
          <p>{c.restoreFailed}</p>
          <button
            className="lm-button"
            onClick={() => setRestoreTick((v) => v + 1)}
          >
            {c.retryRestore}
          </button>
        </div>
      )}
      <div className="lv-layout">
        <div className="lv-console">
          <div className="lv-steps">
            <span data-active={recordingActive || phase === "permission"}>
              <b>01</b>
              {c.record}
            </span>
            <span data-active={phase === "transcribing"}>
              <b>02</b>
              {c.review}
            </span>
            <span
              data-active={phase === "thinking" || phase === "synthesizing"}
            >
              <b>03</b>
              {c.converse}
            </span>
          </div>
          <div className={`lv-orbit lv-orbit--${phase}`} aria-hidden="true">
            <div className="lv-orbit-ring" />
            <div className="lv-orbit-ring second" />
            <div className="lv-orbit-core">
              {processing || phase === "permission" ? (
                <LoaderCircle className="lm-spin" size={38} />
              ) : (
                <Mic size={38} />
              )}
            </div>
          </div>
          <div className="lv-status" aria-live="polite">
            <strong>{status}</strong>
            <p>{phase === "permission" ? c.permissionHint : c.hint}</p>
          </div>
          <div className="lv-meter">
            <canvas ref={canvas} width={288} height={80} aria-hidden="true" />
            <span>
              {String(Math.floor(seconds / 60)).padStart(2, "0")}:
              {String(seconds % 60).padStart(2, "0")}
            </span>
          </div>
          <div className="lv-record-actions">
            {recordingActive ? (
              <>
                <button
                  className="lm-button"
                  onClick={() => {
                    if (recorder.current?.state === "recording") {
                      recorder.current.pause();
                      setPhase("paused");
                    } else if (recorder.current?.state === "paused") {
                      recorder.current.resume();
                      setPhase("recording");
                    }
                  }}
                >
                  <Pause size={16} />
                  {phase === "paused" ? c.resume : c.pause}
                </button>
                <button
                  className="lm-button primary"
                  onClick={() => {
                    if (recorder.current?.state !== "inactive")
                      recorder.current?.stop();
                  }}
                >
                  <Square size={16} />
                  {c.stop}
                </button>
              </>
            ) : (
              <button
                className="lm-button primary lv-start"
                disabled={blocked || !supported}
                onClick={() => void startRecording()}
              >
                <Mic size={18} />
                {c.start}
              </button>
            )}
            {busy && (
              <button className="lm-button" onClick={cancel}>
                <X size={16} />
                {c.cancel}
              </button>
            )}
          </div>
          <label
            className={`lv-upload ${blocked ? "disabled" : ""}`}
            htmlFor={uploadId}
          >
            <Upload size={15} />
            {c.upload}
            <input
              id={uploadId}
              type="file"
              accept="audio/*"
              disabled={blocked}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setNotice("");
                if (
                  !file.type.startsWith("audio/") ||
                  !file.size ||
                  file.size > VOICE_LIMITS.audioBytes
                ) {
                  setError(c.invalidAudio);
                  return;
                }
                setRecording(file);
                setError("");
                setSeconds(0);
              }}
            />
          </label>
          <small className="lv-limit">{c.limit}</small>
          {!supported && <p className="lv-note">{c.unsupported}</p>}
          {recording && !recordingActive && (
            <div className="lv-recorded">
              <OutboundDataNotice
                locale={locale}
                action="transcription"
                mediaKind="audio"
              />
              <VoicePlayback
                blob={recording}
                locale={locale}
                label={c.recordingPreview}
                disabled={capturing}
              />
              <button
                className="lm-button"
                disabled={blocked || !canTranscribe}
                onClick={() => void transcribe()}
              >
                <AudioLines size={16} />
                {c.transcribe}
              </button>
            </div>
          )}
          <div className="lv-settings">
            <label>
              {c.language}
              <select
                value={language}
                disabled={blocked}
                onChange={(event) =>
                  setLanguage(event.target.value as VoiceLanguage)
                }
              >
                {Object.entries(languages).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {c.voice}
              <select
                value={voice}
                disabled={blocked}
                onChange={(event) => setVoice(event.target.value as VoiceId)}
              >
                {VOICE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {c[id]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="lv-toggle">
            <input
              type="checkbox"
              checked={autoRead}
              disabled={blocked}
              onChange={(event) => setAutoRead(event.target.checked)}
            />
            <span>{c.autoplay}</span>
            <Volume2 size={16} />
          </label>
          <div className="lv-privacy">
            <ShieldCheck size={17} />
            <p>{c.privacy}</p>
          </div>
          <OutboundDataNotice locale={locale} action="speech" />
        </div>
        <div className="lv-conversation">
          <TutorProgress
            locale={locale}
            state={tutorState}
            disabled={blocked}
            restoring={restoring}
            onNew={freshConversation}
            onUnlock={() => {
              if (!tutorState?.canUnlock) return;
              setTutorGuidance("full");
              setQuestion(
                locale === "vi"
                  ? "Mình đã thử các gợi ý. Hãy trình bày lời giải đầy đủ và kiểm tra kết quả."
                  : "I have tried the hints. Please show the complete solution and check the result.",
              );
            }}
          />
          <TutorHelpIntent
            locale={locale}
            value={tutorIntent}
            onChange={setTutorIntent}
            disabled={blocked || tutorGuidance === "full"}
          />
          {tutorState && (
            <button
              className="lm-button"
              disabled={blocked}
              onClick={() => void deleteConversation()}
            >
              {c.deleteSession}
            </button>
          )}
          <div className="lv-conversation-head">
            <span>
              <Sparkles size={15} />
              {selectedSource ? c.source : c.noSource}
            </span>
            {turns.length > 0 && (
              <button
                className="lm-icon"
                disabled={blocked}
                aria-label={c.newConversation}
                title={c.newConversation}
                onClick={freshConversation}
              >
                <RotateCcw size={17} />
              </button>
            )}
          </div>
          <div
            className="lv-messages"
            aria-live="polite"
            aria-relevant="additions"
          >
            {!turns.length && (
              <div className="lv-empty">
                <div>
                  <AudioLines size={32} />
                </div>
                <h2>{c.empty}</h2>
                <p>{c.emptyHint}</p>
              </div>
            )}
            {turns.map((turn) => (
              <article
                className={`lv-message lv-message--${turn.role}`}
                key={turn.id}
              >
                <div className="lv-message-byline">
                  <span>{turn.role === "user" ? c.you : c.assistant}</span>
                  {turn.role === "assistant" && (
                    <button
                      className="lm-icon"
                      disabled={blocked || !canSpeak}
                      aria-label={c.readAloud}
                      title={c.readAloud}
                      onClick={() => void read(turn)}
                    >
                      <Volume2 size={16} />
                    </button>
                  )}
                </div>
                <MathText text={turn.text} />
                {turn.role === "assistant" && (
                  <>
                    <SourceReferences
                      references={turn.references}
                      source={selectedSource}
                      evidence={selectedEvidence}
                      item={selectedMaterial}
                      locale={locale}
                      onOpenSource={
                        onOpenMaterial && selectedMaterial
                          ? () => onOpenMaterial(selectedMaterial.id)
                          : undefined
                      }
                    />
                    <MathVerificationNotice
                      verification={turn.verification}
                      locale={locale}
                    />
                    {turn.turn && tutorState && (
                      <TutorTurnFeedback
                        key={`${tutorState.sessionId}:${turn.turn.id}`}
                        locale={locale}
                        sessionId={tutorState.sessionId}
                        turn={turn.turn}
                      />
                    )}
                  </>
                )}
                {spoken?.id === turn.id && (
                  <>
                    <VoicePlayback
                      blob={spoken.blob}
                      locale={locale}
                      label={c.playback}
                      autoplay={spoken.autoplay}
                      disabled={capturing}
                    />
                    {spoken.truncated && (
                      <small className="lv-note">{c.speechLimit}</small>
                    )}
                  </>
                )}
              </article>
            ))}
            {phase === "thinking" && (
              <div className="lv-thinking">
                <span />
                <span />
                <span />
                <small>{c.thinking}</small>
              </div>
            )}
          </div>
          <div className="lv-compose">
            <label htmlFor={transcriptId}>{c.transcript}</label>
            <OutboundDataNotice
              locale={locale}
              action="chat"
              sourceCharacters={selectedSource.length}
              questionCharacters={question.trim().length}
              historyMessages={turns.length}
              tutorSession
            />
            <textarea
              id={transcriptId}
              rows={4}
              value={question}
              disabled={blocked}
              maxLength={VOICE_LIMITS.questionCharacters}
              placeholder={c.placeholder}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <div className="lv-compose-footer">
              <small>{question.length.toLocaleString()} / 4,000</small>
              <button
                className="lm-button primary"
                disabled={
                  blocked ||
                  !canAsk ||
                  !question.trim() ||
                  question.length > VOICE_LIMITS.questionCharacters
                }
                onClick={() => void send()}
              >
                {c.send}
                <ArrowUp size={16} />
              </button>
            </div>
            {question.length > VOICE_LIMITS.questionCharacters && (
              <p className="lv-note">{c.questionLimit}</p>
            )}
          </div>
          {!config?.capabilities?.tutor ||
          !config?.capabilities?.transcription ||
          !config?.capabilities?.speech ? (
            <p className="lv-note">{c.unavailable}</p>
          ) : null}
          {error && (
            <p className="lv-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="lv-notice" role="status">
              <Check size={15} />
              {notice}
            </p>
          )}
          {turns.length > 0 && (
            <div className="lv-export">
              <button
                className="lm-button"
                onClick={() =>
                  downloadText("lumio-voice", "md", voiceTranscript(turns, c))
                }
              >
                <Download size={15} />
                {c.downloadText}
              </button>
              {onSaveTranscript && (
                <button
                  className="lm-button"
                  disabled={saving}
                  onClick={() => void save()}
                >
                  {saving ? (
                    <LoaderCircle className="lm-spin" size={15} />
                  ) : (
                    <Check size={15} />
                  )}
                  {c.save}
                </button>
              )}
            </div>
          )}
          <p className="lv-local">{c.local}</p>
        </div>
      </div>
    </section>
  );
}
