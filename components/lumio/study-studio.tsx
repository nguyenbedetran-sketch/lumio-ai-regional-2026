"use client";
import { paidFetch } from "../../lib/ai/request-client";
import { useAccountScope } from "./account-scope";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ClipboardList,
  Download,
  FileText,
  Headphones,
  Layers,
  LoaderCircle,
  Network,
  Play,
  Sparkles,
  StickyNote,
  Video,
  X,
} from "lucide-react";
import type { LearningItem, ProviderStatus } from "../../lib/lumio/types";
import { languages, type Locale } from "../../lib/lumio/i18n";
import { studioCopy } from "../../lib/lumio/studio-copy";
import { aiErrorMessage } from "../../lib/lumio/ai-copy";
import { downloadText } from "../../lib/lumio/enhancements";
import { youtubeURL } from "../../lib/ingestion/youtube";
import { ExperienceSkeleton } from "./experience-v2";
import { studyV3Copy } from "../../lib/lumio/study-v3-copy";
type Task = "summary" | "cards" | "quiz" | "chat";
export type StudioDrafts = {
  script: string;
  language: Locale;
  plan: string;
  savedPlan?: string;
};
export function StudyStudio({
  item,
  locale,
  onTask,
  onOpenNotes,
  onOpenSource,
  update,
  summaryText = "",
  drafts,
  onDraft,
}: {
  item: LearningItem;
  locale: Locale;
  onTask: (task: Task) => void;
  onOpenNotes?: () => void;
  onOpenSource?: () => void;
  update?: (item: LearningItem) => void;
  summaryText?: string;
  drafts?: StudioDrafts;
  onDraft?: (value: StudioDrafts) => void;
}) {
  const c = studioCopy[locale],
    [panel, setPanel] = useState<"audio" | "plan" | null>(null),
    [script, setScript] = useState(
      drafts?.script ?? (summaryText || item.notes || item.text).slice(0, 3000),
    ),
    [language, setLanguage] = useState<Locale>(drafts?.language ?? locale),
    [plan, setPlan] = useState(drafts?.plan ?? ""),
    [saved, setSaved] = useState(
      !!drafts?.savedPlan &&
        drafts.savedPlan === drafts.plan &&
        item.notes.includes(drafts.savedPlan),
    ),
    [speech, setSpeech] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [audio, setAudio] = useState("");
  const abort = useRef<AbortController | null>(null),
    audioRef = useRef(""),
    alive = useRef(true);
  const workbench = useRef<HTMLElement>(null);
  const account = useAccountScope();
  const opener = useRef<HTMLButtonElement | null>(null);
  const workbenchId = useId();
  const sc = studyV3Copy[locale];
  useEffect(
    () =>
      onDraft?.({
        script,
        language,
        plan,
        savedPlan: saved ? plan : undefined,
      }),
    [script, language, plan, saved, onDraft],
  );
  useEffect(() => {
    alive.current = true;
    if (panel) workbench.current?.focus({ preventScroll: false });
  }, [panel]);
  function closePanel() {
    abort.current?.abort();
    setPanel(null);
    opener.current?.focus({ preventScroll: true });
  }
  useEffect(() => {
    let active = true;
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((v: ProviderStatus | null) => {
        if (active) setSpeech(!!v?.capabilities?.speech);
      })
      .catch(() => {});
    return () => {
      active = false;
      alive.current = false;
      abort.current?.abort();
      if (audioRef.current) URL.revokeObjectURL(audioRef.current);
    };
  }, []);
  function openAudio() {
    setPanel("audio");
    setError("");
  }
  function openPlan() {
    setPanel("plan");
    setError("");
    if (!plan)
      setPlan(
        `# ${c.plan}: ${item.title}\n\n## ${c.goal}\n${c.goalHint}\n\n## ${c.read}\n${c.readHint}\n\n## ${c.recall}\n${c.recallHint}\n\n## ${c.practice}\n${c.practiceHint}`,
      );
  }
  async function speak() {
    if (!script.trim() || script.length > 3000 || busy || abort.current) return;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    abort.current = controller;
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await paidFetch(
        "/api/voice",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: script.trim(), language }),
          signal: controller.signal,
        },
        account,
      );
      if (!response.ok) {
        const problem = await response
          .json()
          .catch(() => ({ error: "PROVIDER_ERROR" }));
        throw new Error(problem.error || "PROVIDER_ERROR");
      }
      if (!response.headers.get("content-type")?.startsWith("audio/"))
        throw new Error("INVALID_AI_OUTPUT");
      const blob = await response.blob();
      if (controller.signal.aborted || !alive.current) return;
      if (blob.size > 20 * 1024 * 1024 || !blob.size)
        throw new Error("INVALID_AI_OUTPUT");
      if (audioRef.current) URL.revokeObjectURL(audioRef.current);
      audioRef.current = URL.createObjectURL(blob);
      setAudio(audioRef.current);
    } catch (e) {
      if (alive.current && e instanceof Error && e.name !== "AbortError")
        setError(aiErrorMessage(e.message, locale));
    } finally {
      clearTimeout(timeout);
      if (alive.current) setBusy(false);
      if (abort.current === controller) abort.current = null;
    }
  }
  const videoReady =
    item.kind === "video" || !!(item.url && youtubeURL(item.url));
  const actions = [
    {
      id: "summary",
      title: c.summary,
      description: c.summarySub,
      Icon: Network,
      action: () => onTask("summary"),
    },
    {
      id: "cards",
      title: c.cards,
      description: c.cardsSub,
      Icon: Layers,
      action: () => onTask("cards"),
    },
    {
      id: "quiz",
      title: c.quiz,
      description: c.quizSub,
      Icon: ClipboardList,
      action: () => onTask("quiz"),
    },
    {
      id: "notes",
      title: c.notes,
      description: c.notesSub,
      Icon: StickyNote,
      action: onOpenNotes,
    },
    {
      id: "audio",
      title: c.audio,
      description: c.audioSub,
      Icon: Headphones,
      action: openAudio,
    },
    {
      id: "lesson",
      title: c.lesson,
      description: c.lessonSub,
      Icon: BookOpen,
      action: openPlan,
    },
    {
      id: "video",
      title: c.video,
      description: videoReady ? c.videoSub : c.noVideo,
      Icon: Video,
      action: videoReady ? onOpenSource : undefined,
    },
  ];
  return (
    <div className="ls-studio lsv-studio">
      <header className="ls-studio-header">
        <span className="ls-studio-emblem">
          <Sparkles size={25} />
        </span>
        <div>
          <span className="lx-kicker">LUMIO / {c.studio}</span>
          <h2>{c.title}</h2>
          <p>{c.sub}</p>
        </div>
      </header>
      <div className="ls-source">
        <FileText size={13} />
        <span>{c.source}</span>
        <strong>{item.title}</strong>
      </div>
      <section className="lsv-toolkit" aria-label={sc.savedWork}>
        <div className="lsv-toolkit-heading">
          <span>{sc.savedWork}</span>
          <small>
            {item.text.length.toLocaleString(locale)}{" "}
            {sc.sourceLength.toLowerCase()}
          </small>
        </div>
        <div className="lsv-toolkit-stats">
          {[
            {
              id: "summary",
              label: sc.savedSummary,
              count:
                item.artifacts?.filter((a) => a.kind === "summary").length || 0,
            },
            { id: "cards", label: sc.cardsReady, count: item.cards.length },
            {
              id: "quiz",
              label: sc.questionsReady,
              count: item.questions.length,
            },
            {
              id: "notes",
              label: sc.notesReady,
              count: item.notes.trim() ? 1 : 0,
            },
          ].map(({ id, label, count }) => (
            <div key={id} className={count ? "has-content" : ""}>
              <span className="lsv-toolkit-check" aria-hidden="true">
                {count ? <Check size={14} /> : <span />}
              </span>
              <span>
                <strong>{label}</strong>
                <small>
                  {count
                    ? id === "notes"
                      ? c.saved
                      : count.toLocaleString(locale)
                    : sc.notCreated}
                </small>
              </span>
            </div>
          ))}
        </div>
      </section>
      <div className="ls-generator-grid">
        {actions.map(({ id, title, description, Icon, action }) => (
          <button
            key={id}
            className={`ls-generator ${id}`}
            disabled={!action}
            aria-expanded={
              id === "audio" || id === "lesson"
                ? panel === (id === "audio" ? "audio" : "plan")
                : undefined
            }
            aria-controls={
              id === "audio" || id === "lesson" ? workbenchId : undefined
            }
            onClick={(event) => {
              opener.current = event.currentTarget;
              setPanel(null);
              action?.();
            }}
          >
            <span className="ls-generator-icon">
              <Icon size={23} />
            </span>
            <strong>{title}</strong>
            <small>{description}</small>
            <ArrowUpRight size={17} />
          </button>
        ))}
      </div>
      {panel && (
        <section
          ref={workbench}
          id={workbenchId}
          tabIndex={-1}
          className="ls-workbench"
          aria-busy={busy}
          aria-labelledby={`${workbenchId}-title`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closePanel();
            }
          }}
        >
          <div className="ls-workbench-heading">
            <div>
              <span className="lx-kicker">
                {panel === "audio" ? c.audio : c.local}
              </span>
              <h3 id={`${workbenchId}-title`}>
                {panel === "audio" ? c.audioTitle : c.planTitle}
              </h3>
              <p>{panel === "audio" ? c.audioHint : c.planHint}</p>
            </div>
            <button
              className="lx-round-button"
              aria-label={c.close}
              onClick={closePanel}
            >
              <X size={17} />
            </button>
          </div>
          {panel === "audio" ? (
            <>
              <label className="lm-field">
                {c.script}
                <textarea
                  value={script}
                  maxLength={3000}
                  placeholder={c.noText}
                  onChange={(e) => setScript(e.target.value)}
                  rows={7}
                />
              </label>
              <div className="ls-audio-controls">
                <label className="lm-field">
                  {c.language}
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Locale)}
                  >
                    {Object.entries(languages).map(([key, label]) => (
                      <option value={key} key={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <small>{script.length.toLocaleString(locale)} / 3,000</small>
                <button
                  className="lm-button primary"
                  disabled={!speech || !script.trim() || busy}
                  onClick={() => void speak()}
                >
                  {busy ? (
                    <LoaderCircle className="ls-loading" size={16} />
                  ) : (
                    <Play size={16} />
                  )}{" "}
                  {busy ? c.generating : c.generate}
                </button>
                {busy && (
                  <button
                    className="lm-button"
                    onClick={() => abort.current?.abort()}
                  >
                    {c.stop}
                  </button>
                )}
              </div>
              {busy && <ExperienceSkeleton compact label={c.generating} />}
              {!speech && <p className="lm-help">{c.connect}</p>}
              <p className="ls-disclosure">{c.sent}</p>
              {audio && (
                <div className="ls-audio-result">
                  <Headphones size={26} />
                  <audio controls src={audio} />
                  <a
                    className="lm-button"
                    href={audio}
                    download={`${item.title.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 70) || "lumio"}-audio.mp3`}
                  >
                    <Download size={16} />
                    {c.download}
                  </a>
                </div>
              )}
              <button
                className="lx-text-button"
                disabled={!script.trim()}
                onClick={() =>
                  downloadText(`${item.title}-audio-script`, "md", script)
                }
              >
                <Download size={14} />
                {c.export}
              </button>
            </>
          ) : (
            <>
              <textarea
                className="ls-plan-editor"
                aria-label={c.lesson}
                rows={13}
                value={plan}
                maxLength={50000}
                onChange={(e) => {
                  setPlan(e.target.value);
                  setSaved(false);
                }}
              />
              <div className="lm-row">
                <button
                  className="lm-button primary"
                  disabled={!update || !plan.trim() || saved}
                  onClick={() => {
                    if (item.notes.length + plan.length + 2 > 200000) {
                      setError(c.notesFull);
                      return;
                    }
                    update?.({
                      ...item,
                      notes: [item.notes, plan].filter(Boolean).join("\n\n"),
                    });
                    setSaved(true);
                  }}
                >
                  {saved ? <Check size={16} /> : <StickyNote size={16} />}{" "}
                  {saved ? c.saved : c.saveNotes}
                </button>
                <button
                  className="lm-button"
                  disabled={!plan.trim()}
                  onClick={() =>
                    downloadText(`${item.title}-study-plan`, "md", plan)
                  }
                >
                  <Download size={16} />
                  {c.export}
                </button>
              </div>
            </>
          )}
          {error && (
            <p className="lm-error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
