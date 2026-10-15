"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { LoaderCircle, Square, Volume2 } from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import { aiErrorMessage } from "../../lib/lumio/ai-copy";
import { CREDIT_RATES } from "../../lib/server/billing-types";
import { synthesizeVoice } from "../../lib/voice/client";
import { voiceCopy } from "../../lib/voice/copy";
import { OutboundDataNotice } from "./outbound-data-notice";
import {
  ReadoutPlayback,
  initialReadoutState,
  readoutLanguage,
  splitReadoutText,
} from "../../lib/voice/readout";

const copy = {
  vi: {
    stop: "Dừng đọc",
    parts: "phần",
    current: "Phần",
    credit: "credit mỗi phần · Chỉ tạo phần tiếp theo sau khi nghe xong",
    loading: "Đang chuẩn bị giọng đọc…",
    playing: "Đang đọc",
    paused: "Đã tạm dừng",
    ready: "Bản đọc đã sẵn sàng",
    finished: "Đã đọc xong",
    blocked: "Bản đọc đã sẵn sàng. Nhấn nút phát bên dưới để nghe.",
    empty: "Thêm nội dung trước khi đọc.",
    tooLong:
      "Nội dung vượt 200.000 ký tự hoặc 100 phần. Chia thành các bài đọc nhỏ hơn; chưa gửi phần nào.",
    playback:
      "Chưa phát được âm thanh. Thử lại hoặc kiểm tra thiết bị âm thanh.",
    label: "Bản đọc âm thanh",
  },
  en: {
    stop: "Stop reading",
    parts: "parts",
    current: "Part",
    credit: "credits per part · The next part is created after playback ends",
    loading: "Preparing audio…",
    playing: "Reading",
    paused: "Paused",
    ready: "Audio is ready",
    finished: "Reading complete",
    blocked: "Audio is ready. Press play below to listen.",
    empty: "Add text before reading.",
    tooLong:
      "Text exceeds 200,000 characters or 100 parts. Split it into smaller readings; nothing was sent.",
    playback: "Audio could not play. Retry or check your audio device.",
    label: "Read-aloud audio",
  },
  "zh-CN": {
    stop: "停止朗读",
    parts: "段",
    current: "段",
    credit: "积分/段 · 播放完才生成下一段",
    loading: "正在准备音频…",
    playing: "正在朗读",
    paused: "已暂停",
    ready: "音频已就绪",
    finished: "朗读完成",
    blocked: "音频已就绪。请点击下方播放按钮。",
    empty: "请先添加文本。",
    tooLong: "文本超过200,000字符或100段。请分成较小的文本；尚未发送内容。",
    playback: "无法播放音频。请重试或检查音频设备。",
    label: "朗读音频",
  },
  ja: {
    stop: "読み上げを停止",
    parts: "パート",
    current: "パート",
    credit: "クレジット/パート · 再生終了後に次のパートを生成",
    loading: "音声を準備中…",
    playing: "読み上げ中",
    paused: "一時停止中",
    ready: "音声の準備ができました",
    finished: "読み上げ完了",
    blocked: "音声の準備ができました。下の再生ボタンを押してください。",
    empty: "テキストを追加してください。",
    tooLong:
      "200,000文字または100パートを超えています。短い文章に分けてください。まだ送信していません。",
    playback:
      "音声を再生できません。再試行するか音声デバイスを確認してください。",
    label: "読み上げ音声",
  },
  ko: {
    stop: "읽기 중지",
    parts: "부분",
    current: "부분",
    credit: "크레딧/부분 · 재생이 끝나면 다음 부분 생성",
    loading: "음성을 준비하는 중…",
    playing: "읽는 중",
    paused: "일시 정지",
    ready: "음성이 준비됐습니다",
    finished: "읽기 완료",
    blocked: "음성이 준비됐습니다. 아래 재생 버튼을 눌러 주세요.",
    empty: "먼저 텍스트를 추가하세요.",
    tooLong:
      "200,000자 또는 100부분을 초과합니다. 작은 글로 나누세요. 아직 전송되지 않았습니다.",
    playback:
      "음성을 재생할 수 없습니다. 다시 시도하거나 오디오 장치를 확인하세요.",
    label: "읽기 음성",
  },
} satisfies Record<Locale, Record<string, string>>;

export function AudioReadout({
  locale,
  language,
  text,
  disabled = false,
  onActiveChange,
}: {
  locale: Locale;
  language: string;
  text: string;
  disabled?: boolean;
  onActiveChange?: (active: boolean) => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const player = useRef<ReadoutPlayback | null>(null);
  const activeChange = useRef(onActiveChange);
  const activeValue = useRef(false);
  activeChange.current = onActiveChange;
  const [state, setState] = useState(initialReadoutState);
  const statusId = useId();
  const c = copy[locale];
  const prepared = useMemo(() => {
    try {
      return { total: splitReadoutText(text).length, error: null };
    } catch (error) {
      return {
        total: 0,
        error: error instanceof Error ? error.message : "READOUT_EMPTY",
      };
    }
  }, [text]);
  useEffect(() => {
    if (!audio.current) return;
    const current = new ReadoutPlayback({
      audio: audio.current,
      generate: (part, selectedLanguage, signal) =>
        synthesizeVoice(part, selectedLanguage, "clear", signal),
      onState: (next) => {
        setState(next);
        const nextActive = ["loading", "ready", "playing", "paused"].includes(
          next.phase,
        );
        if (activeValue.current !== nextActive) {
          activeValue.current = nextActive;
          activeChange.current?.(nextActive);
        }
      },
    });
    player.current = current;
    setState({ ...initialReadoutState });
    return () => {
      current.dispose();
      if (player.current === current) player.current = null;
      if (activeValue.current) {
        activeValue.current = false;
        activeChange.current?.(false);
      }
    };
  }, [text, language, disabled]);
  const active = ["loading", "ready", "playing", "paused"].includes(
    state.phase,
  );
  const code =
    state.error ||
    (prepared.error === "READOUT_TOO_LONG" ? prepared.error : null);
  const error =
    code === "READOUT_TOO_LONG"
      ? c.tooLong
      : code === "READOUT_EMPTY"
        ? c.empty
        : code === "READOUT_PLAYBACK_FAILED"
          ? c.playback
          : code
            ? aiErrorMessage(code, locale)
            : "";
  const status = state.blocked
    ? c.blocked
    : state.phase === "idle" || state.phase === "error"
      ? ""
      : c[state.phase];
  return (
    <div
      data-audio-readout
      data-phase={state.phase}
      className="lm-readout"
      style={{ display: "grid", gap: 10 }}
    >
      <OutboundDataNotice locale={locale} action="speech"/>
      <div className="lm-row">
        <button
          type="button"
          className="lm-button"
          data-readout-action="start"
          aria-describedby={statusId}
          disabled={disabled || !prepared.total || active}
          onClick={() =>
            void player.current?.start(text, readoutLanguage(language, locale))
          }
        >
          {state.phase === "loading" ? (
            <LoaderCircle size={16} className="lm-spin" />
          ) : (
            <Volume2 size={16} />
          )}
          {voiceCopy[locale].readAloud}
        </button>
        {(active || state.hasAudio) && (
          <button
            type="button"
            className="lm-button"
            data-readout-action="stop"
            onClick={() => player.current?.stop()}
          >
            <Square size={15} />
            {c.stop}
          </button>
        )}
      </div>
      {prepared.total > 0 && (
        <small className="lm-help">
          {prepared.total} {c.parts} · {CREDIT_RATES.tasks.speech} {c.credit}
        </small>
      )}
      <div
        id={statusId}
        data-readout-status
        role="status"
        aria-live="polite"
        className="lm-help"
      >
        {status}
        {status && state.total
          ? ` · ${c.current} ${state.part + 1}/${state.total}`
          : ""}
      </div>
      {error && (
        <p data-readout-error role="alert" className="lv-error">
          {error}
        </p>
      )}
      <audio
        ref={audio}
        data-readout-player
        controls
        preload="none"
        hidden={!state.hasAudio}
        aria-label={c.label}
        style={{ width: "100%", maxWidth: 580 }}
      />
    </div>
  );
}
