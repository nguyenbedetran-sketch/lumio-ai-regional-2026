"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "../../lib/lumio/i18n";
import type {
  TutorFeedback,
  TutorIntent,
  TutorTurnIdentity,
} from "../../lib/tutor/types";
import { accountHeaders } from "../../lib/ai/request-client";
import { useAccountScope } from "./account-scope";
import styles from "./tutor-support.module.css";

const copy = {
  vi: {
    title: "Bạn cần hỗ trợ thế nào?",
    choices: [
      "Bước tiếp theo",
      "Dễ hiểu hơn",
      "Ví dụ tương tự",
      "Cách tiếp cận khác",
    ],
    note: "Giải thích lại, ví dụ và cách khác không tăng số lượt mở khóa. Viết điều bạn chưa hiểu rồi bấm Gửi.",
    feedback: "Phản hồi riêng về lượt này",
    usefulness: "Mức hữu ích",
    correctness: "Bạn có nghi ngờ nội dung?",
    none: "Chưa chọn",
    helpful: "Hữu ích",
    notHelpful: "Chưa hữu ích",
    error: "Có thể có lỗi",
    unsure: "Chưa chắc",
    save: "Lưu phản hồi",
    remove: "Xóa phản hồi",
    saved:
      "Đã lưu riêng. Đây là ý kiến của bạn, không phải kết luận kiểm chứng và không tự động dùng huấn luyện.",
    deleted:
      "Đã xóa các lựa chọn. Dấu phiên bản và mã yêu cầu còn đến khi xóa/hết hạn phiên 7 ngày.",
    failure:
      "Chưa lưu được. Thử lại giữ cùng mã yêu cầu; tải lại phiên nếu có xung đột.",
    refresh: "Tải lại phản hồi",
    recorded: "Lượt hỗ trợ đã ghi nhận; không tăng khóa.",
    continuity: "Tiếp tục từ cuộc trao đổi đã lưu",
    question: "Câu hỏi gần nhất của Lumio",
    attempt: "Lời nhắn gần nhất của bạn",
    caution:
      "Đây là nội dung đã ghi, không xác nhận bạn đã hiểu hay câu trả lời đúng.",
  },
  en: {
    title: "What would help?",
    choices: [
      "Next step",
      "Simpler explanation",
      "Similar example",
      "Another approach",
    ],
    note: "Re-explanations, examples and alternatives do not advance the unlock count. Describe what is unclear, then press Send.",
    feedback: "Private feedback on this turn",
    usefulness: "Usefulness",
    correctness: "Any concern about this answer?",
    none: "Not selected",
    helpful: "Helpful",
    notHelpful: "Not helpful",
    error: "Possible error",
    unsure: "Not sure",
    save: "Save feedback",
    remove: "Delete feedback",
    saved:
      "Saved privately. This is your opinion, not a correctness verdict or automatic training input.",
    deleted:
      "Choices deleted. Revision/request metadata remains until session deletion or its seven-day expiry.",
    failure:
      "Could not save. Retry retains the request ID; reload feedback after a conflict.",
    refresh: "Reload feedback",
    recorded: "Recorded support turn; unlock count unchanged.",
    continuity: "Continue your saved conversation",
    question: "Last recorded Lumio question",
    attempt: "Your last recorded message",
    caution: "Recorded content does not certify understanding or correctness.",
  },
};
export function tutorSupportCopy(locale: Locale) {
  return copy[locale === "vi" ? "vi" : "en"];
}
export function TutorHelpIntent({
  locale,
  value,
  onChange,
  disabled = false,
}: {
  locale: Locale;
  value: TutorIntent;
  onChange: (v: TutorIntent) => void;
  disabled?: boolean;
}) {
  const c = tutorSupportCopy(locale);
  return (
    <fieldset className={styles.help} disabled={disabled}>
      <legend>{c.title}</legend>
      <div>
        {(["progress", "simpler", "example", "approach"] as const).map(
          (key, i) => (
            <button
              type="button"
              key={key}
              aria-pressed={value === key}
              onClick={() => onChange(key)}
            >
              {c.choices[i]}
            </button>
          ),
        )}
      </div>
      <small>{c.note}</small>
    </fieldset>
  );
}
export function TutorTurnFeedback({
  locale,
  sessionId,
  turn,
}: {
  locale: Locale;
  sessionId: string;
  turn: TutorTurnIdentity;
}) {
  const account = useAccountScope(),
    c = tutorSupportCopy(locale);
  const [current, setCurrent] = useState({
    revision: turn.feedbackRevision,
    feedback: turn.feedback,
  });
  const [usefulness, setUsefulness] = useState<TutorFeedback["usefulness"]>(
    turn.feedback?.usefulness || null,
  );
  const [correctness, setCorrectness] = useState<TutorFeedback["correctness"]>(
    turn.feedback?.correctness || null,
  );
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const pending = useRef<{ stamp: string; requestId: string } | null>(null),
    active = useRef(0);
  useEffect(
    () => () => {
      active.current++;
    },
    [],
  );
  async function mutate(action: "set" | "delete") {
    if (busy) return;
    const payload = {
      sessionId,
      turnId: turn.id,
      expectedRevision: current.revision,
      action,
      ...(action === "set" ? { usefulness, correctness } : {}),
    };
    const stamp = JSON.stringify(payload);
    if (pending.current && pending.current.stamp !== stamp) {
      setNotice(c.failure);
      return;
    }
    pending.current ||= { stamp, requestId: crypto.randomUUID() };
    const sequence = ++active.current;
    setBusy(true);
    setNotice("");
    try {
      const r = await fetch("/api/tutor/feedback", {
        method: "POST",
        headers: {
          ...accountHeaders(account),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          requestId: pending.current.requestId,
        }),
      });
      const b = await r.json();
      if (!r.ok) {
        if (r.status < 500) pending.current = null;
        throw new Error();
      }
      if (sequence !== active.current) return;
      setCurrent({ revision: b.revision, feedback: b.feedback });
      setUsefulness(b.feedback?.usefulness || null);
      setCorrectness(b.feedback?.correctness || null);
      pending.current = null;
      setNotice(action === "delete" ? c.deleted : c.saved);
    } catch {
      if (sequence === active.current) setNotice(c.failure);
    } finally {
      if (sequence === active.current) setBusy(false);
    }
  }
  async function reload() {
    if (busy) return;
    const sequence = ++active.current;
    setBusy(true);
    try {
      const r = await fetch(
        `/api/tutor/session?sessionId=${encodeURIComponent(sessionId)}`,
        { headers: accountHeaders(account), cache: "no-store" },
      );
      const b = await r.json();
      if (sequence !== active.current) return;
      if (!r.ok) throw new Error();
      const latest = b.turns.find((t: TutorTurnIdentity) => t.id === turn.id);
      if (!latest) throw new Error();
      setCurrent({
        revision: latest.feedbackRevision,
        feedback: latest.feedback,
      });
      setUsefulness(latest.feedback?.usefulness || null);
      setCorrectness(latest.feedback?.correctness || null);
      pending.current = null;
      setNotice("");
    } catch {
      if (sequence === active.current) setNotice(c.failure);
    } finally {
      if (sequence === active.current) setBusy(false);
    }
  }
  return (
    <details className={styles.feedback}>
      <summary>{c.feedback}</summary>
      <div className={styles.fields}>
        <label>
          {c.usefulness}
          <select
            disabled={busy}
            value={usefulness || ""}
            onChange={(e) =>
              setUsefulness(
                (e.target.value || null) as TutorFeedback["usefulness"],
              )
            }
          >
            <option value="">{c.none}</option>
            <option value="helpful">{c.helpful}</option>
            <option value="not_helpful">{c.notHelpful}</option>
          </select>
        </label>
        <label>
          {c.correctness}
          <select
            disabled={busy}
            value={correctness || ""}
            onChange={(e) =>
              setCorrectness(
                (e.target.value || null) as TutorFeedback["correctness"],
              )
            }
          >
            <option value="">{c.none}</option>
            <option value="possible_error">{c.error}</option>
            <option value="not_sure">{c.unsure}</option>
          </select>
        </label>
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          disabled={busy || (!usefulness && !correctness)}
          onClick={() => void mutate("set")}
        >
          {c.save}
        </button>
        <button
          type="button"
          disabled={busy || !current.feedback}
          onClick={() => void mutate("delete")}
        >
          {c.remove}
        </button>
        <button type="button" disabled={busy} onClick={() => void reload()}>
          {c.refresh}
        </button>
      </div>
      {notice && <p role="status">{notice}</p>}
    </details>
  );
}
