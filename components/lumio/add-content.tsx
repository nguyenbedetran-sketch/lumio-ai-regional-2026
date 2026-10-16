"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, Link, FileText } from "lucide-react";
import type { Messages } from "../../lib/lumio/i18n";
import {
  createItem,
  LearningItem,
  safeLink,
  Space,
} from "../../lib/lumio/types";
import { Recorder } from "./recorder";
export type AddMode = "upload" | "link" | "paste" | "record";
export function AddContent({
  mode,
  t,
  spaces,
  spaceId,
  onSave,
}: {
  mode: AddMode;
  t: Messages;
  spaces: Space[];
  spaceId: string;
  onSave: (items: LearningItem[]) => void;
}) {
  const [title, setTitle] = useState(""),
    [text, setText] = useState(""),
    [url, setUrl] = useState(""),
    [space, setSpace] = useState(spaceId),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const mounted = useRef(true),
    reading = useRef(false),
    generation = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  async function files(list: FileList | null) {
    if (!list?.length || reading.current) return;
    reading.current = true;
    const current = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const result: LearningItem[] = [];
      for (const file of Array.from(list)) {
        const ext = file.name.split(".").pop()?.toLowerCase();
        const kind = file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("audio/")
            ? "audio"
            : file.type.startsWith("video/")
              ? "video"
              : ext === "pdf"
                ? "pdf"
                : ["txt", "md", "docx", "pptx"].includes(ext || "")
                  ? "text"
                  : null;
        if (!kind || file.size > 30 * 1024 * 1024) throw new Error(t.fileError);
        const office = ["docx", "pptx"].includes(ext || "");
        const content = kind === "text" && !office ? await file.text() : "";
        if (content.length > 200000) throw new Error(t.fileError);
        result.push(
          createItem({
            title: file.name,
            kind,
            spaceId: space,
            fileName: file.name,
            blob: kind === "text" && !office ? undefined : file,
            text: content,
          }),
        );
      }
      if (mounted.current && current === generation.current) onSave(result);
    } catch (e) {
      if (mounted.current && current === generation.current)
        setError(e instanceof Error ? e.message : t.error);
    } finally {
      if (mounted.current && current === generation.current) {
        reading.current = false;
        setBusy(false);
      }
    }
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "link") {
      try {
        const clean = safeLink(url);
        onSave([
          createItem({
            title: title.trim() || new URL(clean).hostname,
            kind: "link",
            url: clean,
            spaceId: space,
          }),
        ]);
      } catch {
        setError(t.invalidUrl);
      }
    } else if (text.trim()) {
      onSave([
        createItem({
          title: title.trim() || text.trim().slice(0, 70),
          kind: "text",
          text,
          spaceId: space,
        }),
      ]);
    }
  }
  return (
    <>
      <label className="lm-field">
        {t.move}
        <select value={space} onChange={(e) => setSpace(e.target.value)}>
          <option value="">{t.noSpace}</option>
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {mode === "upload" ? (
        <div
          className="lm-upload"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy) void files(e.dataTransfer.files);
          }}
        >
          <Upload size={35} />
          <h3>{t.drop}</h3>
          <p>{t.fileHint} · DOCX / PPTX</p>
          <label className="lm-button primary">
            {busy ? t.loading : t.choose}
            <input
              aria-label={t.choose}
              disabled={busy}
              type="file"
              multiple
              accept=".pdf,.docx,.pptx,.txt,.md,image/*,audio/*,video/*"
              onChange={(e) => void files(e.target.files)}
            />
          </label>
        </div>
      ) : mode === "record" ? (
        <Recorder
          t={t}
          onSave={(blob) =>
            onSave([
              createItem({
                title: t.recordTitle,
                kind: "audio",
                blob,
                spaceId: space,
                fileName: `recording.${blob.type.includes("mp4") ? "m4a" : "webm"}`,
              }),
            ])
          }
        />
      ) : (
        <form onSubmit={submit}>
          <label className="lm-field">
            {t.title}
            <input
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.title}
            />
          </label>
          {mode === "link" ? (
            <>
              <label className="lm-field">
                {t.url}
                <input
                  type="url"
                  required
                  value={url}
                  maxLength={4000}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…"
                />
              </label>
              <p className="lm-help">{t.urlHint}</p>
            </>
          ) : (
            <label className="lm-field">
              {t.content}
              <textarea
                required
                rows={9}
                maxLength={200000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t.notesPlaceholder}
              />
            </label>
          )}
          <button className="lm-button primary" type="submit">
            {mode === "link" ? <Link size={17} /> : <FileText size={17} />}{" "}
            {t.save}
          </button>
        </form>
      )}
      {error && (
        <p className="lm-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
