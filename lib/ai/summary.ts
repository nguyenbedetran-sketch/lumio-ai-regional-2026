import {
  validateReferences,
  type SourceEvidence,
  type SourceReference,
} from "./grounding";
export type SummaryChapter = {
  title: string;
  summary: string;
  bullets: string[];
  startSeconds?: number;
  timestampKind: "none" | "source" | "approximate";
  sourceQuote?: string;
  references?: SourceReference[];
};
export type StudySummary = {
  title: string;
  overview: string;
  keyPoints: string[];
  chapters: SummaryChapter[];
  mindMap: {
    nodes: {
      id: string;
      label: string;
      detail: string;
      chapterIndex?: number;
    }[];
    edges: { source: string; target: string; label?: string }[];
  };
};
export type StudyArtifact = {
  id: string;
  kind: "summary";
  createdAt: string;
  summary: StudySummary;
  frames?: { url: string; seconds: number; createdAt: string }[];
  source: {
    kind: "text" | "website" | "captions" | "youtube" | "media";
    title: string;
    url?: string;
    contentLength: number;
    range?: { startSeconds: number; endSeconds: number };
    coverage?: SummaryCoverage;
  };
};
export type SummaryCoverage = {
  scope: "whole";
  method: "segmented-video" | "full-media" | "full-text";
  durationSeconds?: number;
  durationBasis?: "metadata" | "declared";
  parts?: { startSeconds: number; endSeconds: number }[];
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_SUMMARY");
  return value as Record<string, unknown>;
}
function string(value: unknown, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error("INVALID_SUMMARY");
  return value.trim();
}
function strings(value: unknown, maxCount: number, maxLength: number) {
  if (!Array.isArray(value) || value.length > maxCount)
    throw new Error("INVALID_SUMMARY");
  return value.map((v) => string(v, maxLength));
}
export function sourceTimes(source: string): number[] {
  return [...source.matchAll(/^\s*\[(?:(\d{1,3}):)?(\d{2}):(\d{2})\]\s+/gm)]
    .filter((m) => Number(m[2]) < 60 && Number(m[3]) < 60)
    .map((m) => Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]));
}
export function validateSummary(
  value: unknown,
  context: {
    source?: string;
    video?: boolean;
    restore?: boolean;
    aggregate?: boolean;
    evidence?: SourceEvidence;
    range?: { startSeconds: number; endSeconds: number };
  } = {},
): StudySummary {
  const v = object(value);
  if (JSON.stringify(value).length > (context.aggregate ? 5000000 : 60000))
    throw new Error("INVALID_SUMMARY");
  if (
    !Array.isArray(v.chapters) ||
    v.chapters.length < 1 ||
    v.chapters.length > (context.aggregate ? 1728 : 24)
  )
    throw new Error("INVALID_SUMMARY");
  const times = new Set(sourceTimes(context.source || ""));
  const chapters = v.chapters.map((raw) => {
    const c = object(raw),
      candidate = c.startSeconds;
    const valid =
      typeof candidate === "number" &&
      Number.isFinite(candidate) &&
      candidate >= 0 &&
      candidate <= 172800 &&
      (!context.range ||
        (candidate >= context.range.startSeconds &&
          candidate < context.range.endSeconds));
    if (context.aggregate && candidate !== undefined && !valid)
      throw new Error("INVALID_SUMMARY");
    let startSeconds: number | undefined,
      timestampKind: SummaryChapter["timestampKind"] = "none";
    if (valid && times.has(candidate)) {
      startSeconds = candidate;
      timestampKind = "source";
    } else if (valid && context.video) {
      startSeconds = candidate;
      timestampKind = "approximate";
    } else if (
      valid &&
      context.restore &&
      (c.timestampKind === "approximate" ||
        (c.timestampKind === "source" && context.source === undefined))
    ) {
      startSeconds = candidate;
      timestampKind = c.timestampKind as SummaryChapter["timestampKind"];
    }
    const quote =
      typeof c.sourceQuote === "string" &&
      c.sourceQuote.length <= 500 &&
      context.source?.includes(c.sourceQuote)
        ? c.sourceQuote
        : undefined;
    const references = validateReferences(
      c.references,
      context.source || "",
      context.evidence,
    );
    return {
      title: string(c.title, 180),
      summary: string(c.summary, 5000),
      bullets: strings(c.bullets, 8, 1000),
      startSeconds,
      timestampKind,
      sourceQuote: quote,
      ...(references?.length ? { references } : {}),
    };
  });
  const graph = object(v.mindMap);
  if (
    !Array.isArray(graph.nodes) ||
    graph.nodes.length < 2 ||
    graph.nodes.length > 25 ||
    !Array.isArray(graph.edges) ||
    graph.edges.length < 1 ||
    graph.edges.length > 45
  )
    throw new Error("INVALID_SUMMARY");
  const ids = new Set<string>();
  const nodes = graph.nodes.map((raw) => {
    const n = object(raw),
      id = string(n.id, 40);
    if (!/^[A-Za-z0-9_-]+$/.test(id) || ids.has(id))
      throw new Error("INVALID_SUMMARY");
    ids.add(id);
    const chapterIndex =
      Number.isInteger(n.chapterIndex) &&
      Number(n.chapterIndex) >= 0 &&
      Number(n.chapterIndex) < chapters.length
        ? Number(n.chapterIndex)
        : undefined;
    return {
      id,
      label: string(n.label, 100),
      detail: typeof n.detail === "string" ? n.detail.slice(0, 1500) : "",
      chapterIndex,
    };
  });
  const uniqueEdges = new Set<string>();
  const edges = graph.edges.map((raw) => {
    const e = object(raw),
      source = string(e.source, 40),
      target = string(e.target, 40);
    if (
      !ids.has(source) ||
      !ids.has(target) ||
      source === target ||
      uniqueEdges.has(`${source}:${target}`)
    )
      throw new Error("INVALID_SUMMARY");
    uniqueEdges.add(`${source}:${target}`);
    return {
      source,
      target,
      label: typeof e.label === "string" ? e.label.slice(0, 80) : undefined,
    };
  });
  const connected = new Set<string>([nodes[0].id]);
  for (let pass = 0; pass < nodes.length; pass++)
    for (const edge of edges) {
      if (connected.has(edge.source)) connected.add(edge.target);
      if (connected.has(edge.target)) connected.add(edge.source);
    }
  if (connected.size !== nodes.length) throw new Error("INVALID_SUMMARY");
  return {
    title: string(v.title, 200),
    overview: string(v.overview, context.aggregate ? 50000 : 6000),
    keyPoints: strings(v.keyPoints, context.aggregate ? 72 : 12, 1500),
    chapters,
    mindMap: { nodes, edges },
  };
}
export function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60),
    s = Math.floor(seconds % 60);
  return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
export function summaryMarkdown(summary: StudySummary) {
  return [
    `# ${summary.title}`,
    summary.overview,
    summary.keyPoints.map((p) => `- ${p}`).join("\n"),
    ...summary.chapters.map(
      (c, i) =>
        `## ${i + 1}. ${c.title}${c.startSeconds !== undefined ? ` (${c.timestampKind === "approximate" ? "≈ " : ""}${formatTime(c.startSeconds)})` : ""}\n\n${c.summary}\n\n${c.bullets.map((p) => `- ${p}`).join("\n")}`,
    ),
  ].join("\n\n");
}
