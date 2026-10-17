"use client";
import { MathText } from "./math-text";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  LoaderCircle,
  PauseCircle,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import { summaryMarkdown } from "../../lib/ai/summary";
import {
  SUMMARY_JOB_LIMITS,
  type SummaryJobView,
  type SummaryJobDetail,
  type SummaryJobResult,
} from "../../lib/jobs/contracts";
export type SummaryJobManagerProps = {
  locale: Locale;
  title: string;
  source: string;
  clientItemId?: string;
  youtubeUrl?: string;
  onResult?: (result: SummaryJobResult, job: SummaryJobView) => void;
};
const labels = {
  vi: {
    title: "Tóm tắt chạy nền",
    lead: "Lưu từng phần trên máy chủ, tiếp tục khi mở lại. Bản miễn phí có thể ngủ hoặc mất hàng đợi khi máy chủ khởi động lại; đây không phải dịch vụ chạy nền liên tục.",
    text: "Văn bản hiện tại",
    video: "YouTube",
    duration:
      "Đoạn video cần phân tích từ đầu (phút, tối đa 120; do bạn khai báo)",
    consent:
      "Tôi đồng ý lưu nội dung tóm tắt trên máy chủ tối đa 7 ngày và gửi từng phần tới dịch vụ AI. Tối đa 3 lần thử/phần; chỉ phần thành công trừ credit, phần lỗi hoàn lại.",
    create: "Đưa vào hàng đợi",
    refresh: "Làm mới",
    cancel: "Hủy",
    resume: "Tiếp tục",
    remove: "Xóa",
    result: "Xem kết quả",
    download: "Tải Markdown",
    empty: "Chưa có tác vụ trong tài khoản này.",
    signIn: "Đăng nhập để lưu và tiếp tục tác vụ.",
    error: "Chưa thực hiện được. Kiểm tra kết nối, credit hoặc thử lại.",
    created:
      "Đã lưu tác vụ. Có thể đóng bảng này; khi máy chủ còn hoạt động, từng phần vẫn được xử lý.",
    bounds:
      "Giới hạn hàng đợi: 120.000 ký tự hoặc 2 giờ YouTube, tối đa 12 phần. Toàn bộ nội dung có thể cần nhiều credit; video khoảng 108 credit/10 phút, văn bản 8 credit/phần. Hết credit sẽ tạm dừng.",
    queued: "Đang chờ",
    running: "Đang xử lý",
    retry_wait: "Chờ thử lại",
    paused: "Tạm dừng",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
    failed: "Không hoàn thành",
    part: "phần",
    review:
      "Nội dung AI cần được đối chiếu với học liệu gốc. Hoàn thành các phần không phải là chứng minh độ chính xác của tóm tắt.",
    serverError: "Mã trạng thái",
    saving: "Đang lưu…",
    account: "Tài khoản đã thay đổi. Mở lại học liệu trong tài khoản hiện tại.",
    size: "Nội dung vượt giới hạn hoặc chưa có văn bản/URL được hỗ trợ.",
    viewTitle: "Kết quả tác vụ",
  },
  en: {
    title: "Background summary",
    lead: "Save each part on the server and resume later. Free hosting may sleep or lose the queue on restart; continuous background availability is not guaranteed.",
    text: "Current text",
    video: "YouTube",
    duration: "Requested range from the start (declared minutes, max120)",
    consent:
      "I agree to store this summary content on the server for up to7 days and send each part to the AI service. Up to3 attempts per part; only successful parts consume credits and failed parts are refunded.",
    create: "Queue summary",
    refresh: "Refresh",
    cancel: "Cancel",
    resume: "Resume",
    remove: "Delete",
    result: "View result",
    download: "Download Markdown",
    empty: "No jobs in this account yet.",
    signIn: "Sign in to save and resume jobs.",
    error:
      "Unable to complete this action. Check your connection and credits, then retry.",
    created:
      "Job saved. You can close this panel; processing continues while the server stays awake.",
    bounds:
      "Queue limit: 120,000 text characters or2 hours of YouTube, up to12 parts. A full job may require more credits: about108 credits/10 minutes of video or8 credits/text part. Insufficient credits pause the job.",
    queued: "Queued",
    running: "Processing",
    retry_wait: "Waiting to retry",
    paused: "Paused",
    completed: "Completed",
    cancelled: "Cancelled",
    failed: "Not completed",
    part: "parts",
    review:
      "AI summaries need review against the original source. Completed processing does not prove semantic accuracy.",
    serverError: "Status code",
    saving: "Saving…",
    account:
      "Your account changed. Reopen the material in your current account.",
    size: "The input exceeds queue limits or has no supported text/URL.",
    viewTitle: "Job result",
  },
};
export function SummaryJobManager({
  locale,
  title,
  source,
  clientItemId,
  youtubeUrl,
  onResult,
}: SummaryJobManagerProps) {
  const c = labels[locale === "vi" ? "vi" : "en"],
    [account, setAccount] = useState<string | null>(null),
    [jobs, setJobs] = useState<SummaryJobView[]>([]),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false),
    [kind, setKind] = useState<"text" | "youtube">("text"),
    [minutes, setMinutes] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState<SummaryJobDetail | null>(null);
  const accountRef = useRef<string | null>(null),
    active = useRef(true),
    requestKey = useRef<string | null>(null),
    inputStamp = useRef("");
  async function request(method = "GET", body?: unknown, jobId?: string) {
    const key = accountRef.current;
    if (!key) throw Error("SIGN_IN_REQUIRED");
    const response = await fetch(
      `/api/summary-jobs${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ""}`,
      {
        method,
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "x-lumio-account": key,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    if (key !== accountRef.current || !active.current)
      throw Error("SESSION_REVOKED");
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "JOB_ERROR");
    return data;
  }
  async function refresh() {
    const data = await request();
    if (active.current) setJobs(data.jobs || []);
  }
  useEffect(() => {
    active.current = true;
    let disposed = false;
    void fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((identity) => {
        if (disposed) return;
        const key =
          typeof identity?.accountKey === "string" ? identity.accountKey : null;
        accountRef.current = key;
        setAccount(key);
        if (key) void refresh().catch(() => {});
      })
      .catch(() => {});
    const timer = setInterval(() => {
      if (accountRef.current)
        void refresh().catch((e) => {
          if (
            !disposed &&
            e instanceof Error &&
            e.message === "SESSION_REVOKED"
          ) {
            accountRef.current = null;
            setAccount(null);
            setJobs([]);
            setSelected(null);
            setError(c.account);
          }
        });
    }, 5000);
    return () => {
      disposed = true;
      active.current = false;
      accountRef.current = null;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    requestKey.current = null;
    inputStamp.current = "";
    setSelected(null);
    setConsent(false);
  }, [source, youtubeUrl, clientItemId, locale]);
  function describe(e: unknown) {
    return e instanceof Error && e.message === "SESSION_REVOKED"
      ? c.account
      : `${c.error}${e instanceof Error && /^[A-Z_]+$/.test(e.message) ? ` (${e.message})` : ""}`;
  }
  async function create() {
    if (!account || !consent || busy) return;
    const duration = Number(minutes) * 60;
    if (
      kind === "text"
        ? !source.trim() || source.length > SUMMARY_JOB_LIMITS.sourceCharacters
        : !youtubeUrl ||
          !Number.isInteger(duration) ||
          duration <= 0 ||
          duration > SUMMARY_JOB_LIMITS.videoSeconds
    ) {
      setError(c.size);
      return;
    }
    const input = {
      title,
      clientItemId,
      language: locale,
      ...(kind === "text"
        ? { source }
        : { youtubeUrl, durationSeconds: duration }),
    };
    const stamp = JSON.stringify(input);
    if (inputStamp.current !== stamp) {
      inputStamp.current = stamp;
      requestKey.current = crypto.randomUUID();
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await request("POST", {
        input,
        requestKey: requestKey.current,
        consent: true,
      });
      requestKey.current = null;
      inputStamp.current = "";
      setJobs((previous) => [
        data.job,
        ...previous.filter((job) => job.id !== data.job.id),
      ]);
      setNotice(c.created);
      void refresh().catch(() => {});
    } catch (e) {
      setError(describe(e));
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function control(
    job: SummaryJobView,
    action: "cancel" | "resume" | "delete",
  ) {
    setBusy(true);
    setError("");
    try {
      await request("PATCH", { jobId: job.id, action });
      if (selected?.id === job.id && action === "delete") setSelected(null);
      await refresh();
    } catch (e) {
      setError(describe(e));
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function open(job: SummaryJobView) {
    setBusy(true);
    setError("");
    try {
      const detail = (await request(
        "GET",
        undefined,
        job.id,
      )) as SummaryJobDetail;
      setSelected(detail);
      if (detail.result) onResult?.(detail.result, detail);
    } catch (e) {
      setError(describe(e));
    } finally {
      if (active.current) setBusy(false);
    }
  }
  function download() {
    if (!selected?.result) return;
    const url = URL.createObjectURL(
        new Blob([summaryMarkdown(selected.result.summary)], {
          type: "text/markdown;charset=utf-8",
        }),
      ),
      link = document.createElement("a");
    link.href = url;
    link.download = "lumio-background-summary.md";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="lm-panel" data-summary-jobs aria-label={c.title}>
      <div className="lm-row">
        <h3>{c.title}</h3>
        <button
          className="lm-button"
          disabled={!account || busy}
          onClick={() => void refresh().catch((e) => setError(describe(e)))}
        >
          <RotateCcw size={16} />
          {c.refresh}
        </button>
      </div>
      <p>{c.lead}</p>
      <p>{c.bounds}</p>
      {!account ? (
        <p role="status">{c.signIn}</p>
      ) : (
        <>
          <div className="lm-row">
            <label>
              <input
                type="radio"
                name={`job-source-${clientItemId || "current"}`}
                checked={kind === "text"}
                onChange={() => setKind("text")}
              />{" "}
              {c.text}
            </label>
            {youtubeUrl && (
              <label>
                <input
                  type="radio"
                  name={`job-source-${clientItemId || "current"}`}
                  checked={kind === "youtube"}
                  onChange={() => setKind("youtube")}
                />{" "}
                {c.video}
              </label>
            )}
          </div>
          {kind === "youtube" && (
            <label>
              {c.duration}
              <input
                className="lm-input"
                type="number"
                min="1"
                max="120"
                step="1"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </label>
          )}
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{" "}
            {c.consent}
          </label>
          <div className="lm-row">
            <button
              className="lm-button primary"
              disabled={busy || !consent}
              onClick={() => void create()}
            >
              {busy ? <LoaderCircle size={16} /> : <Play size={16} />}
              {busy ? c.saving : c.create}
            </button>
          </div>
          {!jobs.length && <p>{c.empty}</p>}
          <div className="lm-stack">
            {jobs.map((job) => (
              <article
                className="lm-card"
                key={job.id}
                data-summary-job={job.status}
              >
                <strong>
                  <MathText text={job.title} inline />
                </strong>
                <p>
                  {c[job.status]} · {job.completed}/{job.total} {c.part}
                </p>
                <progress
                  max={job.total}
                  value={job.completed}
                  aria-label={`${job.completed}/${job.total}`}
                />
                {job.error && (
                  <p>
                    {c.serverError}: <code>{job.error}</code>
                  </p>
                )}
                <div className="lm-row">
                  {["queued", "running", "retry_wait", "paused"].includes(
                    job.status,
                  ) && (
                    <button
                      className="lm-button"
                      disabled={busy}
                      onClick={() => void control(job, "cancel")}
                    >
                      <PauseCircle size={15} />
                      {c.cancel}
                    </button>
                  )}
                  {["paused", "retry_wait"].includes(job.status) && (
                    <button
                      className="lm-button"
                      disabled={busy}
                      onClick={() => void control(job, "resume")}
                    >
                      <Play size={15} />
                      {c.resume}
                    </button>
                  )}
                  {job.status === "completed" && (
                    <button
                      className="lm-button"
                      disabled={busy}
                      onClick={() => void open(job)}
                    >
                      {c.result}
                    </button>
                  )}
                  {["completed", "cancelled", "failed"].includes(
                    job.status,
                  ) && (
                    <button
                      className="lm-button"
                      disabled={busy}
                      onClick={() => void control(job, "delete")}
                    >
                      <X size={15} />
                      {c.remove}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {selected?.result && (
        <section aria-label={c.viewTitle}>
          <h4>
            <MathText text={selected.result.summary.title} inline />
          </h4>
          <p>{c.review}</p>
          <button className="lm-button" onClick={download}>
            <ArrowDownToLine size={15} />
            {c.download} (.md)
          </button>
          <MathText text={selected.result.summary.overview} />
          <ol>
            {selected.result.summary.chapters.map((chapter, i) => (
              <li key={i}>
                <strong>
                  <MathText text={chapter.title} inline />
                </strong>
                <MathText text={chapter.summary} />
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}
