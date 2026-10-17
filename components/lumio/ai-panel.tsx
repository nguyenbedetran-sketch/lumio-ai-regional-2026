"use client";
import { accountHeaders, paidFetch } from "../../lib/ai/request-client";
import { useAccountScope } from "./account-scope";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Mic,
  Save,
  LoaderCircle,
  BookOpen,
  ArrowUpRight,
  Zap,
  Brain,
  Telescope,
  GraduationCap,
} from "lucide-react";
import { LearningItem, ProviderStatus, uid } from "../../lib/lumio/types";
import { Locale, Messages, languages } from "../../lib/lumio/i18n";
import { aiCopy, aiErrorMessage } from "../../lib/lumio/ai-copy";
import { quizReviewCopy } from "../../lib/lumio/quiz-review-copy";
import type {
  AIResult,
  AITask,
  AIInput,
  TutorMode,
} from "../../lib/ai/contracts";
import { linkCopy } from "../../lib/ingestion/copy";
import { youtubeURL } from "../../lib/ingestion/youtube";
import { productCopy } from "../../lib/lumio/product-copy";
import { BrandSymbol } from "./brand";
import { MathText } from "./math-text";
import { RichSummary, summaryCopy } from "./rich-summary";
import type { StudyArtifact } from "../../lib/ai/summary";
import { formatTime } from "../../lib/ai/summary";
import { parseClock, rangeCopy } from "../../lib/ingestion/video-range";
import { mathCopy } from "../../lib/ai/math-copy";
import { MATH_STYLES, type MathStyle } from "../../lib/ai/math-style";
import {
  runWholeVideoSummary,
  wholeVideoParts,
  type SummaryProgress,
} from "../../lib/ai/full-summary";
import { fullSummaryCopy } from "../../lib/ai/full-summary-copy";
import {
  summaryMarkdown,
  type StudySummary,
  type SummaryCoverage,
} from "../../lib/ai/summary";
import { VideoDurationProbe } from "./video-duration-probe";
import { AudioReadout } from "./audio-readout";
import { OutboundDataNotice } from "./outbound-data-notice";
import { SourceReferences, ContentQualityNotice } from "./source-references";
import {
  TutorProgress,
  MathVerificationNotice,
  tutorUICopy,
} from "./tutor-progress";
import type {
  TutorState,
  MathVerification,
  TutorIntent,
  TutorTurnIdentity,
  TutorStoredTurn,
  TutorSessionView,
} from "../../lib/tutor/types";
import {
  TutorHelpIntent,
  TutorTurnFeedback,
  tutorSupportCopy,
} from "./tutor-support";
import type { SourceReference } from "../../lib/ai/grounding";
import { RAGScopeSelector, ragError } from "./rag-manager";
import { SummaryJobManager } from "./summary-job-manager";
import { parseRagScope, type RagScope } from "../../lib/rag/types";
function blobData(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("INVALID_MEDIA"));
    reader.readAsDataURL(blob);
  });
}
export function AIPanel({
  item,
  t,
  locale,
  initialTask,
  initialPrompt,
  update,
  onOpenSource,
  onActivity,
  contextual = false,
  drafts,
  onDraft,
}: {
  item: LearningItem;
  t: Messages;
  locale: Locale;
  initialTask: AITask;
  initialPrompt?: string;
  update: (item: LearningItem) => void;
  onOpenSource?: (reference?: SourceReference) => void;
  onActivity?: (kind: "chat" | "summary") => void;
  contextual?: boolean;
  drafts?: { question: string; goal: string };
  onDraft?: (value: { question: string; goal: string }) => void;
}) {
  const a = aiCopy[locale];
  const account = useAccountScope();
  const copy = productCopy[locale];
  const learning = linkCopy[locale];
  const full = fullSummaryCopy[locale];
  const video = youtubeURL(item.url || "");
  const savedSummary = item.artifacts
    ?.filter((a) => a.kind === "summary")
    .at(-1);
  const [config, setConfig] = useState<ProviderStatus | null>(null),
    [task, setTask] = useState<AITask>(initialTask),
    [language, setLanguage] = useState<Locale>(locale),
    [question, setQuestion] = useState(drafts?.question ?? initialPrompt ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<AIResult | null>(null),
    [history, setHistory] = useState<
      {
        role: "user" | "assistant";
        text: string;
        references?: SourceReference[];
        verification?: MathVerification;
        turn?: TutorTurnIdentity;
      }[]
    >([]),
    [notice, setNotice] = useState("");
  const [tutorState, setTutorState] = useState<TutorState | null>(null);
  const [tutorIntent, setTutorIntent] = useState<TutorIntent>("progress");
  const [continuity, setContinuity] = useState<{
    lastQuestion: string | null;
    lastStudentAttempt: string | null;
  } | null>(null);
  const [restoringSession, setRestoringSession] = useState(true);
  const tutorSlot = useRef<string | null>(null);
  const tutorSourceStamp = useRef("");
  const tutorCopy = tutorUICopy[locale];
  const [ragScope, setRagScope] = useState<RagScope | undefined>();
  const [ragWarning, setRagWarning] = useState(false);
  const activeRag = task === "chat" && ragScope;
  const ragSelectionKey = JSON.stringify(
    ragScope
      ? [ragScope.workspaceId, [...ragScope.documentIds].sort(), ragScope.mode]
      : null,
  );
  const extractedText = !!item.sourceEvidence && !!item.text.trim();
  const needsDocumentExtraction =
    !activeRag &&
    !!item.blob &&
    /\.(docx|pptx)$/i.test(item.fileName || "") &&
    !extractedText;
  const sendRawMedia =
    !activeRag && !!item.blob && !extractedText && !needsDocumentExtraction;
  const [mode, setMode] = useState<TutorMode>("tutor"),
    [difficulty, setDifficulty] =
      useState<AIInput["difficulty"]>("intermediate"),
    [guidance, setGuidance] = useState<AIInput["guidance"]>("hints"),
    [presentation, setPresentation] = useState<AIInput["presentation"]>("auto"),
    [mathStyle, setMathStyle] = useState<MathStyle>("notebook"),
    [goal, setGoal] = useState(drafts?.goal || ""),
    [useVideo, setUseVideo] = useState(!!video && !item.text);
  const [rangeStart, setRangeStart] = useState("00:00"),
    [rangeEnd, setRangeEnd] = useState("10:00");
  useEffect(() => {
    onDraft?.({ question, goal });
  }, [question, goal, onDraft]);
  const abort = useRef<AbortController | null>(null),
    itemRef = useRef(item),
    locked = useRef(false);
  const [readoutActive, setReadoutActive] = useState(false);
  const reading = useRef(false);
  itemRef.current = item;
  function applyTutorSession(session: TutorSessionView) {
    setTutorState(session);
    setContinuity(session.continuity || null);
    setHistory(
      session.turns.slice(-100).flatMap((turn: TutorStoredTurn) => [
        { role: "user" as const, text: turn.student },
        {
          role: "assistant" as const,
          text: turn.assistant,
          references: turn.references,
          verification: turn.verification,
          turn,
        },
      ]),
    );
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    tutorSlot.current = null;
    setTutorState(null);
    setTutorIntent("progress");
    setContinuity(null);
    setHistory([]);
    setGuidance("hints");
    setResult(null);
    setRagWarning(false);
    setRestoringSession(true);
    void (async () => {
      try {
        const response = await fetch("/api/auth/session", {
          signal: controller.signal,
          cache: "no-store",
        });
        const identity = response.ok ? await response.json() : null;
        if (!active || typeof identity?.userId !== "string") return;
        const slot = `lumio-tutor-v2:${identity.userId}:${item.id}:${language}`;
        let saved: {
          sessionId?: string;
          stamp?: string;
          ragScope?: RagScope;
        } | null = null;
        try {
          saved = JSON.parse(localStorage.getItem(slot) || "null");
        } catch {}
        let restoredScope = ragScope;
        try {
          if (!restoredScope && saved?.ragScope)
            restoredScope = parseRagScope(saved.ragScope);
        } catch {
          saved = null;
        }
        const mediaHash = item.blob
          ? Array.from(
              new Uint8Array(
                await crypto.subtle.digest(
                  "SHA-256",
                  await item.blob.arrayBuffer(),
                ),
              ),
            )
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("")
          : "";
        const selection = restoredScope
          ? [
              restoredScope.workspaceId,
              [...restoredScope.documentIds].sort(),
              restoredScope.mode,
            ]
          : null;
        const context = new TextEncoder().encode(
          JSON.stringify([
            item.text,
            item.url,
            item.fileName,
            mediaHash,
            useVideo,
            rangeStart,
            rangeEnd,
            selection,
          ]),
        );
        const stamp = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", context)),
        )
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        if (!active) return;
        tutorSlot.current = slot;
        tutorSourceStamp.current = stamp;
        if (!saved?.sessionId || saved.stamp !== stamp) {
          if (saved?.sessionId)
            try {
              localStorage.removeItem(slot);
            } catch {}
          return;
        }
        if (!ragScope && restoredScope) {
          setRagScope(restoredScope);
          return;
        }
        if (saved.ragScope?.snapshotId) {
          const check = await fetch(
            `/api/rag/documents?snapshotId=${encodeURIComponent(saved.ragScope.snapshotId)}`,
            {
              signal: controller.signal,
              cache: "no-store",
              headers: accountHeaders(account),
            },
          );
          if (!active) return;
          if (!check.ok) {
            try {
              localStorage.removeItem(slot);
            } catch {}
            setRagScope((old) =>
              old ? { ...old, snapshotId: undefined } : undefined,
            );
            setNotice(ragError("RAG_SOURCE_CHANGED", locale === "vi"));
            return;
          }
          const data = await check.json();
          if (!active) return;
          setRagScope(saved.ragScope);
          setRagWarning(data.snapshot?.potentialConflict === true);
        }
        const restored = await fetch(
          `/api/tutor/session?sessionId=${encodeURIComponent(saved.sessionId)}`,
          {
            signal: controller.signal,
            cache: "no-store",
            headers: accountHeaders(account),
          },
        );
        if (!active) return;
        if (!restored.ok) {
          try {
            localStorage.removeItem(slot);
          } catch {}
          setNotice(tutorCopy.expired);
          return;
        }
        const session = await restored.json();
        if (!active || !Array.isArray(session.turns)) return;
        applyTutorSession(session as TutorSessionView);
      } catch {
      } finally {
        if (active) setRestoringSession(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
      abort.current?.abort();
    };
  }, [
    item.id,
    item.text,
    item.url,
    item.blob,
    item.fileName,
    language,
    useVideo,
    rangeStart,
    rangeEnd,
    ragSelectionKey,
  ]);
  function rememberTutor(state: TutorState, retrieval?: AIResult["rag"]) {
    setTutorState(state);
    const nextScope = ragScope
      ? {
          ...ragScope,
          snapshotId: retrieval?.snapshotId || ragScope.snapshotId,
        }
      : undefined;
    if (nextScope) setRagScope(nextScope);
    if (retrieval) setRagWarning(retrieval.potentialConflict);
    if (tutorSlot.current)
      try {
        localStorage.setItem(
          tutorSlot.current,
          JSON.stringify({
            sessionId: state.sessionId,
            stamp: tutorSourceStamp.current,
            ragScope: nextScope,
          }),
        );
      } catch {}
  }
  function newTutorProblem() {
    if (tutorSlot.current)
      try {
        localStorage.removeItem(tutorSlot.current);
      } catch {}
    setRagScope((old) => (old ? { ...old, snapshotId: undefined } : undefined));
    setRagWarning(false);
    setTutorState(null);
    setTutorIntent("progress");
    setContinuity(null);
    setHistory([]);
    setResult(null);
    setQuestion("");
    setGuidance("hints");
    setError("");
    setNotice("");
  }
  const [scope, setScope] = useState<"whole" | "range">("whole"),
    [detectedDuration, setDetectedDuration] = useState<number | null>(null),
    [declaredDuration, setDeclaredDuration] = useState(""),
    [finishedVideo, setFinishedVideo] = useState(false),
    [progress, setProgress] = useState<SummaryProgress | null>(null),
    [incomplete, setIncomplete] = useState(false);
  const wholeJob = useRef<{
    key: string;
    blob?: Blob;
    summaries: StudySummary[];
    result?: AIResult;
  } | null>(null);
  const hasVideo =
      !activeRag &&
      (!!(useVideo && video) || (item.kind === "video" && !!item.blob)),
    startSeconds = parseClock(rangeStart),
    endSeconds = parseClock(rangeEnd);
  const rangeValid =
    startSeconds !== null &&
    endSeconds !== null &&
    endSeconds > startSeconds &&
    endSeconds - startSeconds <= 1800;
  const selectedRange =
    hasVideo && rangeValid
      ? { startSeconds: startSeconds!, endSeconds: endSeconds! }
      : undefined;
  const duration = declaredDuration.trim()
    ? parseClock(declaredDuration)
    : detectedDuration;
  const durationValid =
    typeof duration === "number" && duration > 0 && duration <= 43200;
  const wholeVideo = task === "summary" && scope === "whole" && hasVideo;
  const needsRange = hasVideo && !wholeVideo;
  useEffect(() => {
    if (!hasVideo) setScope("whole");
  }, [hasVideo]);
  const jobKey = JSON.stringify([
    item.id,
    item.text,
    item.url,
    task,
    language,
    useVideo,
    duration,
    question,
    difficulty,
    guidance,
    presentation,
    mathStyle,
    goal,
  ]);
  const canResume =
    incomplete &&
    wholeJob.current?.key === jobKey &&
    wholeJob.current.blob === item.blob;
  useEffect(() => {
    setDetectedDuration(null);
    if (item.kind !== "video" || !item.blob) return;
    const element = document.createElement("video"),
      url = URL.createObjectURL(item.blob);
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      if (Number.isFinite(element.duration) && element.duration > 0) {
        setDetectedDuration(Math.ceil(element.duration));
        setRangeEnd(formatTime(Math.min(600, Math.floor(element.duration))));
      }
    };
    element.src = url;
    return () => {
      element.onloadedmetadata = null;
      element.removeAttribute("src");
      element.load();
      URL.revokeObjectURL(url);
    };
  }, [item.blob, item.kind]);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
    try {
      const lang = localStorage.getItem("lumio-ai-language");
      if (lang && lang in languages) setLanguage(lang as Locale);
    } catch {}
    return () => abort.current?.abort();
  }, []);
  const capability =
    sendRawMedia || (!activeRag && useVideo && video)
      ? "media"
      : task === "summary"
        ? "summary"
        : "tutor";
  const enabled = !!config?.capabilities?.[capability];
  const blocked = busy || readoutActive || restoringSession;
  async function generate() {
    if (
      locked.current ||
      reading.current ||
      restoringSession ||
      needsDocumentExtraction
    )
      return;
    setError("");
    setNotice("");
    if (needsRange && !rangeValid) {
      setError(rangeCopy[locale].invalid);
      return;
    }
    if (wholeVideo && !durationValid) {
      setError(full.unknown);
      return;
    }
    if (wholeVideo && useVideo && video && !finishedVideo) {
      setError(full.finished);
      return;
    }
    if (
      task === "summary" &&
      scope === "whole" &&
      !hasVideo &&
      item.sourceInfo?.truncated
    ) {
      setError(full.truncated);
      return;
    }
    if (
      item.text.length > 200000 ||
      (sendRawMedia && (item.blob?.size || 0) > 6 * 1024 * 1024)
    ) {
      setError(a.tooLarge);
      return;
    }
    setBusy(true);
    locked.current = true;
    abort.current = new AbortController();
    const requestSlot = tutorSlot.current,
      requestStamp = tutorSourceStamp.current;
    try {
      const media =
        sendRawMedia && item.blob
          ? {
              mimeType: (
                item.blob.type || (item.kind === "pdf" ? "application/pdf" : "")
              ).split(";")[0],
              data: await blobData(item.blob),
            }
          : undefined;
      const input: AIInput = {
        task,
        question,
        source: activeRag ? "" : item.text,
        sourceEvidence: activeRag ? undefined : item.sourceEvidence,
        ragScope: activeRag || undefined,
        language,
        media,
        // The server loads the canonical tutor history; no duplicate browser transcript is sent.
        history: [],
        tutorSessionId: task === "chat" ? tutorState?.sessionId : undefined,
        ...(task === "chat" && tutorIntent !== "progress"
          ? { tutorIntent }
          : {}),
        tutorProblem:
          task === "chat" && !tutorState ? question.trim() : undefined,
        mode: task === "chat" ? mode : "quick",
        difficulty,
        guidance,
        presentation,
        mathStyle,
        goal,
        youtubeUrl: !activeRag && useVideo && video ? video : undefined,
        videoRange: selectedRange,
      };
      async function requestAI(
        value: AIInput,
        signal: AbortSignal,
      ): Promise<AIResult> {
        const response = await paidFetch(
          "/api/ai",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(value),
            signal,
          },
          account,
        );
        const type = response.headers.get("content-type") || "";
        if (!type.includes("application/json"))
          throw new Error("PROVIDER_ERROR");
        const body = await response.json();
        signal.throwIfAborted();
        if (
          response.status === 409 &&
          body.error === "AI_REQUEST_COMPLETED" &&
          task === "chat" &&
          typeof body.receipt?.tutorSessionId === "string"
        ) {
          const recovered = await fetch(
            `/api/tutor/session?sessionId=${encodeURIComponent(body.receipt.tutorSessionId)}`,
            { headers: accountHeaders(account), signal, cache: "no-store" },
          );
          if (recovered.ok) {
            const view = (await recovered.json()) as TutorSessionView;
            signal.throwIfAborted();
            if (
              requestSlot !== tutorSlot.current ||
              requestStamp !== tutorSourceStamp.current
            )
              throw new Error("SOURCE_CHANGED");
            applyTutorSession(view);
            rememberTutor(view);
            throw new Error("TUTOR_RECOVERED");
          }
        }
        if (body.tutor && task === "chat") {
          if (
            itemRef.current.id !== item.id ||
            itemRef.current.text !== item.text ||
            itemRef.current.url !== item.url ||
            itemRef.current.blob !== item.blob ||
            requestSlot !== tutorSlot.current ||
            requestStamp !== tutorSourceStamp.current
          )
            throw new Error("SOURCE_CHANGED");
          rememberTutor(body.tutor, body.rag);
        }
        if (!response.ok) throw new Error(body.error || "PROVIDER_ERROR");
        return body as AIResult;
      }
      let r: AIResult, coverage: SummaryCoverage | undefined;
      if (wholeVideo) {
        if (
          !wholeJob.current ||
          wholeJob.current.key !== jobKey ||
          wholeJob.current.blob !== item.blob
        )
          wholeJob.current = { key: jobKey, blob: item.blob, summaries: [] };
        const job = wholeJob.current;
        setIncomplete(false);
        const complete = await runWholeVideoSummary({
          input,
          title: item.title,
          duration: duration!,
          signal: abort.current.signal,
          request: async (value, signal) => {
            const partResult = await requestAI(value, signal);
            job.result = partResult;
            return partResult;
          },
          completed: job.summaries,
          onPart: (summaries) => {
            job.summaries = summaries;
          },
          onProgress: setProgress,
        });
        coverage = {
          scope: "whole",
          method: "segmented-video",
          durationSeconds: Math.ceil(duration!),
          durationBasis: declaredDuration.trim() ? "declared" : "metadata",
          parts: complete.parts,
        };
        if (!job.result) throw new Error("INVALID_AI_OUTPUT");
        // Keep actual provider provenance from the last completed part. The merge is local.
        r = {
          ...job.result,
          usage: undefined,
          summary: complete.summary,
          text: summaryMarkdown(complete.summary),
        };
        wholeJob.current = null;
      } else {
        setProgress(null);
        setIncomplete(false);
        r = await requestAI(input, abort.current.signal);
        abort.current.signal.throwIfAborted();
        if (task === "summary" && scope === "whole")
          coverage = {
            scope: "whole",
            method: sendRawMedia ? "full-media" : "full-text",
          };
      }
      if (
        itemRef.current.id !== item.id ||
        itemRef.current.text !== item.text ||
        itemRef.current.url !== item.url ||
        itemRef.current.blob !== item.blob
      )
        throw new Error("SOURCE_CHANGED");
      setResult(r);
      onActivity?.(task === "chat" ? "chat" : "summary");
      if (r.summary) {
        const latest = itemRef.current;
        const artifact: StudyArtifact = {
          id: uid(),
          kind: "summary",
          createdAt: new Date().toISOString(),
          summary: r.summary,
          source: {
            kind:
              useVideo && video
                ? "youtube"
                : sendRawMedia
                  ? "media"
                  : item.sourceInfo?.kind === "website"
                    ? "website"
                    : item.sourceInfo?.kind === "captions"
                      ? "captions"
                      : "text",
            title: item.title,
            url: useVideo && video ? video : item.sourceInfo?.url || item.url,
            contentLength: item.text.length,
            range: wholeVideo ? undefined : selectedRange,
            coverage,
          },
        };
        update({
          ...latest,
          artifacts: [...(latest.artifacts || []), artifact].slice(-20),
        });
        setNotice(summaryCopy[locale].savedSummary);
      }
      if (task === "chat") {
        setHistory(
          (h) =>
            [
              ...h,
              { role: "user", text: question },
              {
                role: "assistant",
                text: r.text,
                references: r.references,
                verification: r.verification,
                turn: r.tutor?.latestTurn,
              },
            ].slice(-200) as typeof h,
        );
        setContinuity({ lastStudentAttempt: question, lastQuestion: null });
        setTutorIntent("progress");
        setQuestion("");
      }
      if (r.cards || r.questions) {
        const latest = itemRef.current;
        update({
          ...latest,
          cards: r.cards
            ? [...latest.cards, ...r.cards.map((c) => ({ ...c, id: uid() }))]
            : latest.cards,
          questions: r.questions
            ? [
                ...latest.questions,
                ...r.questions.map((q) => ({
                  ...q,
                  id: uid(),
                  answerKeyProvenance: "ai-unreviewed" as const,
                })),
              ]
            : latest.questions,
        });
        setNotice(a.added);
      }
    } catch (e) {
      if (e instanceof Error && e.message === "TUTOR_RECOVERED") {
        setNotice(
          locale === "vi"
            ? "Đã khôi phục câu trả lời đã hoàn tất; không gọi AI hoặc trừ credit lần nữa."
            : "Restored the completed reply without another AI call or charge.",
        );
        setQuestion("");
        setTutorIntent("progress");
        return;
      }
      if (wholeVideo && wholeJob.current?.key === jobKey) {
        setIncomplete(true);
        setNotice(full.incomplete);
      }
      if (!(e instanceof Error && e.name === "AbortError"))
        setError(
          e instanceof Error && e.message === "SOURCE_CHANGED"
            ? full.sourceChanged
            : e instanceof Error && e.message === "TUTOR_LOCKED"
              ? tutorCopy.rule
              : e instanceof Error &&
                  (e.message.startsWith("RAG_") ||
                    e.message.startsWith("EMBEDDING"))
                ? ragError(e.message, locale === "vi")
                : e instanceof Error && e.message === "INVALID_RAG_OUTPUT"
                  ? ragError(e.message, locale === "vi")
                  : e instanceof Error &&
                      [
                        "TUTOR_CONTEXT_CHANGED",
                        "TUTOR_SESSION_EXPIRED",
                        "TUTOR_SESSION_NOT_FOUND",
                      ].includes(e.message)
                    ? tutorCopy.expired
                    : aiErrorMessage(
                        e instanceof Error ? e.message : "PROVIDER_ERROR",
                        locale,
                      ),
        );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function transcribe() {
    if (locked.current || reading.current) return;
    locked.current = true;
    setError("");
    setNotice("");
    setBusy(true);
    abort.current = new AbortController();
    try {
      if (item.kind !== "audio" || !item.blob) throw new Error("INVALID_MEDIA");
      const blob = item.blob;
      const form = new FormData();
      form.set("file", blob, item.fileName || "recording.webm");
      form.set("language", language);
      const response = await paidFetch(
        "/api/voice",
        {
          method: "POST",
          body: form,
          signal: abort.current.signal,
        },
        account,
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "PROVIDER_ERROR");
      }
      if (itemRef.current.id !== item.id || itemRef.current.blob !== blob)
        throw new Error("SOURCE_CHANGED");
      const r = await response.json();
      if (typeof r.text !== "string" || !r.text.trim())
        throw new Error("EMPTY_AI_OUTPUT");
      setResult({
        text: r.text,
        provider: "xai",
        model: typeof r.model === "string" ? r.model : "",
      });
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setError(
          aiErrorMessage(
            e instanceof Error ? e.message : "PROVIDER_ERROR",
            locale,
          ),
        );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="lm-ai-workbench lm-studio">
      <div className="lm-studio-heading">
        <div className="lm-studio-emblem">
          <BrandSymbol />
          <span className="lm-orbit one" />
          <span className="lm-orbit two" />
        </div>
        <div>
          <span className="lm-studio-kicker">LUMIO AI</span>
          <h3>{task === "chat" ? t.chat : t[task]}</h3>
          <p>{copy.subtitle}</p>
        </div>
      </div>
      {!contextual && (
        <div className="lm-task-switch" aria-label={a.mode}>
          {(["chat", "summary", "cards", "quiz"] as const).map((k) => (
            <button
              key={k}
              className={task === k ? "selected" : ""}
              aria-pressed={task === k}
              disabled={blocked}
              onClick={() => {
                setTask(k);
                setResult(null);
                setError("");
              }}
            >
              {k === "chat" ? (
                <Sparkles size={16} />
              ) : k === "summary" ? (
                <BookOpen size={16} />
              ) : null}
              {t[k]}
            </button>
          ))}
        </div>
      )}
      <div className="lm-source-chip">
        <BookOpen size={15} />
        <span>
          {activeRag
            ? locale === "vi"
              ? "Đang đối chiếu"
              : "Comparing indexed sources"
            : copy.source}{" "}
          <strong>
            {activeRag
              ? `${ragScope.documentIds.length} ${locale === "vi" ? "học liệu đã chọn" : "selected sources"}`
              : item.title}
          </strong>
        </span>
      </div>
      {task === "summary" && (
        <details className="lm-panel" style={{ marginBlock: 16 }}>
          <summary>
            {locale === "vi"
              ? "Tùy chọn: tóm tắt chạy nền, có thể tiếp tục"
              : "Optional: resumable background summary"}
          </summary>
          <SummaryJobManager
            key={`${item.id}:${language}`}
            locale={language}
            title={item.title}
            source={item.text}
            clientItemId={item.id}
            youtubeUrl={video || undefined}
          />
        </details>
      )}
      {needsDocumentExtraction && (
        <div className="lm-soft-notice" role="status">
          <BookOpen size={20} />
          <div>
            <p>{tutorCopy.extract}</p>
            {onOpenSource && (
              <button className="lm-button" onClick={() => onOpenSource()}>
                {learning.source}
                <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </div>
      )}
      {item.kind === "link" && !item.text && !video && (
        <div className="lm-soft-notice">
          <BookOpen size={20} />
          <div>
            <strong>{learning.source}</strong>
            <p>{learning.intro}</p>
            {onOpenSource && (
              <button className="lm-button" onClick={() => onOpenSource()}>
                {learning.extract}
                <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </div>
      )}
      {video && (
        <div className="lm-video-context">
          <label>
            <input
              type="checkbox"
              checked={useVideo}
              disabled={blocked}
              onChange={(event) => setUseVideo(event.target.checked)}
            />
            {learning.videoAttached}
          </label>
          <p>{learning.videoHint}</p>
        </div>
      )}
      {task === "summary" && (
        <fieldset className="lm-full-summary-scope" data-scope={scope}>
          <legend>{full.title}</legend>
          <div
            className="lm-full-scope-switch"
            role="group"
            aria-label={full.title}
          >
            <button
              type="button"
              data-full-summary-action="whole"
              className={scope === "whole" ? "selected" : ""}
              aria-pressed={scope === "whole"}
              disabled={blocked}
              onClick={() => setScope("whole")}
            >
              <Sparkles size={16} />
              {full.whole}
            </button>
            {hasVideo && (
              <button
                type="button"
                data-full-summary-action="range"
                className={scope === "range" ? "selected" : ""}
                aria-pressed={scope === "range"}
                disabled={blocked}
                onClick={() => setScope("range")}
              >
                {full.section}
              </button>
            )}
          </div>
          {scope === "whole" && <p>{full.wholeHint}</p>}
          {wholeVideo && (
            <>
              <label>
                {full.duration}
                <input
                  aria-label={full.duration}
                  inputMode="numeric"
                  maxLength={9}
                  disabled={blocked}
                  value={
                    declaredDuration ||
                    (detectedDuration ? formatTime(detectedDuration) : "")
                  }
                  placeholder="HH:MM:SS"
                  aria-invalid={!durationValid}
                  onChange={(event) => setDeclaredDuration(event.target.value)}
                />
              </label>
              <p>{full.durationHint}</p>
              {useVideo && video && (
                <label className="lm-finished-video">
                  <input
                    type="checkbox"
                    data-full-summary-finished
                    checked={finishedVideo}
                    disabled={blocked}
                    onChange={(event) => setFinishedVideo(event.target.checked)}
                  />
                  {full.finished}
                </label>
              )}
              {durationValid ? (
                <p>
                  <strong>
                    00:00–{formatTime(duration!)} ·{" "}
                    {wholeVideoParts(duration!).length} {full.parts}
                  </strong>{" "}
                  · {declaredDuration.trim() ? full.declared : full.detected}
                </p>
              ) : (
                <p className="lm-help">{full.unknown}</p>
              )}
              <p>{full.batchHint}</p>
              {useVideo && video && enabled && (
                <VideoDurationProbe
                  videoURL={video}
                  title={item.title}
                  onDuration={setDetectedDuration}
                />
              )}
            </>
          )}
          {scope === "whole" && !hasVideo && item.sourceInfo?.truncated && (
            <p className="lm-error" role="alert">
              {full.truncated}
            </p>
          )}
        </fieldset>
      )}
      {needsRange && (
        <fieldset className="lm-video-range">
          <legend>{rangeCopy[locale].title}</legend>
          <div>
            <label>
              {rangeCopy[locale].start}
              <input
                value={rangeStart}
                inputMode="numeric"
                maxLength={9}
                disabled={blocked}
                aria-invalid={!rangeValid}
                onChange={(event) => setRangeStart(event.target.value)}
              />
            </label>
            <span>→</span>
            <label>
              {rangeCopy[locale].end}
              <input
                value={rangeEnd}
                inputMode="numeric"
                maxLength={9}
                disabled={blocked}
                aria-invalid={!rangeValid}
                onChange={(event) => setRangeEnd(event.target.value)}
              />
            </label>
          </div>
          <p>{rangeCopy[locale].hint}</p>
        </fieldset>
      )}
      {task === "chat" && (
        <div className="lm-tutor-settings">
          <TutorProgress
            locale={locale}
            state={tutorState}
            disabled={blocked}
            restoring={restoringSession}
            onNew={newTutorProblem}
            onUnlock={() => {
              if (!tutorState?.canUnlock) return;
              setGuidance("full");
              setQuestion(
                locale === "vi"
                  ? "Mình đã thử các gợi ý. Hãy trình bày lời giải đầy đủ, có điều kiện và kiểm tra kết quả."
                  : "I have worked through the hints. Please show the complete solution with conditions and a result check.",
              );
            }}
          />
          <TutorHelpIntent
            locale={locale}
            value={tutorIntent}
            disabled={blocked || restoringSession || guidance === "full"}
            onChange={setTutorIntent}
          />
          {continuity && (
            <details className="lm-learning-preferences">
              <summary>{tutorSupportCopy(locale).continuity}</summary>
              <p>{tutorSupportCopy(locale).caution}</p>
              {continuity.lastQuestion && (
                <p>
                  <strong>{tutorSupportCopy(locale).question}: </strong>
                  {continuity.lastQuestion}
                </p>
              )}
              {continuity.lastStudentAttempt && (
                <p>
                  <strong>{tutorSupportCopy(locale).attempt}: </strong>
                  {continuity.lastStudentAttempt}
                </p>
              )}
            </details>
          )}
          <div
            className="lm-tutor-modes"
            role="group"
            aria-label={learning.mode}
          >
            {(["quick", "think", "deep", "tutor"] as const).map(
              (key, index) => {
                const Icon = [Zap, Brain, Telescope, GraduationCap][index];
                return (
                  <button
                    key={key}
                    className={mode === key ? "selected" : ""}
                    aria-pressed={mode === key}
                    disabled={blocked}
                    onClick={() => setMode(key)}
                    title={learning.modeHints[index]}
                  >
                    <Icon size={18} />
                    {learning.modes[index]}
                  </button>
                );
              },
            )}
          </div>
          <p className="lm-mode-description">
            {
              learning.modeHints[
                (["quick", "think", "deep", "tutor"] as const).indexOf(mode)
              ]
            }
          </p>
          <details className="lm-learning-preferences">
            <summary>
              {learning.goal} · {learning.difficulty}
            </summary>
            <div className="lm-preference-grid">
              <label>
                {learning.difficulty}
                <select
                  value={difficulty}
                  disabled={blocked}
                  onChange={(event) =>
                    setDifficulty(event.target.value as AIInput["difficulty"])
                  }
                >
                  {(["beginner", "intermediate", "advanced"] as const).map(
                    (level, index) => (
                      <option value={level} key={level}>
                        {learning.levels[index]}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                {learning.guidance}
                <select
                  value={guidance}
                  disabled={blocked}
                  onChange={(event) =>
                    setGuidance(event.target.value as AIInput["guidance"])
                  }
                >
                  <option value="hints">{learning.hint}</option>
                  <option value="full" disabled={!tutorState?.canUnlock}>
                    {learning.full}
                    {!tutorState?.canUnlock ? " 🔒" : ""}
                  </option>
                </select>
              </label>
              <label>
                {learning.presentation}
                <select
                  value={presentation}
                  disabled={blocked}
                  onChange={(event) =>
                    setPresentation(
                      event.target.value as AIInput["presentation"],
                    )
                  }
                >
                  <option value="auto">{learning.auto}</option>
                  <option value="math">{learning.math}</option>
                </select>
              </label>
              {presentation === "math" && (
                <label>
                  {mathCopy[locale].label}
                  <select
                    value={mathStyle}
                    disabled={blocked}
                    onChange={(event) =>
                      setMathStyle(event.target.value as MathStyle)
                    }
                  >
                    {MATH_STYLES.map((style) => (
                      <option key={style} value={style}>
                        {mathCopy[locale].styles[style]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="lm-goal-field">
                {learning.goal}
                <input
                  value={goal}
                  disabled={blocked}
                  maxLength={500}
                  placeholder={learning.goalHint}
                  onChange={(event) => setGoal(event.target.value)}
                />
              </label>
            </div>
          </details>
          {presentation === "math" && (
            <p className="lm-mode-description">
              {mathCopy[locale].hint} {mathCopy[locale].image}
            </p>
          )}
        </div>
      )}
      {task === "chat" && (
        <div className="lm-prompt-suggestions">
          {copy.suggestions.map((suggestion, i) => (
            <button
              key={suggestion}
              disabled={blocked}
              onClick={() => setQuestion(suggestion)}
            >
              <span>0{i + 1}</span>
              {suggestion}
              <ArrowUpRight size={15} />
            </button>
          ))}
        </div>
      )}
      {task === "chat" && (
        <RAGScopeSelector
          workspaceId={item.spaceId || "main"}
          locale={locale}
          value={ragScope}
          disabled={blocked}
          onChange={(value) => {
            newTutorProblem();
            setRagScope(value);
          }}
        />
      )}
      {activeRag && (
        <p className="lm-soft-notice" role="note">
          {locale === "vi"
            ? "Câu hỏi, các đoạn truy xuất trong nguồn đã chọn và lịch sử bài hiện tại được gửi tới dịch vụ AI bên ngoài. Không gửi tệp gốc hoặc toàn bộ kho nguồn. Trích dẫn khớp nguồn không chứng minh câu trả lời đúng."
            : "Your question, retrieved excerpts from selected sources and this exercise history are sent to an external AI service. Original files and the whole index are not sent. Matching citations do not prove the answer is correct."}
        </p>
      )}
      {ragWarning && (
        <p className="lm-soft-notice" role="status">
          {locale === "vi"
            ? "Có thể có dữ kiện số mâu thuẫn trong các đoạn truy xuất. Hãy đối chiếu từng nguồn; chưa có xác minh ngữ nghĩa tự động."
            : "Retrieved excerpts may contain conflicting numeric facts. Compare each source; this is not automatic semantic verification."}
        </p>
      )}
      {task === "chat" && history.length > 0 && (
        <section
          className="lm-tutor-conversation"
          aria-label={tutorCopy.history}
          data-tutor-history
        >
          <h4>{tutorCopy.history}</h4>
          {history.map((turn, index) => (
            <article className={`lm-tutor-message ${turn.role}`} key={index}>
              <small>
                {turn.role === "user" ? tutorCopy.you : tutorCopy.tutor}
              </small>
              <MathText text={turn.text} />
              {turn.role === "assistant" && (
                <>
                  <SourceReferences
                    references={turn.references}
                    source={item.text}
                    evidence={item.sourceEvidence}
                    item={item}
                    locale={locale}
                    onOpenSource={onOpenSource}
                  />
                  <MathVerificationNotice
                    verification={turn.verification}
                    locale={locale}
                  />
                  {turn.turn && tutorState && (
                    <>
                      <small>
                        {!turn.turn.counted && turn.turn.intent !== "progress"
                          ? tutorSupportCopy(locale).recorded
                          : ""}
                      </small>
                      <TutorTurnFeedback
                        key={`${tutorState.sessionId}:${turn.turn.id}`}
                        locale={locale}
                        sessionId={tutorState.sessionId}
                        turn={turn.turn}
                      />
                    </>
                  )}
                </>
              )}
            </article>
          ))}
        </section>
      )}
      {enabled && !activeRag && (
        <OutboundDataNotice
          locale={locale}
          action={task === "cards" ? "flashcards" : task}
          sourceCharacters={item.text.length}
          questionCharacters={question.trim().length}
          historyMessages={task === "chat" ? history.length : 0}
          tutorSession={task === "chat"}
          mediaKind={
            sendRawMedia &&
            ["image", "pdf", "audio", "video"].includes(item.kind)
              ? (item.kind as "image" | "pdf" | "audio" | "video")
              : undefined
          }
          videoUrl={!!(useVideo && video)}
        />
      )}
      <div className="lm-composer">
        {task === "chat" ? (
          <textarea
            aria-label={a.question}
            rows={4}
            maxLength={4000}
            value={question}
            disabled={blocked}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t.ask}
          />
        ) : (
          <div className="lm-task-description">
            <Sparkles size={24} />
            <p>
              {task === "summary"
                ? copy.summaryHint
                : task === "cards"
                  ? copy.cardsHint
                  : copy.quizHint}
            </p>
          </div>
        )}
        <div className="lm-composer-bottom">
          <label>
            <span className="lm-sr-only">{a.language}</span>
            <select
              aria-label={a.language}
              value={language}
              disabled={blocked}
              onChange={(e) => setLanguage(e.target.value as Locale)}
            >
              {Object.entries(languages).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="lm-row">
            {busy && (
              <button
                className="lm-button plain"
                onClick={() => abort.current?.abort()}
              >
                {a.cancel}
              </button>
            )}
            <button
              className="lm-button primary"
              data-full-summary-generate
              disabled={
                !enabled ||
                needsDocumentExtraction ||
                blocked ||
                (needsRange && !rangeValid) ||
                (wholeVideo && !durationValid) ||
                (wholeVideo && !!(useVideo && video) && !finishedVideo) ||
                (task === "summary" &&
                  scope === "whole" &&
                  !hasVideo &&
                  !!item.sourceInfo?.truncated) ||
                (task === "chat" && !question.trim()) ||
                (item.kind === "link" && !item.text && !(video && useVideo))
              }
              onClick={() => void generate()}
            >
              {busy ? (
                <LoaderCircle className="lm-spin" size={17} />
              ) : (
                <Sparkles size={17} />
              )}{" "}
              {busy
                ? a.busy
                : task === "chat"
                  ? copy.send
                  : canResume
                    ? full.resume
                    : copy.generate}
            </button>
          </div>
        </div>
      </div>
      {progress && (
        <div
          className="lm-full-summary-progress"
          data-full-summary-progress
          data-completed={progress.completed}
          data-total={progress.total}
          role="status"
        >
          <span>
            {full.progress} {progress.completed}/{progress.total} {full.parts} ·{" "}
            {formatTime(progress.part.startSeconds)}–
            {formatTime(progress.part.endSeconds)}
          </span>
          <progress max={progress.total} value={progress.completed} />
          {incomplete && (
            <p className="lm-full-summary-incomplete">{full.incomplete}</p>
          )}
        </div>
      )}
      {!enabled ? (
        <div className="lm-soft-notice">
          <span className="lm-notice-dot" />
          <div>
            <strong>{copy.offline}</strong>
            <p>{copy.offlineHint}</p>
          </div>
        </div>
      ) : (
        <p className="lm-processing-note">{copy.disclosure}</p>
      )}
      {error && (
        <p className="lm-error" role="alert">
          {error}
          {video && (
            <span className="lm-video-fallback">
              {learning.videoUnavailable}
            </span>
          )}
        </p>
      )}
      {notice && (
        <p className="lm-feedback" role="status">
          {notice}
        </p>
      )}
      {task === "summary" && savedSummary && (
        <RichSummary
          onOpenSource={onOpenSource}
          key={savedSummary.id}
          artifact={savedSummary}
          item={item}
          locale={locale}
          updateArtifact={(artifact) => {
            const latest = itemRef.current;
            update({
              ...latest,
              artifacts: latest.artifacts?.map((a) =>
                a.id === artifact.id ? artifact : a,
              ),
            });
          }}
        />
      )}
      {result && !result.summary && (
        <section className="lm-ai-result">
          <small>
            <Sparkles size={14} /> {copy.answer}
          </small>
          {!!result.questions?.length && (
            <p className="lm-help" data-ai-key-review>
              {quizReviewCopy[locale].ai}
            </p>
          )}
          {task !== "chat" && (
            <MathText
              text={
                result.cards
                  ? result.cards
                      .map((c, i) => `${i + 1}. ${c.front}\n${c.back}`)
                      .join("\n\n")
                  : result.questions
                    ? result.questions
                        .map(
                          (q, i) =>
                            `${i + 1}. ${q.prompt}\n${q.options.join(" / ")}\n${quizReviewCopy[locale].key}: ${q.options[q.correct]}\n${q.explanation}`,
                        )
                        .join("\n\n")
                    : result.text
              }
            />
          )}
          {task !== "chat" && (
            <SourceReferences
              references={result.references}
              source={item.text}
              evidence={item.sourceEvidence}
              item={item}
              locale={locale}
              onOpenSource={onOpenSource}
            />
          )}
          <ContentQualityNotice quality={result.quality} locale={locale} />
          <p className="lm-help">{a.review}</p>
          <button
            className="lm-button"
            onClick={() => {
              update({
                ...itemRef.current,
                notes: `${itemRef.current.notes}\n\n${result.text}`.trim(),
              });
              setNotice(a.copied);
            }}
          >
            <Save size={16} />
            {a.saveNotes}
          </button>
        </section>
      )}
      {(config?.capabilities?.speech ||
        (config?.capabilities?.transcription && item.kind === "audio")) && (
        <div className="lm-voice-inline">
          <div className="lm-row">
            {config.capabilities.transcription &&
              item.kind === "audio" &&
              item.blob && (
                <OutboundDataNotice
                  locale={locale}
                  action="transcription"
                  mediaKind="audio"
                />
              )}
            {config.capabilities.transcription &&
              item.kind === "audio" &&
              item.blob && (
                <button
                  className="lm-button"
                  disabled={blocked}
                  onClick={() => void transcribe()}
                >
                  <Mic size={16} />
                  {copy.transcribe}
                </button>
              )}
          </div>
          {config.capabilities.speech && (
            <AudioReadout
              locale={locale}
              language={language}
              text={result?.text || item.notes || item.text}
              disabled={busy}
              onActiveChange={(active) => {
                reading.current = active;
                setReadoutActive(active);
              }}
            />
          )}
          {config.capabilities.transcription && item.kind === "audio" && (
            <p className="lm-processing-note">{copy.voicePrivacy}</p>
          )}
        </div>
      )}
    </div>
  );
}
