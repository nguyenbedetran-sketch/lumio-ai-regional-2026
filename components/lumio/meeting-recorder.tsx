"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  AudioLines,
  Download,
  LoaderCircle,
  Mic,
  Monitor,
  Pause,
  Play,
  ShieldCheck,
  Square,
  Trash2,
  X,
} from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import { desktopCopy } from "../../lib/lumio/desktop-copy";
import { meetingCopy } from "../../lib/voice/meeting-copy";
import {
  MeetingCapture,
  MEETING_LIMITS,
  browserMeetingEnvironment,
  initialMeetingSnapshot,
  meetingClock,
  type MeetingRecording,
} from "../../lib/voice/meeting-capture";

export type MeetingRecorderProps = {
  locale: Locale;
  disabled?: boolean;
  onActiveChange?: (active: boolean) => void;
  onUseRecording?: (recording: MeetingRecording) => void | Promise<void>;
  onSaveRecording?: (recording: MeetingRecording) => void | Promise<void>;
};
export function MeetingRecorder({
  locale,
  disabled = false,
  onActiveChange,
  onUseRecording,
  onSaveRecording,
}: MeetingRecorderProps) {
  const c = meetingCopy[locale];
  const [state, setState] = useState(initialMeetingSnapshot);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [systemAudio, setSystemAudio] = useState(false);
  const [includeMicrophone, setIncludeMicrophone] = useState(false);
  const [recording, setRecording] = useState<MeetingRecording | null>(null);
  const [url, setURL] = useState("");
  const [using, setUsing] = useState(false);
  const [transferError, setTransferError] = useState(false);
  const [saved, setSaved] = useState(false);
  const capture = useRef<MeetingCapture | null>(null);
  const activeChanged = useRef(onActiveChange);
  const phase = useRef(state.phase);
  activeChanged.current = onActiveChange;
  const alive = useRef(true);
  const player = useRef<HTMLAudioElement | null>(null);
  const microphoneId = useId(),
    headingId = useId();
  const active = state.phase !== "idle";
  useEffect(() => {
    alive.current = true;
    const supported = !!(
      window.isSecureContext &&
      typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
      typeof MediaRecorder !== "undefined" &&
      typeof MediaStream !== "undefined"
    );
    setSupported(supported);
    const desktop = (
      window as Window & {
        lumioDesktop?: { systemAudio?: boolean; platform?: string };
      }
    ).lumioDesktop;
    const systemAudio =
      desktop?.platform === "win32" && desktop.systemAudio === true;
    setSystemAudio(systemAudio);
    if (supported)
      capture.current = new MeetingCapture(
        browserMeetingEnvironment(systemAudio),
        (next) => {
          phase.current = next.phase;
          setState(next);
          activeChanged.current?.(next.phase !== "idle");
        },
        (result) => {
          setRecording(result);
          setSaved(false);
          setTransferError(false);
        },
      );
    return () => {
      alive.current = false;
      capture.current?.dispose();
      capture.current = null;
      activeChanged.current?.(false);
      player.current?.pause();
    };
  }, []);
  useEffect(() => {
    if (!recording) {
      setURL("");
      return;
    }
    const url = URL.createObjectURL(recording.blob);
    setURL(url);
    return () => URL.revokeObjectURL(url);
  }, [recording]);
  // If a sibling voice request/recording begins, release this capture rather than compete.
  useEffect(() => {
    if (disabled) {
      capture.current?.cancel();
      player.current?.pause();
    }
  }, [disabled]);
  useEffect(() => {
    const release = () => capture.current?.cancel();
    const stop = () => {
      if (phase.current === "selecting") capture.current?.cancel();
      else capture.current?.stop();
    };
    window.addEventListener("pagehide", release);
    window.addEventListener("lumio:stop-capture", stop);
    return () => {
      window.removeEventListener("pagehide", release);
      window.removeEventListener("lumio:stop-capture", stop);
    };
  }, []);
  async function useRecording() {
    if (!recording || !onUseRecording || using || disabled || active) return;
    setUsing(true);
    setTransferError(false);
    player.current?.pause();
    try {
      await onUseRecording(recording);
    } catch {
      if (alive.current) setTransferError(true);
    } finally {
      if (alive.current) setUsing(false);
    }
  }
  const status =
    state.phase === "recording"
      ? c.recording
      : state.phase === "paused"
        ? c.paused
        : state.phase === "selecting"
          ? c.selecting
          : c.finishing;
  return (
    <section
      className="lm-meeting"
      aria-labelledby={headingId}
      data-phase={state.phase}
    >
      <header className="lm-meeting-header">
        <div>
          <span className="lm-meeting-eyebrow">{c.eyebrow}</span>
          <h2 id={headingId}>{c.title}</h2>
          <p>{c.subtitle}</p>
        </div>
        <span className="lm-meeting-icon" aria-hidden="true">
          <AudioLines size={30} />
        </span>
      </header>
      <div className="lm-meeting-guide">
        <Monitor size={18} aria-hidden="true" />
        <div>
          <p>{systemAudio ? c.desktopGuide : c.guide}</p>
          <p>{c.scope}</p>
        </div>
      </div>
      <label className="lm-meeting-microphone" htmlFor={microphoneId}>
        <input
          id={microphoneId}
          data-meeting-microphone
          type="checkbox"
          checked={includeMicrophone}
          onChange={(event) => setIncludeMicrophone(event.target.checked)}
          disabled={active || disabled || using}
        />
        <Mic size={17} aria-hidden="true" />
        <span>
          {c.includeMic}
          <small>{c.micHint}</small>
        </span>
      </label>
      {supported === false && (
        <p className="lm-meeting-error" role="status">
          {c.unsupported}
        </p>
      )}
      {state.error && (
        <p className="lm-meeting-error" role="alert">
          {c[state.error]}
        </p>
      )}
      {state.notice && (
        <p className="lm-meeting-notice" role="status">
          {c[state.notice]}
        </p>
      )}
      {active && (
        <div className="lm-meeting-capture">
          <div className="lm-meeting-capture-title" role="status">
            <span
              className={
                state.phase === "recording"
                  ? "lm-meeting-dot active"
                  : "lm-meeting-dot"
              }
              aria-hidden="true"
            />
            <strong>{status}</strong>
          </div>
          {state.phase === "selecting" ? (
            <p>{c.permissionHint}</p>
          ) : (
            <>
              <div className="lm-meeting-counter">
                <strong>{meetingClock(state.seconds)}</strong>
                <span>
                  / 10:00 · {(state.bytes / (1024 * 1024)).toFixed(1)} / 8 MB
                </span>
              </div>
              <progress
                value={state.seconds}
                max={MEETING_LIMITS.seconds}
                aria-label={status}
              />
              <p className="lm-meeting-source">
                <span>
                  {c.source}: <strong>{c[state.source]}</strong>
                </span>
                <span>{state.microphone ? c.withMic : c.withoutMic}</span>
              </p>
            </>
          )}
        </div>
      )}
      <div className="lm-meeting-actions">
        {state.phase === "idle" && (
          <button
            data-meeting-action="start"
            type="button"
            className="lm-button primary"
            disabled={!supported || disabled || using}
            onClick={() => {
              player.current?.pause();
              void capture.current?.start(includeMicrophone);
            }}
          >
            <AudioLines size={17} />
            {c.start}
          </button>
        )}
        {state.phase === "recording" && (
          <button
            data-meeting-action="pause"
            type="button"
            className="lm-button"
            onClick={() => capture.current?.pause()}
          >
            <Pause size={16} />
            {c.pause}
          </button>
        )}
        {state.phase === "paused" && (
          <button
            data-meeting-action="resume"
            type="button"
            className="lm-button"
            onClick={() => capture.current?.resume()}
          >
            <Play size={16} />
            {c.resume}
          </button>
        )}
        {(state.phase === "recording" || state.phase === "paused") && (
          <button
            data-meeting-action="stop"
            type="button"
            className="lm-button primary"
            onClick={() => capture.current?.stop()}
          >
            <Square size={16} />
            {c.stop}
          </button>
        )}
        {active && (
          <button
            data-meeting-action="cancel"
            type="button"
            className="lm-button"
            onClick={() => capture.current?.cancel()}
          >
            <X size={16} />
            {c.cancel}
          </button>
        )}
      </div>
      <p className="lm-meeting-limit">{c.limit}</p>
      {recording && !active && (
        <div className="lm-meeting-preview">
          <strong>
            {c.preview} · {meetingClock(recording.seconds)}
          </strong>
          <audio
            ref={player}
            controls
            preload="metadata"
            src={url || undefined}
            aria-label={c.preview}
            onPlaying={() => {
              if (disabled || active) player.current?.pause();
            }}
          />
          <div className="lm-meeting-actions">
            {onSaveRecording && (
              <button
                data-meeting-action="save"
                type="button"
                className="lm-button"
                disabled={disabled || using || saved}
                onClick={async () => {
                  if (using || active || !recording) return;
                  player.current?.pause();
                  setUsing(true);
                  setTransferError(false);
                  try {
                    await onSaveRecording(recording);
                    if (alive.current) setSaved(true);
                  } catch {
                    if (alive.current) setTransferError(true);
                  } finally {
                    if (alive.current) setUsing(false);
                  }
                }}
              >
                {saved ? desktopCopy[locale].saved : desktopCopy[locale].save}
              </button>
            )}
            <a
              data-meeting-action="download"
              className="lm-button"
              href={url || undefined}
              download={recording.filename}
              aria-disabled={!url}
            >
              <Download size={16} />
              {c.download}
            </a>
            {onUseRecording && (
              <button
                data-meeting-action="use"
                type="button"
                className="lm-button primary"
                disabled={disabled || using}
                onClick={() => void useRecording()}
              >
                {using ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <AudioLines size={16} />
                )}
                {using ? c.using : c.use}
              </button>
            )}
            <button
              type="button"
              className="lm-button"
              disabled={using}
              onClick={() => {
                player.current?.pause();
                setRecording(null);
                setTransferError(false);
              }}
            >
              <Trash2 size={16} />
              {c.remove}
            </button>
          </div>
          {onUseRecording && <small>{c.useHint}</small>}
          {transferError && (
            <p role="alert" className="lm-meeting-error">
              {c.transferFailed}
            </p>
          )}
        </div>
      )}
      <p className="lm-meeting-privacy">
        <ShieldCheck size={17} aria-hidden="true" />
        {c.privacy}
      </p>
    </section>
  );
}
