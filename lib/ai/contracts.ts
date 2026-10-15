import { youtubeURL } from "../ingestion/youtube";
import { validateSummary, type StudySummary } from "./summary";
import { MATH_STYLES, type MathStyle } from "./math-style";
import type {
  TutorContext,
  TutorReply,
  TutorState,
  MathVerification,
} from "../tutor/types";
import {
  parseSourceEvidence,
  validateReferences,
  contentQuality,
  type SourceEvidence,
  type SourceReference,
  type ContentQuality,
} from "./grounding";
export type AITask = "chat" | "summary" | "cards" | "quiz";
export type TutorMode = "quick" | "think" | "deep" | "tutor";
export type AIProviderName = "openai" | "gemini" | "xai";
export type AIInput = {
  task: AITask;
  question: string;
  source: string;
  sourceEvidence?: SourceEvidence;
  language: string;
  mode?: TutorMode;
  difficulty?: "beginner" | "intermediate" | "advanced";
  guidance?: "hints" | "full";
  presentation?: "auto" | "math";
  mathStyle?: MathStyle;
  goal?: string;
  youtubeUrl?: string;
  videoRange?: { startSeconds: number; endSeconds: number };
  media?: { mimeType: string; data: string };
  history: { role: "user" | "assistant"; text: string }[];
  tutorSessionId?: string;
  tutorProblem?: string;
  tutorContext?: TutorContext;
};
export type AIResult = {
  provider: AIProviderName;
  model: string;
  text: string;
  tutor?: TutorState;
  verification?: MathVerification;
  /** Internal, removed by the HTTP route after an atomic tutor/credit commit. */
  tutorReply?: TutorReply;
  summary?: StudySummary;
  references?: SourceReference[];
  quality?: ContentQuality;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cachedTokens?: number;
    totalTokens?: number;
  };
  cards?: { front: string; back: string; references?: SourceReference[] }[];
  questions?: {
    prompt: string;
    options: string[];
    correct: number;
    explanation: string;
    topic?: string;
    difficulty?: "beginner" | "intermediate" | "advanced";
    references?: SourceReference[];
  }[];
};
export class AIError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AIError("INVALID_PAYLOAD");
  return value as Record<string, unknown>;
};
export function validateInput(raw: unknown): AIInput {
  const v = record(raw);
  if (!["chat", "summary", "cards", "quiz"].includes(String(v.task)))
    throw new AIError("INVALID_TASK");
  const text = (x: unknown, max: number) => {
    if (typeof x !== "string" || x.length > max)
      throw new AIError("INPUT_TOO_LONG");
    return x;
  };
  const source = text(v.source ?? "", 200000),
    question = text(v.question ?? "", 4000);
  let sourceEvidence: SourceEvidence | undefined;
  if (v.sourceEvidence !== undefined) {
    try {
      sourceEvidence = parseSourceEvidence(v.sourceEvidence, source);
    } catch {
      throw new AIError("INVALID_SOURCE_EVIDENCE");
    }
  }
  if (!["vi", "en", "zh-CN", "ja", "ko"].includes(String(v.language)))
    throw new AIError("INVALID_LANGUAGE");
  let media: AIInput["media"];
  const mode = v.mode ?? "tutor";
  const difficulty = v.difficulty ?? "intermediate";
  const guidance = v.guidance ?? "hints";
  const presentation = v.presentation ?? "auto";
  const mathStyle = v.mathStyle ?? "notebook";
  if (
    !["quick", "think", "deep", "tutor"].includes(String(mode)) ||
    !["beginner", "intermediate", "advanced"].includes(String(difficulty)) ||
    !["hints", "full"].includes(String(guidance)) ||
    !["auto", "math"].includes(String(presentation)) ||
    !MATH_STYLES.includes(mathStyle as MathStyle)
  )
    throw new AIError("INVALID_TUTOR_CONTEXT");
  const goal = text(v.goal ?? "", 500);
  const tutorProblem =
    v.tutorProblem === undefined
      ? undefined
      : text(v.tutorProblem, 4000).trim();
  const tutorSessionId =
    v.tutorSessionId === undefined ? undefined : text(v.tutorSessionId, 80);
  if (
    tutorSessionId !== undefined &&
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      tutorSessionId,
    )
  )
    throw new AIError("INVALID_TUTOR_SESSION");
  if (tutorProblem !== undefined && !tutorProblem)
    throw new AIError("EMPTY_TUTOR_PROBLEM");
  const youtubeUrl = v.youtubeUrl
    ? youtubeURL(text(v.youtubeUrl, 4000))
    : undefined;
  if (v.youtubeUrl && !youtubeUrl) throw new AIError("INVALID_VIDEO_URL");
  if (v.youtubeUrl && v.media) throw new AIError("INVALID_MEDIA");
  if (v.media) {
    const m = record(v.media);
    const mimeType = text(m.mimeType, 100),
      data = text(m.data, 8 * 1024 * 1024);
    if (
      !/^(application\/pdf|image\/(png|jpeg|webp)|audio\/(mpeg|mp3|mp4|wav|webm|ogg|flac)|video\/(mp4|webm))$/.test(
        mimeType,
      ) ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(data) ||
      !data.length
    )
      throw new AIError("INVALID_MEDIA");
    media = { mimeType, data };
  }
  if (!source.trim() && !question.trim() && !media && !youtubeUrl)
    throw new AIError("EMPTY_INPUT");
  let videoRange: AIInput["videoRange"];
  if (v.videoRange || youtubeUrl || media?.mimeType.startsWith("video/")) {
    if (!youtubeUrl && !media?.mimeType.startsWith("video/"))
      throw new AIError("INVALID_VIDEO_RANGE");
    const range = record(v.videoRange || { startSeconds: 0, endSeconds: 600 });
    const start = range.startSeconds,
      end = range.endSeconds;
    if (
      typeof start !== "number" ||
      typeof end !== "number" ||
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end <= start ||
      end > 172800 ||
      end - start > 1800
    )
      throw new AIError("INVALID_VIDEO_RANGE");
    videoRange = { startSeconds: start, endSeconds: end };
  }
  const history = Array.isArray(v.history)
    ? v.history.slice(-6).map((h) => {
        const item = record(h);
        if (item.role !== "user" && item.role !== "assistant")
          throw new AIError("INVALID_HISTORY");
        return {
          role: item.role as "user" | "assistant",
          text: text(item.text, 4000),
        };
      })
    : [];
  return {
    task: v.task as AITask,
    question,
    source,
    ...(sourceEvidence ? { sourceEvidence } : {}),
    language: String(v.language),
    media,
    youtubeUrl: youtubeUrl || undefined,
    videoRange,
    mode: mode as TutorMode,
    difficulty: difficulty as AIInput["difficulty"],
    guidance: guidance as AIInput["guidance"],
    presentation: presentation as AIInput["presentation"],
    mathStyle: mathStyle as MathStyle,
    goal,
    history,
    tutorSessionId,
    tutorProblem,
  };
}
export function chooseProvider(input: AIInput): "openai" | "gemini" {
  return input.media || input.youtubeUrl
    ? "gemini"
    : input.task === "summary"
      ? "gemini"
      : "openai";
}
export function validateStructured(
  task: AITask,
  text: string,
  input?: AIInput,
): Pick<AIResult, "cards" | "questions" | "summary" | "quality"> {
  if (task !== "cards" && task !== "quiz" && task !== "summary") return {};
  let value: Record<string, unknown>;
  try {
    value = record(
      JSON.parse(text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")),
    );
  } catch {
    throw new AIError("INVALID_AI_OUTPUT", 502);
  }
  if (task === "summary") {
    if (value.error === "SOURCE_UNAVAILABLE")
      throw new AIError("SOURCE_UNAVAILABLE", 422);
    try {
      const summary = validateSummary(value, {
        source: input?.source,
        range: input?.videoRange,
        evidence: input?.sourceEvidence,
        video:
          !!input?.youtubeUrl ||
          !!input?.media?.mimeType.match(/^(video|audio)\//),
      });
      return {
        summary,
        quality: contentQuality(
          summary.chapters.length,
          summary.chapters.filter((c) => c.references?.length || c.sourceQuote)
            .length,
          !!input?.source.trim(),
          !!(input?.media || input?.youtubeUrl),
        ),
      };
    } catch {
      throw new AIError("INVALID_AI_OUTPUT", 502);
    }
  }
  const str = (v: unknown, max = 5000) => {
    if (typeof v !== "string" || !v.trim() || v.length > max)
      throw new AIError("INVALID_AI_OUTPUT", 502);
    return v;
  };
  if (task === "cards") {
    if (
      !Array.isArray(value.cards) ||
      value.cards.length < 1 ||
      value.cards.length > 10
    )
      throw new AIError("INVALID_AI_OUTPUT", 502);
    const fronts = new Set<string>();
    const cards = value.cards.map((c) => {
      const row = record(c);
      const front = str(row.front, 2000).trim();
      let back = str(row.back).trim(),
        rawReferences = row.references;
      // Some models put the requested JSON references in an explicit suffix.
      // Recover data only after exact-source validation; never interpret arbitrary prose as a citation.
      if (rawReferences === undefined) {
        const suffix = back.match(/\n\s*References:\s*(\[[\s\S]*\])\s*$/i);
        if (suffix) {
          try {
            const parsed: unknown = JSON.parse(suffix[1]);
            const checked = validateReferences(
              parsed,
              input?.source || "",
              input?.sourceEvidence,
            );
            if (
              !Array.isArray(parsed) ||
              !parsed.length ||
              checked.length !== parsed.length
            )
              throw new Error();
            rawReferences = parsed;
            back = back.slice(0, suffix.index).trim();
            if (!back) throw new Error();
          } catch {
            throw new AIError("INVALID_AI_OUTPUT", 502);
          }
        }
      }
      const key = front
        .normalize("NFKC")
        .toLocaleLowerCase("vi")
        .replace(/\s+/g, " ");
      if (fronts.has(key)) throw new AIError("DUPLICATE_AI_CONTENT", 502);
      fronts.add(key);
      const references = validateReferences(
        rawReferences,
        input?.source || "",
        input?.sourceEvidence,
      );
      return { front, back, ...(references.length ? { references } : {}) };
    });
    return {
      cards,
      quality: contentQuality(
        cards.length,
        cards.filter((c) => c.references?.length).length,
        !!input?.source.trim(),
        !!(input?.media || input?.youtubeUrl),
      ),
    };
  }
  if (
    !Array.isArray(value.questions) ||
    value.questions.length < 1 ||
    value.questions.length > 10
  )
    throw new AIError("INVALID_AI_OUTPUT", 502);
  const prompts = new Set<string>();
  const optionKey = (value: string) => {
    const clean = value
      .normalize("NFKC")
      .toLocaleLowerCase("vi")
      .replace(/\p{Cf}/gu, "")
      .replace(/\s+/g, " ")
      .trim();
    const number = clean
      .replace(/\\frac\{([+-]?\d+)\}\{([+-]?\d+)\}/g, "$1/$2")
      .replace(/\\[([]|\\[)\]]|\$/g, "")
      .replace(/⁄/g, "/")
      .replace(/\s/g, "")
      .replace(",", ".");
    const fraction = number.match(/^([+-]?\d+)\/([+-]?\d+)$/);
    const numeric =
      fraction && Number(fraction[2]) !== 0
        ? Number(fraction[1]) / Number(fraction[2])
        : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)%?$/.test(number)
          ? Number(number.replace("%", "")) / (number.endsWith("%") ? 100 : 1)
          : null;
    return numeric !== null && Number.isFinite(numeric)
      ? `number:${numeric.toPrecision(12)}`
      : `text:${clean}`;
  };
  const questions = value.questions.map((q) => {
    const row = record(q);
    if (
      !Array.isArray(row.options) ||
      row.options.length !== 4 ||
      !Number.isInteger(row.correct) ||
      Number(row.correct) < 0 ||
      Number(row.correct) > 3
    )
      throw new AIError("INVALID_AI_OUTPUT", 502);
    const prompt = str(row.prompt, 2000).trim(),
      options = row.options.map((x) => str(x, 1000).trim());
    const key = prompt
      .normalize("NFKC")
      .toLocaleLowerCase("vi")
      .replace(/\s+/g, " ");
    if (prompts.has(key) || new Set(options.map(optionKey)).size !== 4)
      throw new AIError("AMBIGUOUS_AI_QUIZ", 502);
    prompts.add(key);
    if (
      row.difficulty !== undefined &&
      !["beginner", "intermediate", "advanced"].includes(String(row.difficulty))
    )
      throw new AIError("INVALID_AI_OUTPUT", 502);
    if (input && (row.difficulty === undefined || row.topic === undefined))
      throw new AIError("INVALID_AI_OUTPUT", 502);
    const references = validateReferences(
      row.references,
      input?.source || "",
      input?.sourceEvidence,
    );
    return {
      prompt,
      options,
      correct: Number(row.correct),
      explanation: str(row.explanation),
      ...(row.topic === undefined ? {} : { topic: str(row.topic, 120).trim() }),
      ...(row.difficulty === undefined
        ? {}
        : {
            difficulty: row.difficulty as
              "beginner" | "intermediate" | "advanced",
          }),
      ...(references.length ? { references } : {}),
    };
  });
  return {
    questions,
    quality: contentQuality(
      questions.length,
      questions.filter((q) => q.references?.length).length,
      !!input?.source.trim(),
      !!(input?.media || input?.youtubeUrl),
    ),
  };
}
