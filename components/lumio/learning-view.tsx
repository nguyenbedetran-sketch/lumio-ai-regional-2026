"use client";
import { useEffect, useState, useRef, useId, type CSSProperties } from "react";
import {
  ArrowLeft,
  FileText,
  BookOpen,
  StickyNote,
  Layers,
  ClipboardCheck,
  Sparkles,
  MessageCircle,
  ExternalLink,
  Download,
  Star,
  Trash2,
  Send,
  Maximize2,
  Minimize2,
  Globe,
  Upload,
  LoaderCircle,
  Check,
  Play,
  Type,
  ChevronDown,
} from "lucide-react";
import { LearningItem, Space } from "../../lib/lumio/types";
import type { Messages, Locale } from "../../lib/lumio/i18n";
import {
  Flashcards,
  Quiz,
  type FlashcardDrafts,
  type QuizDrafts,
} from "./study-tools";
import { AIPanel } from "./ai-panel";
import { youtubeURL } from "../../lib/ingestion/youtube";
import { parseCaptions, captionText } from "../../lib/ingestion/captions";
import { linkCopy } from "../../lib/ingestion/copy";
import { StudyStudio, type StudioDrafts } from "./study-studio";
import { summaryMarkdown } from "../../lib/ai/summary";
import type { AITask } from "../../lib/ai/contracts";
import { studioCopy } from "../../lib/lumio/studio-copy";
import { studyV3Copy } from "../../lib/lumio/study-v3-copy";
import { DocumentExtraction } from "./document-extraction";
import { Dialog } from "./dialog";
import {
  validateReferences,
  type SourceReference,
} from "../../lib/ai/grounding";
import { formatTime } from "../../lib/ai/summary";
import { useDraft } from "../shared/draft-guard";
import {
  defaultReaderPreferences,
  parseReaderPreferences,
  readerPreferencesKey,
  type ReaderPreferences,
} from "../../lib/lumio/study-v3";
import {
  enhancements,
  downloadText,
  cardsCSV,
} from "../../lib/lumio/enhancements";
function LinkSource({
  item,
  locale,
  update,
  learn,
  draftState,
  onDraft,
}: {
  item: LearningItem;
  locale: Locale;
  update: (i: LearningItem) => void;
  learn: () => void;
  draftState?: { text: string; info: LearningItem["sourceInfo"] };
  onDraft?: (value: { text: string; info: LearningItem["sourceInfo"] }) => void;
}) {
  const c = linkCopy[locale];
  const video = youtubeURL(item.url || "");
  const [draft, setDraft] = useState(draftState?.text ?? item.text),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [info, setInfo] = useState<LearningItem["sourceInfo"]>(
    draftState?.info ?? item.sourceInfo,
  );
  const controller = useRef<AbortController | null>(null),
    latest = useRef(item),
    fileInput = useRef<HTMLInputElement | null>(null);
  latest.current = item;
  useEffect(() => onDraft?.({ text: draft, info }), [draft, info, onDraft]);
  useEffect(() => () => controller.current?.abort(), []);
  async function extract() {
    if (controller.current) return;
    setBusy(true);
    setError("");
    setNotice("");
    const request = new AbortController();
    controller.current = request;
    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.url }),
        signal: request.signal,
      });
      const result = await response.json();
      if (request.signal.aborted) return;
      if (!response.ok) throw new Error(result.error || "PAGE_UNAVAILABLE");
      setDraft(result.text);
      setInfo({
        kind: "website",
        url: result.url,
        fetchedAt: result.fetchedAt,
        title: result.title,
        truncated: result.truncated,
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      const code = e instanceof Error ? e.message : "";
      setError(
        code === "SIGN_IN_REQUIRED" ||
          code === "UNAUTHENTICATED" ||
          code === "SESSION_REVOKED"
          ? c.signIn
          : code === "URL_NOT_PUBLIC"
            ? c.publicOnly
            : c.error,
      );
    } finally {
      setBusy(false);
      if (controller.current === request) controller.current = null;
    }
  }
  async function importCaptions(file?: File) {
    if (!file) return;
    setError("");
    setNotice("");
    try {
      if (file.size > 200000 || !/\.(vtt|srt)$/i.test(file.name))
        throw new Error("INVALID_CAPTIONS");
      const text = captionText(parseCaptions(await file.text()));
      if (text.length > 50000) throw new Error("CAPTIONS_TOO_LARGE");
      setDraft(text);
      setInfo({
        kind: "captions",
        filename: file.name,
        fetchedAt: new Date().toISOString(),
      });
    } catch {
      setError(c.badCaption);
    }
  }
  return (
    <section className="lm-link-workspace">
      <div className={`lm-link-hero ${video ? "is-video" : ""}`}>
        <span className="lm-link-orbit">
          {video ? <Play size={27} /> : <Globe size={27} />}
        </span>
        <div>
          <small>{video ? "YOUTUBE" : "WEB → LEARNING"}</small>
          <h3>{video ? c.youtube : c.title}</h3>
          <p>{video ? c.videoHint : c.intro}</p>
        </div>
        <div className="lm-row">
          <button
            className="lm-button primary"
            disabled={busy}
            onClick={video ? learn : () => void extract()}
          >
            {busy ? (
              <LoaderCircle size={17} className="lm-spin" />
            ) : (
              <Sparkles size={17} />
            )}{" "}
            {busy ? c.busy : video ? c.learnVideo : c.extract}
          </button>
          <a
            className="lm-button"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={item.url}
          >
            <ExternalLink size={16} />
            <span>{new URL(item.url || "https://example.com").hostname}</span>
          </a>
        </div>
      </div>
      <div className="lm-source-editor">
        <div className="lm-source-head">
          <strong>{draft ? c.preview : c.source}</strong>
          <span>
            {draft.length.toLocaleString(locale)} / 50.000 {c.characters}
          </span>
        </div>
        {info && (
          <div className="lm-source-provenance">
            <Check size={15} />
            <span>
              {info.kind === "website"
                ? c.loaded
                : info.kind === "captions"
                  ? info.filename
                  : c.manual}{" "}
              {info.url && (
                <a href={info.url} target="_blank" rel="noopener noreferrer">
                  {new URL(info.url).hostname}
                </a>
              )}{" "}
              ·{" "}
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(info.fetchedAt))}
            </span>
          </div>
        )}
        {info?.truncated && <p className="lm-help">{c.truncated}</p>}
        <textarea
          className="lm-source-text"
          aria-label={c.source}
          placeholder={c.paste}
          maxLength={50000}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setInfo({ kind: "manual", fetchedAt: new Date().toISOString() });
            setNotice("");
          }}
        />
        <div className="lm-source-editor-actions">
          <div>
            <p className="lm-help">{c.fallback}</p>
            <button
              className="lm-button"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={16} />
              {c.captions}
            </button>
            <input
              hidden
              type="file"
              accept=".vtt,.srt"
              ref={fileInput}
              onChange={(event) => {
                void importCaptions(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </div>
          <button
            className="lm-button primary"
            disabled={busy || !draft.trim() || draft === item.text}
            onClick={() => {
              update({
                ...latest.current,
                text: draft,
                sourceInfo: info || {
                  kind: "manual",
                  fetchedAt: new Date().toISOString(),
                },
              });
              setNotice(c.saved);
            }}
          >
            {item.text ? c.replace : c.save}
            <Check size={16} />
          </button>
        </div>
        {error && (
          <p className="lm-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="lm-feedback" role="status">
            {notice}
          </p>
        )}
      </div>
    </section>
  );
}
export function LearningView({
  item,
  t,
  locale,
  spaces,
  update: persist,
  close,
  onDelete,
  onAI,
  onActivity,
  initialTab = "studio",
  initialPrompt,
}: {
  item: LearningItem;
  initialTab?: "studio" | "chat" | "source";
  initialPrompt?: string;
  t: Messages;
  locale: Locale;
  spaces: Space[];
  update: (i: LearningItem) => void;
  close: () => void;
  onDelete: () => void;
  onAI: () => void;
  onActivity: (
    kind: "read" | "chat" | "summary" | "notes" | "quiz",
    itemId: string,
  ) => void;
}) {
  const [tab, setTab] = useState<string>(initialTab),
    [blobUrl, setBlobUrl] = useState(""),
    [focus, setFocus] = useState(false);
  const [aiTask, setAiTask] = useState<AITask>("summary");
  const draft = useDraft(item.title);
  const [sourceLocation, setSourceLocation] = useState<SourceReference | null>(
    null,
  );
  const [indexedLocation, setIndexedLocation] =
    useState<SourceReference | null>(null);
  const sourceLocationRef = useRef<HTMLElement>(null);
  function openSource(reference?: SourceReference) {
    if (reference?.rag) {
      setIndexedLocation(reference);
      return;
    }
    const valid =
      reference &&
      validateReferences([reference], item.text, item.sourceEvidence)[0];
    setSourceLocation(valid || null);
    setTab("source");
  }
  useEffect(() => {
    if (tab !== "source" || !sourceLocation) return;
    const target = sourceLocationRef.current;
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "center", behavior: "instant" });
    const text = target.parentElement?.querySelector<HTMLTextAreaElement>(
      "textarea.lm-source-text",
    );
    if (
      text &&
      text.value.slice(sourceLocation.start, sourceLocation.end) ===
        sourceLocation.quote
    )
      text.setSelectionRange(sourceLocation.start, sourceLocation.end);
  }, [tab, sourceLocation]);
  const [reader, setReader] = useState<ReaderPreferences>(
      defaultReaderPreferences,
    ),
    [readerStorage, setReaderStorage] = useState(true);
  const sc = studyV3Copy[locale],
    tabListRef = useRef<HTMLDivElement>(null),
    tabId = useId();
  const linkDraft = useRef({ text: item.text, info: item.sourceInfo });
  const studioDrafts = useRef<StudioDrafts | undefined>(undefined);
  const flashcardDrafts = useRef<FlashcardDrafts | undefined>(undefined),
    quizDrafts = useRef<QuizDrafts | undefined>(undefined);
  const aiDrafts = useRef<Record<string, { question: string; goal: string }>>(
    {},
  );
  const studioBaseScript = useRef<string | undefined>(undefined);
  function syncDraftFlags() {
    const cards = flashcardDrafts.current,
      quiz = quizDrafts.current,
      studio = studioDrafts.current;
    const dirty =
      (item.kind === "link" &&
        (linkDraft.current.text !== item.text ||
          JSON.stringify(linkDraft.current.info) !==
            JSON.stringify(item.sourceInfo))) ||
      !!(cards?.adding && (cards.front || cards.back)) ||
      !!(
        quiz?.adding &&
        (quiz.prompt || quiz.options.some(Boolean) || quiz.explanation)
      ) ||
      !!(quiz?.active && !quiz.finished) ||
      !!(
        studio?.plan &&
        studio.plan !== studio.savedPlan &&
        !item.notes.includes(studio.plan)
      ) ||
      !!(
        studio &&
        studioBaseScript.current !== undefined &&
        studio.script !== studioBaseScript.current
      ) ||
      Object.values(aiDrafts.current).some(
        (entry) => !!(entry.question || entry.goal),
      );
    if (dirty) draft.markDirty();
    else draft.markClean();
  }
  useEffect(() => {
    syncDraftFlags();
  }, [item.text, item.notes]);
  useEffect(() => {
    try {
      setReader(
        parseReaderPreferences(localStorage.getItem(readerPreferencesKey)),
      );
    } catch {
      setReaderStorage(false);
    }
    const sync = (event: StorageEvent) => {
      if (event.key === readerPreferencesKey)
        setReader(parseReaderPreferences(event.newValue));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function changeReader(next: ReaderPreferences) {
    setReader(next);
    try {
      localStorage.setItem(readerPreferencesKey, JSON.stringify(next));
      setReaderStorage(true);
    } catch {
      setReaderStorage(false);
    }
  }
  function update(next: LearningItem) {
    persist(next);
    if (next.notes !== item.notes && next.notes.trim().length >= 10)
      onActivity("notes", item.id);
    if (next.attempts.length > item.attempts.length)
      onActivity("quiz", item.id);
    if ((next.artifacts?.length || 0) > (item.artifacts?.length || 0))
      onActivity("summary", item.id);
  }
  const activityRef = useRef(onActivity);
  activityRef.current = onActivity;
  const readable =
    (tab === "source" && !!(item.text || item.blob || item.url)) ||
    (tab === "summary" && !!item.artifacts?.length) ||
    (tab === "notes" && item.notes.trim().length >= 10) ||
    (tab === "cards" && item.cards.length > 0);
  useEffect(() => {
    if (!readable) return;
    let visibleSeconds = 0;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      visibleSeconds++;
      if (visibleSeconds >= 20) {
        activityRef.current("read", item.id);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [item.id, tab, readable]);
  const latestSummary = item.artifacts
    ?.filter((a) => a.kind === "summary")
    .at(-1);
  const e = enhancements[locale];
  useEffect(() => {
    document.documentElement.classList.toggle("lm-focus-reading", focus);
    const exit = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocus(false);
    };
    document.addEventListener("keydown", exit);
    return () => {
      document.documentElement.classList.remove("lm-focus-reading");
      document.removeEventListener("keydown", exit);
    };
  }, [focus]);
  useEffect(() => {
    if (!item.blob) {
      setBlobUrl("");
      return;
    }
    const u = URL.createObjectURL(item.blob);
    setBlobUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [item.blob]);
  const tabs = [
    ["studio", Sparkles, studioCopy[locale].studio],
    ["source", BookOpen, t.source],
    ["notes", StickyNote, t.notes],
    ["cards", Layers, t.cards],
    ["quiz", ClipboardCheck, t.quiz],
    ["chat", MessageCircle, t.chat],
  ] as const;
  const activeTab = tab === "summary" ? "studio" : tab;
  return (
    <div
      className="lm-learning lsv-learning"
      style={
        {
          "--lsv-reader-size": `${reader.fontSize}px`,
          "--lsv-reader-line": reader.lineHeight,
        } as CSSProperties
      }
    >
      <div className="lm-learning-top">
        <button className="lm-button plain" onClick={close}>
          <ArrowLeft size={17} />
          {t.backLibrary}
        </button>
        <div className="lm-row">
          <button
            className="lm-button lm-focus-toggle"
            aria-pressed={focus}
            onClick={() => setFocus(!focus)}
          >
            {focus ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span>{focus ? e.exitFocus : e.focus}</span>
          </button>
          <button
            className={`lm-icon ${item.favorite ? "is-favorite" : ""}`}
            aria-label={item.favorite ? t.removeFavorite : t.addFavorite}
            onClick={() => update({ ...item, favorite: !item.favorite })}
          >
            <Star size={18} />
          </button>
          <button
            className="lm-icon danger"
            aria-label={t.delete}
            onClick={onDelete}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      <div className="lm-document-title">
        <span className="lm-kind-mark">
          <FileText size={24} />
        </span>
        <input
          aria-label={t.title}
          maxLength={160}
          value={item.title}
          onChange={(e) => update({ ...item, title: e.target.value })}
        />
      </div>
      <div className="lm-document-meta">
        <span>
          {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
            new Date(item.createdAt),
          )}
        </span>
        <span>·</span>
        <span>{t.local}</span>
        <select
          aria-label={t.move}
          value={item.spaceId}
          onChange={(e) => update({ ...item, spaceId: e.target.value })}
        >
          <option value="">{t.noSpace}</option>
          {spaces.map((s) => (
            <option value={s.id} key={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <details className="lsv-reader-tools">
        <summary>
          <span>
            <Type size={16} />
            {sc.comfort}
          </span>
          <span className="lsv-reader-current">
            {reader.fontSize}px
            <ChevronDown size={15} />
          </span>
        </summary>
        <div className="lsv-reader-settings">
          <div role="group" aria-label={sc.size}>
            <strong>{sc.size}</strong>
            <div className="lsv-segmented">
              {([16, 18, 20] as const).map((size) => (
                <button
                  type="button"
                  key={size}
                  aria-label={`${sc.size}: ${size}px`}
                  aria-pressed={reader.fontSize === size}
                  onClick={() => changeReader({ ...reader, fontSize: size })}
                >
                  <span aria-hidden="true" style={{ fontSize: size }}>
                    Aa
                  </span>
                  <span>{size}</span>
                </button>
              ))}
            </div>
          </div>
          <div role="group" aria-label={sc.spacing}>
            <strong>{sc.spacing}</strong>
            <div className="lsv-segmented">
              {([1.6, 1.9, 2.2] as const).map((spacing, i) => (
                <button
                  type="button"
                  key={spacing}
                  aria-pressed={reader.lineHeight === spacing}
                  onClick={() =>
                    changeReader({ ...reader, lineHeight: spacing })
                  }
                >
                  {[sc.compact, sc.relaxed, sc.spacious][i]}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="lm-button"
            onClick={() => changeReader({ ...defaultReaderPreferences })}
          >
            {sc.reset}
          </button>
        </div>
        <p className="lsv-reader-preview">{sc.readerPreview}</p>
        <p className="lm-help" role="status">
          {readerStorage ? sc.typographySaved : sc.typographySession}
        </p>
      </details>
      <div
        className="lm-tabs"
        role="tablist"
        aria-label={item.title}
        ref={tabListRef}
        onKeyDown={(event) => {
          if (
            !event.target ||
            !(event.target instanceof HTMLElement) ||
            event.target.getAttribute("role") !== "tab" ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey
          )
            return;
          const current = tabs.findIndex(([id]) => id === activeTab);
          const next =
            event.key === "ArrowRight"
              ? (current + 1) % tabs.length
              : event.key === "ArrowLeft"
                ? (current - 1 + tabs.length) % tabs.length
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : -1;
          if (next < 0) return;
          event.preventDefault();
          const id = tabs[next][0];
          setTab(id);
          if (id === "chat") setAiTask(id);
          tabListRef.current
            ?.querySelectorAll<HTMLButtonElement>("[role='tab']")
            [next]?.focus();
        }}
      >
        {tabs.map(([id, Icon, label]) => (
          <button
            key={id}
            role="tab"
            id={`${tabId}-${id}`}
            aria-selected={activeTab === id}
            aria-controls={`${tabId}-panel`}
            tabIndex={activeTab === id ? 0 : -1}
            onClick={() => {
              setTab(id);
              if (id === "chat") setAiTask(id);
            }}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>
      <div
        key={tab}
        className="lm-document-panel"
        role="tabpanel"
        id={`${tabId}-panel`}
        aria-labelledby={`${tabId}-${activeTab}`}
      >
        {tab === "studio" && (
          <StudyStudio
            item={item}
            locale={locale}
            update={update}
            drafts={studioDrafts.current}
            onDraft={(value) => {
              studioDrafts.current = value;
              studioBaseScript.current ??= value.script;
              syncDraftFlags();
            }}
            onOpenNotes={() => setTab("notes")}
            onOpenSource={() => setTab("source")}
            summaryText={
              latestSummary ? summaryMarkdown(latestSummary.summary) : undefined
            }
            onTask={(task) => {
              setAiTask(task);
              setTab(task === "chat" ? "chat" : "summary");
            }}
          />
        )}
        {tab === "source" && (
          <>
            {sourceLocation && (
              <section
                ref={sourceLocationRef}
                tabIndex={-1}
                className="lv7-source-location"
                aria-label={
                  locale === "vi" ? "Vị trí trích dẫn" : "Cited location"
                }
              >
                <strong>
                  {item.title} ·{" "}
                  {sourceLocation.page
                    ? `${t.source} · ${sourceLocation.page}`
                    : sourceLocation.slide
                      ? `Slide ${sourceLocation.slide}`
                      : `§ ${sourceLocation.paragraph}`}
                  {sourceLocation.seconds !== undefined
                    ? ` · ${formatTime(sourceLocation.seconds)}`
                    : ""}
                </strong>
                <blockquote>{sourceLocation.quote}</blockquote>
                <button
                  className="lm-button"
                  onClick={() => setSourceLocation(null)}
                >
                  {t.close}
                </button>
              </section>
            )}
            <div className="lm-source-head">
              <span>{t.source}</span>
              {blobUrl && (
                <a
                  className="lm-button"
                  href={blobUrl}
                  download={item.fileName || item.title}
                >
                  <Download size={15} />
                  {t.download}
                </a>
              )}
            </div>
            <DocumentExtraction item={item} locale={locale} update={update} />
            {item.kind === "text" ? (
              <textarea
                className="lm-source-text"
                aria-label={t.sourceText}
                maxLength={200000}
                value={item.text}
                onChange={(e) =>
                  update({
                    ...item,
                    text: e.target.value,
                    sourceEvidence: undefined,
                  })
                }
              />
            ) : item.kind === "link" ? (
              <LinkSource
                key={item.id}
                item={item}
                locale={locale}
                update={update}
                draftState={linkDraft.current}
                onDraft={(value) => {
                  linkDraft.current = value;
                  syncDraftFlags();
                }}
                learn={() => {
                  setAiTask("summary");
                  setTab("summary");
                }}
              />
            ) : blobUrl ? (
              <>
                {item.kind === "pdf" ? (
                  <iframe
                    title={item.title}
                    className="lm-pdf"
                    src={`${blobUrl}${sourceLocation?.page ? `#page=${sourceLocation.page}` : ""}`}
                  />
                ) : item.kind === "image" ? (
                  <img
                    className="lm-source-image"
                    src={blobUrl}
                    alt={item.title}
                  />
                ) : item.kind === "audio" ? (
                  <div className="lm-audio-player">
                    <div className="lm-sound-bars" aria-hidden="true">
                      {[20, 45, 70, 35, 85, 55, 90, 50, 30, 65, 40, 20].map(
                        (h, i) => (
                          <i key={i} style={{ height: h }} />
                        ),
                      )}
                    </div>
                    <audio controls src={blobUrl} />
                  </div>
                ) : (
                  <video controls src={blobUrl} />
                )}
                <p className="lm-help">{t.fileOnly}</p>
                {item.kind === "pdf" && item.text && (
                  <textarea
                    className="lm-source-text"
                    aria-label={t.sourceText}
                    maxLength={200000}
                    value={item.text}
                    onChange={(e) =>
                      update({
                        ...item,
                        text: e.target.value,
                        sourceEvidence: undefined,
                      })
                    }
                  />
                )}
              </>
            ) : (
              <div className="lm-empty">
                <p>{t.missingFile}</p>
              </div>
            )}
          </>
        )}
        {tab === "notes" && (
          <>
            <div className="lm-note-tools">
              <button
                className="lm-button"
                title={e.templateHint}
                disabled={item.notes.length + e.template.length + 2 > 200000}
                onClick={() =>
                  update({
                    ...item,
                    notes: [item.notes, e.template]
                      .filter(Boolean)
                      .join("\n\n"),
                  })
                }
              >
                <StickyNote size={16} />
                {e.cornell}
              </button>
              <button
                className="lm-button"
                disabled={!item.notes.trim()}
                onClick={() =>
                  downloadText(
                    item.title,
                    "md",
                    `# ${item.title}\n\n${item.notes}`,
                  )
                }
              >
                <Download size={16} />
                {e.exportNotes}
              </button>
            </div>
            <p className="lm-help lm-template-hint">{e.templateHint}</p>
            <div className="lm-source-head">
              <span>{t.notes}</span>
              <span>{t.local}</span>
            </div>
            <textarea
              className="lm-notes"
              aria-label={t.notes}
              placeholder={t.notesPlaceholder}
              maxLength={200000}
              value={item.notes}
              onChange={(e) => update({ ...item, notes: e.target.value })}
            />
          </>
        )}
        {tab === "cards" && (
          <>
            <div className="lm-note-tools">
              <button
                className="lm-button"
                disabled={!item.cards.length}
                onClick={() =>
                  downloadText(item.title, "csv", cardsCSV(item.cards))
                }
              >
                <Download size={16} />
                {e.exportCards}
              </button>
            </div>
            <Flashcards
              onOpenSource={openSource}
              item={item}
              t={t}
              locale={locale}
              update={update}
              drafts={flashcardDrafts.current}
              onDraft={(value) => {
                flashcardDrafts.current = value;
                syncDraftFlags();
              }}
            />
          </>
        )}{" "}
        {tab === "quiz" && (
          <Quiz
            onOpenSource={openSource}
            item={item}
            t={t}
            locale={locale}
            update={update}
            drafts={quizDrafts.current}
            onDraft={(value) => {
              quizDrafts.current = value;
              syncDraftFlags();
            }}
          />
        )}{" "}
        {(tab === "summary" || tab === "chat") && (
          <>
            {tab === "summary" && (
              <button
                className="lm-button plain"
                onClick={() => setTab("studio")}
              >
                <ArrowLeft size={16} />
                {studioCopy[locale].studio}
              </button>
            )}
            <AIPanel
              contextual
              initialPrompt={tab === "chat" ? initialPrompt : undefined}
              drafts={aiDrafts.current[tab === "chat" ? "chat" : aiTask]}
              onDraft={(value) => {
                aiDrafts.current[tab === "chat" ? "chat" : aiTask] = value;
                syncDraftFlags();
              }}
              key={`${tab}:${aiTask}`}
              item={item}
              t={t}
              locale={locale}
              initialTask={tab === "chat" ? "chat" : aiTask}
              update={update}
              onActivity={(kind) => onActivity(kind, item.id)}
              onOpenSource={openSource}
            />
          </>
        )}
      </div>
      {indexedLocation && (
        <Dialog
          title={indexedLocation.rag?.title || t.source}
          label={t.close}
          close={() => setIndexedLocation(null)}
        >
          <p className="lm-help">
            {locale === "vi"
              ? "Bản trích từ chỉ mục riêng đã dùng cho câu trả lời; không phải toàn bộ tài liệu gốc."
              : "Excerpt from the private retrieval snapshot used for this answer; not the entire original material."}
          </p>
          <strong>
            {indexedLocation.page
              ? `Page ${indexedLocation.page}`
              : indexedLocation.slide
                ? `Slide ${indexedLocation.slide}`
                : `§ ${indexedLocation.paragraph}`}
            {indexedLocation.seconds !== undefined
              ? ` · ${formatTime(indexedLocation.seconds)}`
              : ""}
          </strong>
          <blockquote>{indexedLocation.quote}</blockquote>
          <p className="lm-help">
            {locale === "vi"
              ? "Đoạn trích khớp bản đã tìm, chưa chứng minh toàn bộ câu trả lời đúng. Tài liệu gốc có thể đã thay đổi."
              : "The excerpt matches the retrieved snapshot; it does not prove the full answer correct. The original may have changed."}
          </p>
        </Dialog>
      )}
    </div>
  );
}
