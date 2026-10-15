"use client";
import { useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  RotateCcw,
  Check,
  Sparkles,
  Bell,
  Volume2,
  Upload,
  Trash2,
  Music2,
} from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import {
  defaultAlarm,
  type AlarmPreset,
  type LearningState,
} from "../../lib/lumio/learning-engine";
import { learningCopy } from "../../lib/lumio/learning-copy";
import { focusCopy } from "../../lib/lumio/focus-copy";
import type { FocusAlarm } from "./use-focus-alarm";
type FocusTimerProps = {
  locale: Locale;
  state: LearningState;
  update: (fn: (old: LearningState) => LearningState) => void;
  alarm: FocusAlarm;
};
export function FocusTimer(
  props: Omit<FocusTimerProps, "alarm"> & { alarm?: FocusAlarm },
) {
  // Fast Refresh can briefly retain a parent rendered before the alarm prop existed.
  // Keep the timer untouched until the real controller is available.
  if (!props.alarm) {
    const loading: Record<Locale, string> = {
      vi: "Đang khởi tạo phòng tập trung và âm báo…",
      en: "Preparing your focus room and bell…",
      "zh-CN": "正在准备专注空间和铃声…",
      ja: "集中ルームとベルを準備しています…",
      ko: "집중 공간과 알림을 준비하고 있어요…",
    };
    return (
      <section className="lx-focus-page" aria-busy="true">
        <Sparkles size={24} aria-hidden="true" />
        <h1>{learningCopy[props.locale].focusTitle}</h1>
        <p role="status">{loading[props.locale]}</p>
      </section>
    );
  }
  return <ReadyFocusTimer {...props} alarm={props.alarm} />;
}
function ReadyFocusTimer({ locale, state, update, alarm }: FocusTimerProps) {
  const c = learningCopy[locale],
    a = focusCopy[locale],
    [duration, setDuration] = useState(25),
    [now, setNow] = useState(Date.now()),
    focus = state.focus,
    sound = state.alarm || defaultAlarm;
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, []);
  const seconds = focus
    ? focus.deadline
      ? Math.max(0, Math.ceil((focus.deadline - now) / 1000))
      : focus.remaining
    : duration * 60;
  const ratio = focus
      ? Math.max(0, Math.min(1, 1 - seconds / focus.seconds))
      : 0,
    running = !!focus?.deadline;
  function start() {
    void alarm.unlock();
    setNow(Date.now());
    update((old) =>
      old.focus?.deadline
        ? old
        : {
            ...old,
            focus: old.focus
              ? {
                  ...old.focus,
                  deadline: Date.now() + old.focus.remaining * 1000,
                }
              : {
                  id: crypto.randomUUID(),
                  seconds: duration * 60,
                  remaining: duration * 60,
                  deadline: Date.now() + duration * 60000,
                },
          },
    );
  }
  function pause() {
    update((old) =>
      !old.focus?.deadline || old.focus.deadline <= Date.now()
        ? old
        : {
            ...old,
            focus: old.focus
              ? {
                  ...old.focus,
                  deadline: null,
                  remaining: Math.max(
                    0,
                    Math.ceil((old.focus.deadline! - Date.now()) / 1000),
                  ),
                }
              : null,
          },
    );
  }
  const last = state.events.filter((e) => e.kind === "focus").at(-1),
    recentComplete = !focus && last && now - Date.parse(last.at) < 60000;
  return (
    <div className={`lx-focus-page ${running ? "running" : ""}`}>
      <div className="lx-focus-landscape" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <span className="lx-focus-badge">
        <Sparkles size={14} />
        {running ? c.focusActive : focus ? c.focusPaused : c.focusReady}
      </span>
      <h1>{c.focusTitle}</h1>
      <p>{c.focusHint}</p>
      <div className="lx-timer-ring">
        {running && (
          <div className="lx-timer-particles" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        )}
        <svg viewBox="0 0 280 280" aria-hidden="true">
          <circle cx="140" cy="140" r="129" />
          <circle
            cx="140"
            cy="140"
            r="129"
            className="progress"
            style={{ strokeDashoffset: 810 * (1 - ratio) }}
          />
        </svg>
        <div>
          <strong aria-live="off">
            {String(Math.floor(seconds / 60)).padStart(2, "0")}
            <span>:</span>
            {String(seconds % 60).padStart(2, "0")}
          </strong>
          <small>{c.focus}</small>
        </div>
      </div>
      <div
        className="lx-duration-selector"
        role="group"
        aria-label={c.sessionLength}
      >
        {[15, 25, 45, 60].map((n) => (
          <button
            key={n}
            disabled={!!focus}
            aria-pressed={(focus ? focus.seconds / 60 : duration) === n}
            onClick={() => setDuration(n)}
          >
            {n} {c.minuteUnit}
          </button>
        ))}
      </div>
      <div className="lx-focus-controls">
        <button className="lx-hero-button" onClick={running ? pause : start}>
          {running ? <Pause size={19} /> : <Play size={19} />}{" "}
          {running ? c.pause : focus ? c.resume : c.start}
        </button>
        {focus && (
          <button
            className="lx-round-button"
            aria-label={c.reset}
            onClick={() => update((old) => ({ ...old, focus: null }))}
          >
            <RotateCcw size={20} />
          </button>
        )}
      </div>
      {recentComplete && (
        <div className="lx-session-complete" role="status">
          <Check size={19} />
          <span>
            <strong>{c.focusComplete}</strong>
            <small>{c.focusLogged}</small>
          </span>
        </div>
      )}
      <p className="lx-focus-note">{c.focusNote}</p>
      <section className="lx-alarm-panel" aria-labelledby="focus-alarm-title">
        <div className="lx-alarm-heading">
          <span>
            <Bell size={20} />
          </span>
          <div>
            <h2 id="focus-alarm-title">{a.alarmTitle}</h2>
            <p>{a.alarmHint}</p>
          </div>
        </div>
        <div
          className="lx-alarm-presets"
          role="group"
          aria-label={a.alarmTitle}
        >
          {(
            ["chime", "bell", "forest", "custom", "silent"] as AlarmPreset[]
          ).map((preset) => (
            <button
              key={preset}
              aria-pressed={sound.preset === preset}
              onClick={() => {
                alarm.stop();
                update((old) => ({
                  ...old,
                  alarm: { ...(old.alarm || defaultAlarm), preset },
                }));
              }}
            >
              <span aria-hidden="true">
                {preset === "custom" ? (
                  <Music2 size={17} />
                ) : preset === "silent" ? (
                  "—"
                ) : (
                  <Bell size={17} />
                )}
              </span>
              {a[preset]}
            </button>
          ))}
        </div>
        <div className="lx-alarm-volume">
          <Volume2 size={18} />
          <label htmlFor="focus-alarm-volume">{a.volume}</label>
          <input
            id="focus-alarm-volume"
            type="range"
            min="0"
            max="100"
            step="5"
            value={Math.round(sound.volume * 100)}
            onChange={(event) => {
              const volume = Number(event.target.value) / 100;
              alarm.stop();
              update((old) => ({
                ...old,
                alarm: { ...(old.alarm || defaultAlarm), volume },
              }));
            }}
          />
          <output htmlFor="focus-alarm-volume">
            {Math.round(sound.volume * 100)}%
          </output>
        </div>
        {sound.preset === "custom" && (
          <div className="lx-alarm-custom">
            <input
              ref={fileInput}
              className="lx-audio-file-input"
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.webm"
              aria-label={a.upload}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file && (await alarm.saveCustom(file)))
                  update((old) => ({
                    ...old,
                    alarm: {
                      ...(old.alarm || defaultAlarm),
                      preset: "custom",
                      customName: file.name.slice(0, 180),
                    },
                  }));
              }}
            />
            <button
              className="lx-text-button"
              disabled={alarm.status === "loading"}
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={17} />
              {a.upload}
            </button>
            {alarm.customName && (
              <span className="lx-alarm-filename">
                <Music2 size={15} />
                <span title={alarm.customName}>{alarm.customName}</span>
                <button
                  aria-label={a.remove}
                  onClick={async () => {
                    if (await alarm.removeCustom())
                      update((old) => ({
                        ...old,
                        alarm: {
                          ...(old.alarm || defaultAlarm),
                          preset: "chime",
                          customName: undefined,
                        },
                      }));
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </span>
            )}
            <p>{a.fileHint}</p>
          </div>
        )}
        <div className="lx-alarm-actions">
          <button
            className="lx-text-button"
            disabled={
              sound.preset === "silent" ||
              sound.volume === 0 ||
              alarm.status === "loading"
            }
            onClick={() =>
              alarm.status === "playing" ? alarm.stop() : void alarm.play(true)
            }
          >
            {alarm.status === "playing" ? (
              <Pause size={17} />
            ) : (
              <Play size={17} />
            )}{" "}
            {alarm.status === "playing" ? a.stop : a.preview}
          </button>
          <span className={`lx-alarm-status ${alarm.status}`} role="status">
            {alarm.status !== "ready"
              ? a[alarm.status]
              : sound.preset === "custom" && !alarm.customName
                ? a.missing
                : a.ready}
          </span>
        </div>
      </section>
    </div>
  );
}
