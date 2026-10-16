import type { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { sourceSegments, type SourceSegment } from "../ai/grounding";
import { verifySourceEvidence } from "./source-evidence";
import { PlatformError, type User } from "./types";
import {
  RAG_LIMITS,
  packRagSnapshot,
  parseRagScope,
  type RagDocument,
  type RagHit,
  type RagIndexInput,
  type RagScope,
  type RagSnapshot,
} from "../rag/types";
import {
  lexicalRank,
  hybridRank,
  diverseHits,
  cosine,
  potentialConflict,
} from "../rag/retrieval";
type Row = Record<string, string | number | bigint | Uint8Array | null>;
export function createRagStore({
  db,
  now,
  stamp,
  transaction,
  getUser,
}: {
  db: DatabaseSync;
  now: () => number;
  stamp: () => string;
  transaction: <T>(fn: () => T) => T;
  getUser: (id: string) => User | null;
}) {
  const current = (userId: string, version?: number) => {
    const u = getUser(userId);
    if (
      !u ||
      u.disabled ||
      (version !== undefined && u.sessionVersion !== version)
    )
      throw new PlatformError("SESSION_REVOKED", 401);
  };
  const workspace = (value: string) => {
    if (typeof value !== "string" || !/^[\w:-]{1,80}$/.test(value))
      throw new PlatformError("INVALID_RAG_SCOPE");
    return value;
  };
  const sweep = () => {
    db.prepare("DELETE FROM rag_snapshots WHERE expires_at<=?").run(now());
    db.prepare("DELETE FROM rag_documents WHERE expires_at<=?").run(now());
  };
  function owned(userId: string, space: string, id: string) {
    current(userId);
    workspace(space);
    const row = db
      .prepare(
        "SELECT * FROM rag_documents WHERE id=? AND user_id=? AND workspace_id=? AND expires_at>?",
      )
      .get(id, userId, space, now());
    if (!row) throw new PlatformError("RAG_DOCUMENT_NOT_FOUND", 404);
    return row;
  }
  function summary(row: Row): RagDocument {
    const stats = db
      .prepare(
        "SELECT count(*) n, count(vector_json) semantic FROM rag_chunks WHERE document_id=? AND user_id=?",
      )
      .get(row.id, row.user_id)!;
    return {
      id: String(row.id),
      clientItemId: String(row.client_item_id),
      workspaceId: String(row.workspace_id),
      title: String(row.title),
      digest: String(row.digest),
      revision: Number(row.revision),
      characters: String(row.source_text).length,
      chunks: Number(stats.n),
      semantic:
        Number(stats.n) > 0 &&
        stats.n === stats.semantic &&
        row.embedding_model ===
          (process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small") &&
        Number(row.embedding_dimensions) === RAG_LIMITS.dimensions,
      expiresAt: new Date(Number(row.expires_at)).toISOString(),
    };
  }
  function ragList(userId: string, space: string) {
    current(userId);
    workspace(space);
    sweep();
    return db
      .prepare(
        "SELECT * FROM rag_documents WHERE user_id=? AND workspace_id=? ORDER BY updated_at DESC,id",
      )
      .all(userId, space)
      .map(summary);
  }
  function ragIndex(userId: string, input: RagIndexInput, version?: number) {
    current(userId, version);
    workspace(input.workspaceId);
    if (
      typeof input.clientItemId !== "string" ||
      !input.clientItemId ||
      input.clientItemId.length > 100 ||
      typeof input.title !== "string" ||
      !input.title.trim() ||
      input.title.length > 200 ||
      typeof input.text !== "string" ||
      !input.text.trim() ||
      input.text.length > RAG_LIMITS.documentCharacters
    )
      throw new PlatformError("INVALID_RAG_DOCUMENT");
    const evidence = verifySourceEvidence(input.evidence, input.text, userId),
      parts = sourceSegments(input.text, evidence),
      digest = createHash("sha256").update(input.text).digest("hex"),
      evidenceJSON = evidence ? JSON.stringify(evidence) : null;
    return transaction(() => {
      current(userId, version);
      sweep();
      const previous = db
        .prepare(
          "SELECT * FROM rag_documents WHERE user_id=? AND workspace_id=? AND client_item_id=?",
        )
        .get(userId, input.workspaceId, input.clientItemId);
      if (
        previous &&
        previous.digest === digest &&
        previous.title === input.title.trim() &&
        previous.evidence_json === evidenceJSON
      )
        return summary(previous);
      const otherDocuments = db
        .prepare(
          "SELECT source_text FROM rag_documents WHERE user_id=? AND id<>?",
        )
        .all(userId, previous?.id || "");
      const totals = {
        n: otherDocuments.length,
        chars: otherDocuments.reduce(
          (sum, row) => sum + String(row.source_text).length,
          0,
        ),
      };
      const chunks = db
        .prepare(
          "SELECT count(*) n FROM rag_chunks WHERE user_id=? AND document_id<>?",
        )
        .get(userId, previous?.id || "")!;
      if (
        Number(totals.n) >= RAG_LIMITS.documents ||
        Number(totals.chars) + input.text.length > RAG_LIMITS.characters ||
        Number(chunks.n) + parts.length > RAG_LIMITS.chunks
      )
        throw new PlatformError("RAG_LIBRARY_LIMIT", 413);
      const id = previous ? String(previous.id) : randomUUID(),
        revision = previous ? Number(previous.revision) + 1 : 1,
        date = stamp(),
        expires = now() + RAG_LIMITS.retentionDays * 86400000;
      db.prepare(
        "INSERT INTO rag_documents(id,user_id,workspace_id,client_item_id,title,source_text,digest,evidence_json,revision,created_at,updated_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,workspace_id,client_item_id) DO UPDATE SET title=excluded.title,source_text=excluded.source_text,digest=excluded.digest,evidence_json=excluded.evidence_json,revision=excluded.revision,updated_at=excluded.updated_at,expires_at=excluded.expires_at,embedding_model=NULL,embedding_dimensions=NULL",
      ).run(
        id,
        userId,
        input.workspaceId,
        input.clientItemId,
        input.title.trim(),
        input.text,
        digest,
        evidenceJSON,
        revision,
        date,
        date,
        expires,
      );
      db.prepare(
        "DELETE FROM rag_chunks WHERE document_id=? AND user_id=?",
      ).run(id, userId);
      const insert = db.prepare(
        "INSERT INTO rag_chunks(id,user_id,workspace_id,document_id,ordinal,segment_json) VALUES (?,?,?,?,?,?)",
      );
      parts.forEach((part, i) =>
        insert.run(
          randomUUID(),
          userId,
          input.workspaceId,
          id,
          i,
          JSON.stringify(part),
        ),
      );
      return summary(owned(userId, input.workspaceId, id));
    });
  }
  function ragDelete(
    userId: string,
    space: string,
    id: string,
    version?: number,
  ) {
    return transaction(() => {
      current(userId, version);
      owned(userId, space, id);
      db.prepare(
        "DELETE FROM rag_snapshots WHERE user_id=? AND workspace_id=?",
      ).run(userId, space);
      db.prepare(
        "DELETE FROM rag_documents WHERE id=? AND user_id=? AND workspace_id=?",
      ).run(id, userId, space);
      return { deleted: true };
    });
  }
  /** A local source may have indexed copies under older workspaces. Erase all
   * copies owned by this actor and invalidate those workspaces' cached evidence. */
  function ragDeleteSource(
    userId: string,
    clientItemId: string,
    version: number,
  ) {
    if (
      typeof clientItemId !== "string" ||
      !clientItemId.trim() ||
      clientItemId.length > 100 ||
      /[\u0000-\u001f\u007f]/.test(clientItemId)
    )
      throw new PlatformError("INVALID_RAG_DOCUMENT");
    return transaction(() => {
      current(userId, version);
      db.prepare(
        "DELETE FROM rag_snapshots WHERE user_id=? AND workspace_id IN (SELECT workspace_id FROM rag_documents WHERE user_id=? AND client_item_id=?)",
      ).run(userId, userId, clientItemId);
      const result = db
        .prepare(
          "DELETE FROM rag_documents WHERE user_id=? AND client_item_id=?",
        )
        .run(userId, clientItemId);
      return { deleted: Number(result.changes) };
    });
  }
  function scopeRows(userId: string, raw: RagScope) {
    current(userId);
    sweep();
    let scope: RagScope;
    try {
      scope = parseRagScope(raw);
    } catch {
      throw new PlatformError("INVALID_RAG_SCOPE");
    }
    const documents = scope.documentIds.map((id) =>
      owned(userId, scope.workspaceId, id),
    );
    const rows = db
      .prepare(
        `SELECT c.id chunk_id,c.segment_json,c.vector_json,d.id document_id,d.title,d.digest,d.revision,d.embedding_model,d.embedding_dimensions FROM rag_chunks c JOIN rag_documents d ON c.document_id=d.id AND c.user_id=d.user_id AND c.workspace_id=d.workspace_id WHERE c.user_id=? AND c.workspace_id=? AND d.expires_at>? AND d.id IN (${documents.map(() => "?").join(",")}) ORDER BY d.id,c.ordinal`,
      )
      .all(userId, scope.workspaceId, now(), ...scope.documentIds);
    return { scope, documents, rows };
  }
  function ragSearch(
    userId: string,
    raw: RagScope,
    query: string,
    embedding?: { vector: number[]; model: string },
    version?: number,
  ) {
    current(userId, version);
    if (typeof query !== "string" || !query.trim() || query.length > 4000)
      throw new PlatformError("INVALID_RAG_QUERY");
    const { scope, documents, rows } = scopeRows(userId, raw),
      hits = rows.map((r) => ({
        ...(JSON.parse(String(r.segment_json)) as SourceSegment),
        chunkId: String(r.chunk_id),
        documentId: String(r.document_id),
        documentTitle: String(r.title),
        documentDigest: String(r.digest),
        documentRevision: Number(r.revision),
        score: 0,
      }));
    const lexical = lexicalRank(hits, query);
    let ranked = lexical,
      mode: "lexical" | "hybrid" = "lexical";
    if (scope.mode === "hybrid" && embedding) {
      const semantic = hits
        .flatMap((h, i) => {
          const r = rows[i];
          if (r.embedding_model !== embedding.model || !r.vector_json)
            return [];
          const vector = JSON.parse(String(r.vector_json)) as number[];
          const score = cosine(vector, embedding.vector);
          return score >= 0.35 ? [{ ...h, score }] : [];
        })
        .sort((a, b) => b.score - a.score);
      ranked = hybridRank(lexical, semantic);
      mode = "hybrid";
    }
    return {
      hits: diverseHits(ranked, RAG_LIMITS.hits),
      mode,
      documents: documents.map((d) => ({
        id: String(d.id),
        digest: String(d.digest),
        revision: Number(d.revision),
      })),
    };
  }
  function ragPrepareSnapshot(
    userId: string,
    version: number,
    scope: RagScope,
    query: string,
    embedding?: { vector: number[]; model: string },
  ): RagSnapshot {
    current(userId, version);
    if (scope.snapshotId)
      return ragReadSnapshot(userId, version, scope.snapshotId, scope);
    return transaction(() => {
      current(userId, version);
      const count = db
        .prepare(
          "SELECT count(*) n FROM rag_snapshots WHERE user_id=? AND expires_at>?",
        )
        .get(userId, now())!;
      if (Number(count.n) >= RAG_LIMITS.snapshots)
        throw new PlatformError("RAG_SNAPSHOT_LIMIT", 429);
      const found = ragSearch(userId, scope, query, embedding);
      if (!found.hits.length) throw new PlatformError("RAG_NO_EVIDENCE", 422);
      const snapshot: RagSnapshot = {
        id: randomUUID(),
        workspaceId: scope.workspaceId,
        documents: found.documents,
        hits: found.hits,
        ...packRagSnapshot(found.hits),
        mode: found.mode,
        potentialConflict: potentialConflict(found.hits),
        expiresAt: new Date(
          now() + RAG_LIMITS.retentionDays * 86400000,
        ).toISOString(),
      };
      db.prepare(
        "INSERT INTO rag_snapshots(id,user_id,session_version,workspace_id,payload_json,created_at,expires_at) VALUES (?,?,?,?,?,?,?)",
      ).run(
        snapshot.id,
        userId,
        version,
        scope.workspaceId,
        JSON.stringify(snapshot),
        stamp(),
        Date.parse(snapshot.expiresAt),
      );
      return snapshot;
    });
  }
  function ragAssertDocuments(
    userId: string,
    version: number | undefined,
    space: string,
    documents: RagSnapshot["documents"],
  ) {
    current(userId, version);
    for (const doc of documents) {
      const current = owned(userId, space, doc.id);
      if (
        current.digest !== doc.digest ||
        Number(current.revision) !== doc.revision
      )
        throw new PlatformError("RAG_SOURCE_CHANGED", 409);
    }
  }
  function ragAssertSnapshot(
    userId: string,
    snapshot: RagSnapshot,
    version?: number,
  ) {
    ragAssertDocuments(
      userId,
      version,
      snapshot.workspaceId,
      snapshot.documents,
    );
    if (Date.parse(snapshot.expiresAt) <= now())
      throw new PlatformError("RAG_SOURCE_CHANGED", 409);
  }
  function ragReadSnapshot(
    userId: string,
    version: number,
    id: string,
    scope?: RagScope,
  ): RagSnapshot {
    current(userId, version);
    sweep();
    const row = db
      .prepare(
        "SELECT payload_json FROM rag_snapshots WHERE id=? AND user_id=? AND session_version=? AND expires_at>?",
      )
      .get(id, userId, version, now());
    if (!row) throw new PlatformError("RAG_SNAPSHOT_NOT_FOUND", 404);
    const snapshot = JSON.parse(String(row.payload_json)) as RagSnapshot;
    if (
      scope &&
      (scope.workspaceId !== snapshot.workspaceId ||
        JSON.stringify([...scope.documentIds].sort()) !==
          JSON.stringify(snapshot.documents.map((d) => d.id).sort()))
    )
      throw new PlatformError("RAG_SOURCE_CHANGED", 409);
    ragAssertSnapshot(userId, snapshot, version);
    return snapshot;
  }
  function ragEmbeddingInput(userId: string, space: string, id: string) {
    const doc = owned(userId, space, id),
      rows = db
        .prepare(
          "SELECT id,segment_json,vector_json FROM rag_chunks WHERE document_id=? AND user_id=? AND workspace_id=? ORDER BY ordinal",
        )
        .all(id, userId, space);
    return {
      id,
      digest: String(doc.digest),
      revision: Number(doc.revision),
      semantic: rows.length > 0 && rows.every((r) => r.vector_json !== null),
      model:
        doc.embedding_model === null ? undefined : String(doc.embedding_model),
      chunks: rows.map((r) => ({
        id: String(r.id),
        text: (JSON.parse(String(r.segment_json)) as SourceSegment).text,
      })),
    };
  }
  function ragRequireSemantic(
    userId: string,
    scope: RagScope,
    model: string,
    version?: number,
  ) {
    current(userId, version);
    const { documents, rows } = scopeRows(userId, scope);
    if (
      documents.some(
        (d) =>
          d.embedding_model !== model ||
          Number(d.embedding_dimensions) !== RAG_LIMITS.dimensions,
      ) ||
      rows.some((r) => !r.vector_json)
    )
      throw new PlatformError("RAG_EMBEDDINGS_STALE", 409);
  }
  function ragSetEmbeddings(
    userId: string,
    space: string,
    id: string,
    digest: string,
    revision: number,
    model: string,
    vectors: number[][],
    transactionAlreadyOpen = false,
    version?: number,
  ) {
    const save = () => {
      current(userId, version);
      const data = ragEmbeddingInput(userId, space, id);
      if (data.digest !== digest || data.revision !== revision)
        throw new PlatformError("RAG_SOURCE_CHANGED", 409);
      if (
        vectors.length !== data.chunks.length ||
        vectors.some(
          (v) =>
            v.length !== RAG_LIMITS.dimensions ||
            v.some((n) => !Number.isFinite(n)),
        )
      )
        throw new PlatformError("INVALID_EMBEDDING", 502);
      const update = db.prepare(
        "UPDATE rag_chunks SET vector_json=? WHERE id=? AND document_id=? AND user_id=? AND workspace_id=?",
      );
      vectors.forEach((v, i) =>
        update.run(JSON.stringify(v), data.chunks[i].id, id, userId, space),
      );
      db.prepare(
        "UPDATE rag_documents SET embedding_model=?,embedding_dimensions=? WHERE id=? AND user_id=? AND workspace_id=?",
      ).run(model, RAG_LIMITS.dimensions, id, userId, space);
      return summary(owned(userId, space, id));
    };
    return transactionAlreadyOpen ? save() : transaction(save);
  }
  return {
    ragList,
    ragIndex,
    ragDelete,
    ragDeleteSource,
    ragSearch,
    ragPrepareSnapshot,
    ragReadSnapshot,
    ragAssertSnapshot,
    ragAssertDocuments,
    ragEmbeddingInput,
    ragRequireSemantic,
    ragSetEmbeddings,
  };
}
