import { LibraryState, emptyLibrary, LearningItem } from "./types";
import { validateSummary, type StudyArtifact } from "../ai/summary";
import { validateCoverage } from "../ai/full-summary";
import { restoreReferences } from "../ai/grounding";
const DB = "lumio-local-library-v2";
export type LibrarySnapshot = { data: LibraryState; revision: number };
export class LibraryConflictError extends Error {
  constructor() {
    super("LIBRARY_CONFLICT");
    this.name = "LibraryConflictError";
  }
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Upgrading also prevents an already loaded v1 client from doing blind writes.
    const request = indexedDB.open(DB, 2);
    let blocked = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("libraries"))
        request.result.createObjectStore("libraries");
      if (!request.result.objectStoreNames.contains("revisions"))
        request.result.createObjectStore("revisions");
    };
    request.onblocked = () => {
      blocked = true;
      reject(new Error("STORAGE_UPGRADE_BLOCKED"));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) {
        db.close();
        return;
      }
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}
export async function loadLibrary(account: string): Promise<LibraryState> {
  return (await loadLibrarySnapshot(account)).data;
}
export async function loadLibrarySnapshot(
  account: string,
): Promise<LibrarySnapshot> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["libraries", "revisions"], "readonly");
    const req = tx.objectStore("libraries").get(account);
    const revision = tx.objectStore("revisions").get(account);
    tx.oncomplete = () => {
      db.close();
      if (
        revision.result !== undefined &&
        (!Number.isSafeInteger(revision.result) || revision.result < 0)
      ) {
        reject(new Error("INVALID_LIBRARY_REVISION"));
        return;
      }
      resolve({
        data: req.result || structuredClone(emptyLibrary),
        revision: revision.result ?? 0,
      });
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("STORAGE_ABORT"));
    };
  });
}
export async function saveLibrary(
  account: string,
  data: LibraryState,
  expectedRevision: number,
): Promise<number> {
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 0 ||
    expectedRevision >= Number.MAX_SAFE_INTEGER
  )
    throw new Error("INVALID_LIBRARY_REVISION");
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["libraries", "revisions"], "readwrite");
    const revisions = tx.objectStore("revisions");
    const check = revisions.get(account);
    let conflict = false;
    check.onsuccess = () => {
      if ((check.result ?? 0) !== expectedRevision) {
        conflict = true;
        tx.abort();
        return;
      }
      // Check and write share one transaction: concurrent tabs cannot both pass.
      tx.objectStore("libraries").put(data, account);
      revisions.put(expectedRevision + 1, account);
    };
    tx.oncomplete = () => {
      db.close();
      resolve(expectedRevision + 1);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(
        conflict
          ? new LibraryConflictError()
          : tx.error || new Error("STORAGE_ABORT"),
      );
    };
  });
}
export function exportLibrary(data: LibraryState): string {
  return JSON.stringify(
    {
      ...data,
      items: data.items.map(({ blob, ...item }) => ({
        ...item,
        attachmentOmitted: !!blob,
      })),
    },
    null,
    2,
  );
}
// Import deliberately strips unknown fields and binary payloads. This is a local backup, not executable content.
export function importLibrary(raw: string): LibraryState {
  const value: unknown = JSON.parse(raw);
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("items" in value) ||
    !Array.isArray(value.items) ||
    !("spaces" in value) ||
    !Array.isArray(value.spaces) ||
    value.items.length > 1000 ||
    value.spaces.length > 100
  )
    throw new Error("INVALID_BACKUP");
  const string = (v: unknown, max = 200000) => {
    if (typeof v !== "string" || v.length > max)
      throw new Error("INVALID_BACKUP");
    return v;
  };
  const spaces = value.spaces.map((s) => ({
    id: string(s.id, 100),
    name: string(s.name, 100),
    color: ["blue", "green", "orange", "pink"].includes(s.color)
      ? s.color
      : "blue",
  }));
  const items: LearningItem[] = value.items.map((i) => {
    if (
      !["text", "pdf", "image", "audio", "video", "link"].includes(i.kind) ||
      !Array.isArray(i.cards) ||
      !Array.isArray(i.questions) ||
      !Array.isArray(i.attempts)
    )
      throw new Error("INVALID_BACKUP");
    for (const d of [i.createdAt, i.updatedAt])
      if (!Number.isFinite(Date.parse(d))) throw new Error("INVALID_BACKUP");
    const url = i.url ? new URL(string(i.url, 4000)) : undefined;
    if (
      url &&
      (!["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password)
    )
      throw new Error("INVALID_BACKUP");
    let sourceInfo: LearningItem["sourceInfo"];
    if (i.sourceInfo) {
      const s = i.sourceInfo;
      if (
        !["website", "captions", "manual"].includes(s.kind) ||
        !Number.isFinite(Date.parse(s.fetchedAt))
      )
        throw new Error("INVALID_BACKUP");
      const sourceUrl = s.url ? new URL(string(s.url, 4000)) : undefined;
      if (
        sourceUrl &&
        (!["https:", "http:"].includes(sourceUrl.protocol) ||
          sourceUrl.username ||
          sourceUrl.password)
      )
        throw new Error("INVALID_BACKUP");
      sourceInfo = {
        kind: s.kind,
        fetchedAt: s.fetchedAt,
        url: sourceUrl?.href,
        title: s.title ? string(s.title, 160) : undefined,
        filename: s.filename ? string(s.filename, 250) : undefined,
        truncated: s.truncated === true,
      };
    }
    let artifacts: StudyArtifact[] | undefined;
    if (i.artifacts !== undefined) {
      if (!Array.isArray(i.artifacts) || i.artifacts.length > 20)
        throw new Error("INVALID_BACKUP");
      artifacts = i.artifacts.map((a: Record<string, unknown>) => {
        if (
          !a ||
          a.kind !== "summary" ||
          !Number.isFinite(Date.parse(String(a.createdAt)))
        )
          throw new Error("INVALID_BACKUP");
        const s = a.source as Record<string, unknown>;
        if (
          !s ||
          !["text", "website", "captions", "youtube", "media"].includes(
            String(s.kind),
          ) ||
          typeof s.contentLength !== "number" ||
          !Number.isInteger(s.contentLength) ||
          s.contentLength < 0 ||
          s.contentLength > 200000
        )
          throw new Error("INVALID_BACKUP");
        const link = s.url ? new URL(string(s.url, 4000)) : undefined;
        if (
          link &&
          (!["http:", "https:"].includes(link.protocol) ||
            link.username ||
            link.password)
        )
          throw new Error("INVALID_BACKUP");
        let range: StudyArtifact["source"]["range"];
        const coverage =
          s.coverage === undefined ? undefined : validateCoverage(s.coverage);
        if (coverage && s.range) throw new Error("INVALID_BACKUP");
        if (
          coverage?.method === "segmented-video" &&
          !["youtube", "media"].includes(String(s.kind))
        )
          throw new Error("INVALID_BACKUP");
        if (coverage?.method === "full-media" && s.kind !== "media")
          throw new Error("INVALID_BACKUP");
        if (
          coverage?.method === "full-text" &&
          !["text", "website", "captions"].includes(String(s.kind))
        )
          throw new Error("INVALID_BACKUP");
        if (s.range) {
          const r = s.range as Record<string, unknown>;
          if (
            typeof r.startSeconds !== "number" ||
            typeof r.endSeconds !== "number" ||
            !Number.isInteger(r.startSeconds) ||
            !Number.isInteger(r.endSeconds) ||
            r.startSeconds < 0 ||
            r.endSeconds <= r.startSeconds ||
            r.endSeconds > 172800 ||
            r.endSeconds - r.startSeconds > 1800 ||
            !["youtube", "media"].includes(String(s.kind))
          )
            throw new Error("INVALID_BACKUP");
          range = { startSeconds: r.startSeconds, endSeconds: r.endSeconds };
        }
        let frames: StudyArtifact["frames"];
        if (a.frames !== undefined) {
          if (!Array.isArray(a.frames) || a.frames.length > 3)
            throw new Error("INVALID_BACKUP");
          frames = a.frames.map((f) => {
            if (
              !f ||
              typeof f.url !== "string" ||
              f.url.length > 250000 ||
              !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(f.url) ||
              typeof f.seconds !== "number" ||
              !Number.isFinite(f.seconds) ||
              f.seconds < 0 ||
              f.seconds > 172800 ||
              (coverage?.method === "segmented-video" &&
                f.seconds >= coverage.durationSeconds!) ||
              !Number.isFinite(Date.parse(f.createdAt))
            )
              throw new Error("INVALID_BACKUP");
            return { url: f.url, seconds: f.seconds, createdAt: f.createdAt };
          });
        }
        return {
          id: string(a.id, 100),
          kind: "summary",
          createdAt: String(a.createdAt),
          summary: validateSummary(a.summary, {
            source: string(i.text),
            restore: true,
            range:
              coverage?.method === "segmented-video"
                ? { startSeconds: 0, endSeconds: coverage.durationSeconds! }
                : range,
            aggregate: coverage?.method === "segmented-video",
          }),
          frames,
          source: {
            kind: s.kind as StudyArtifact["source"]["kind"],
            title: string(s.title, 200),
            url: link?.href,
            contentLength: s.contentLength,
            range,
            coverage,
          },
        };
      });
    }
    return {
      id: string(i.id, 100),
      title: string(i.title, 160),
      kind: i.kind,
      spaceId: spaces.some((s) => s.id === i.spaceId) ? i.spaceId : "",
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      text: string(i.text),
      notes: string(i.notes),
      favorite: i.favorite === true,
      url: url?.href,
      sourceInfo,
      artifacts,
      fileName: i.fileName ? string(i.fileName, 250) : undefined,
      cards: i.cards
        .slice(0, 500)
        .map(
          (c: {
            id: unknown;
            front: unknown;
            back: unknown;
            references?: unknown;
          }) => ({
            id: string(c.id, 100),
            front: string(c.front, 2000),
            back: string(c.back, 5000),
            ...(restoreReferences(c.references, i.text).length
              ? { references: restoreReferences(c.references, i.text) }
              : {}),
          }),
        ),
      questions: i.questions
        .slice(0, 100)
        .map(
          (q: {
            id: unknown;
            prompt: unknown;
            options: unknown;
            correct: unknown;
            explanation: unknown;
            difficulty?: unknown;
            topic?: unknown;
            references?: unknown;
          }) => {
            if (
              !Array.isArray(q.options) ||
              q.options.length !== 4 ||
              !Number.isInteger(q.correct) ||
              Number(q.correct) < 0 ||
              Number(q.correct) > 3
            )
              throw new Error("INVALID_BACKUP");
            return {
              id: string(q.id, 100),
              prompt: string(q.prompt, 2000),
              options: q.options.map((o) => string(o, 1000)),
              correct: Number(q.correct),
              explanation: string(q.explanation, 5000),
              ...(["beginner", "intermediate", "advanced"].includes(
                String(q.difficulty),
              )
                ? {
                    difficulty: q.difficulty as
                      "beginner" | "intermediate" | "advanced",
                  }
                : {}),
              ...(q.topic === undefined
                ? {}
                : { topic: string(q.topic, 120).trim() }),
              ...(restoreReferences(q.references, i.text).length
                ? { references: restoreReferences(q.references, i.text) }
                : {}),
            };
          },
        ),
      attempts: i.attempts
        .slice(-1000)
        .map(
          (a: {
            date: unknown;
            score: unknown;
            total: unknown;
            answers?: unknown;
          }) => {
            if (
              !Number.isInteger(a.score) ||
              !Number.isInteger(a.total) ||
              Number(a.score) < 0 ||
              Number(a.score) > Number(a.total) ||
              Number(a.total) < 1 ||
              !Number.isFinite(Date.parse(String(a.date)))
            )
              throw new Error("INVALID_BACKUP");
            let answers: LearningItem["attempts"][number]["answers"];
            if (a.answers !== undefined) {
              if (!Array.isArray(a.answers) || a.answers.length > 100)
                throw new Error("INVALID_BACKUP");
              answers = a.answers.map((answer) => {
                if (
                  !answer ||
                  typeof answer !== "object" ||
                  !Number.isInteger(answer.selected) ||
                  answer.selected < 0 ||
                  answer.selected > 3 ||
                  typeof answer.correct !== "boolean"
                )
                  throw new Error("INVALID_BACKUP");
                return {
                  questionId: string(answer.questionId, 100),
                  selected: answer.selected,
                  correct: answer.correct,
                  ...(answer.topic === undefined
                    ? {}
                    : { topic: string(answer.topic, 120).trim() }),
                };
              });
              if (
                new Set(answers.map((answer) => answer.questionId)).size !==
                answers.length
              )
                throw new Error("INVALID_BACKUP");
            }
            return {
              date: String(a.date),
              score: Number(a.score),
              total: Number(a.total),
              ...(answers ? { answers } : {}),
            };
          },
        ),
    };
  });
  if (
    new Set(items.map((i) => i.id)).size !== items.length ||
    new Set(spaces.map((s) => s.id)).size !== spaces.length
  )
    throw new Error("INVALID_BACKUP");
  return { version: 1, items, spaces };
}
