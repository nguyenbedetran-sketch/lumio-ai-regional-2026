import type {
  SourceEvidence,
  SourceReference,
  SourceSegment,
} from "../ai/grounding";
export const RAG_LIMITS = {
  documents: 5,
  characters: 250000,
  chunks: 300,
  documentCharacters: 100000,
  retentionDays: 7,
  hits: 6,
  dimensions: 256,
  snapshots: 100,
} as const;
export type RagScope = {
  workspaceId: string;
  documentIds: string[];
  snapshotId?: string;
  mode?: "lexical" | "hybrid";
  consent?: boolean;
};
export type RagDocument = {
  id: string;
  clientItemId: string;
  workspaceId: string;
  title: string;
  digest: string;
  revision: number;
  characters: number;
  chunks: number;
  semantic: boolean;
  expiresAt: string;
};
export type RagHit = SourceSegment & {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentDigest: string;
  documentRevision: number;
  score: number;
};
export type RagSnapshot = {
  id: string;
  workspaceId: string;
  documents: { id: string; digest: string; revision: number }[];
  hits: RagHit[];
  source: string;
  blocks: { start: number; end: number; hit: RagHit }[];
  mode: "lexical" | "hybrid";
  potentialConflict: boolean;
  expiresAt: string;
};
export type RagIndexInput = {
  workspaceId: string;
  clientItemId: string;
  title: string;
  text: string;
  evidence?: SourceEvidence;
};
export type RagReferenceMetadata = {
  documentId: string;
  title: string;
  digest: string;
  revision: number;
  chunkId: string;
  snapshotId: string;
};
export function parseRagScope(raw: unknown): RagScope {
  const r = raw as Partial<RagScope> | null;
  if (
    !r ||
    typeof r !== "object" ||
    typeof r.workspaceId !== "string" ||
    !/^[\w:-]{1,80}$/.test(r.workspaceId) ||
    !Array.isArray(r.documentIds) ||
    !r.documentIds.length ||
    r.documentIds.length > 5 ||
    r.documentIds.some(
      (id) => typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id),
    ) ||
    new Set(r.documentIds).size !== r.documentIds.length ||
    (r.mode !== undefined && !["lexical", "hybrid"].includes(r.mode)) ||
    (r.snapshotId !== undefined &&
      (typeof r.snapshotId !== "string" ||
        !/^[a-f0-9-]{36}$/.test(r.snapshotId))) ||
    (r.consent !== undefined && typeof r.consent !== "boolean")
  )
    throw Error("INVALID_RAG_SCOPE");
  return {
    workspaceId: r.workspaceId,
    documentIds: [...r.documentIds].sort(),
    ...(r.snapshotId ? { snapshotId: r.snapshotId } : {}),
    mode: r.mode || "lexical",
    consent: r.consent === true,
  };
}
export function packRagSnapshot(hits: RagHit[]) {
  let source = "";
  const blocks: RagSnapshot["blocks"] = [];
  for (const hit of hits) {
    if (source) source += "\n\n";
    const start = source.length;
    source += hit.text;
    blocks.push({ start, end: source.length, hit });
  }
  return { source, blocks };
}
export function mapRagReferences(
  references: SourceReference[] | undefined,
  snapshot: RagSnapshot,
): SourceReference[] {
  return (references || []).flatMap((ref) => {
    const block = snapshot.blocks.find(
      (b) =>
        ref.start >= b.start &&
        ref.end <= b.end &&
        snapshot.source.slice(ref.start, ref.end) === ref.quote,
    );
    if (!block) return [];
    const h = block.hit;
    return [
      {
        ...ref,
        start: h.start + ref.start - block.start,
        end: h.start + ref.end - block.start,
        paragraph: h.paragraph,
        page: h.page,
        slide: h.slide,
        heading: h.heading,
        seconds: h.seconds,
        rag: {
          documentId: h.documentId,
          title: h.documentTitle,
          digest: h.documentDigest,
          revision: h.documentRevision,
          chunkId: h.chunkId,
          snapshotId: snapshot.id,
        },
      },
    ];
  });
}
