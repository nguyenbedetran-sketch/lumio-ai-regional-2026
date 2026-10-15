import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { AIInput } from "../ai/contracts";
import type { SourceReference } from "../ai/grounding";
import { AIError } from "../ai/contracts";
import { checkStudentAnswer } from "../tutor/math";
import { repeatedHint } from "../tutor/policy";
import {
  REQUIRED_HINTS,
  TUTOR_RETENTION_MS,
  type TutorContext,
  type TutorReply,
  type TutorState,
  type MathVerification,
} from "../tutor/types";
import { PlatformError, type User } from "./types";

type Row = Record<string, string | number | bigint | Uint8Array | null>;
export type TutorTurnLease = {
  sessionId: string;
  requestId: string;
  userId: string;
  sessionVersion: number;
  revision: number;
  studentText: string;
  context: TutorContext;
  history: { role: "user" | "assistant"; text: string }[];
};
export class TutorLockedError extends AIError {
  constructor(public tutor: TutorState) {
    super("TUTOR_LOCKED", 409);
  }
}
export function tutorSourceDigest(input: AIInput) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        input.source,
        input.media?.mimeType,
        input.media?.data,
        input.youtubeUrl,
        input.videoRange,
      ]),
    )
    .digest("hex");
}
export function createTutorStore({
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
  function current(userId: string, version: number) {
    const user = getUser(userId);
    if (!user || user.disabled || user.sessionVersion !== version)
      throw new PlatformError("SESSION_REVOKED", 401);
  }
  function sweep() {
    db.prepare("DELETE FROM tutor_sessions WHERE expires_at<=?").run(now());
  }
  function owned(id: string, userId: string, version: number) {
    current(userId, version);
    const row = db
      .prepare(
        "SELECT * FROM tutor_sessions WHERE id=? AND user_id=? AND session_version=? AND expires_at>?",
      )
      .get(id, userId, version, now());
    if (!row) throw new PlatformError("TUTOR_SESSION_NOT_FOUND", 404);
    return row;
  }
  function state(row: Row, guidance: "hints" | "full" = "hints"): TutorState {
    return {
      sessionId: String(row.id),
      hintCount: Number(row.hint_count),
      requiredHints: REQUIRED_HINTS as 3,
      canUnlock:
        Number(row.hint_count) >= REQUIRED_HINTS && !row.needs_clarification,
      needsClarification: !!row.needs_clarification,
      guidance,
      revision: Number(row.revision),
      expiresAt: new Date(Number(row.expires_at)).toISOString(),
    };
  }
  function getTutorSession(userId: string, version: number, id: string) {
    current(userId, version);
    sweep();
    return transaction(() => {
      const row = owned(id, userId, version);
      const turns = db
        .prepare(
          "SELECT student_text,assistant_text,guidance,misconception,step,created_at,references_json,verification_json,needs_clarification FROM tutor_turns WHERE session_id=? ORDER BY ordinal",
        )
        .all(id);
      return {
        ...state(row),
        problem: String(row.problem),
        turns: turns.map((t) => ({
          student: String(t.student_text),
          assistant: String(t.assistant_text),
          guidance: t.guidance as "hints" | "full",
          misconception:
            t.misconception === null ? undefined : String(t.misconception),
          step: t.step === null ? undefined : String(t.step),
          createdAt: String(t.created_at),
          needsClarification: !!t.needs_clarification,
          references: JSON.parse(
            String(t.references_json),
          ) as SourceReference[],
          verification:
            t.verification_json === null
              ? undefined
              : (JSON.parse(String(t.verification_json)) as MathVerification),
        })),
        retentionDays: 7,
      };
    });
  }
  function beginTutorTurn(
    userId: string,
    version: number,
    input: AIInput,
    requestId: string,
  ): TutorTurnLease {
    current(userId, version);
    sweep();
    return transaction(() => {
      current(userId, version);
      let row: Row;
      if (input.tutorSessionId) {
        row = owned(input.tutorSessionId, userId, version);
        if (
          row.source_digest !== tutorSourceDigest(input) ||
          row.language !== input.language ||
          (input.tutorProblem && input.tutorProblem !== row.problem)
        )
          throw new PlatformError("TUTOR_CONTEXT_CHANGED", 409);
      } else {
        const problem = (input.tutorProblem || input.question).trim();
        if (!problem) throw new AIError("EMPTY_TUTOR_PROBLEM");
        const count = Number(
          db
            .prepare("SELECT count(*) n FROM tutor_sessions WHERE user_id=?")
            .get(userId)?.n || 0,
        );
        if (count >= 100) throw new PlatformError("TUTOR_SESSION_LIMIT", 409);
        const id = randomUUID();
        db.prepare(
          "INSERT INTO tutor_sessions(id,user_id,session_version,problem,source_digest,language,created_at,updated_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?)",
        ).run(
          id,
          userId,
          version,
          problem,
          tutorSourceDigest(input),
          input.language,
          stamp(),
          stamp(),
          now() + TUTOR_RETENTION_MS,
        );
        row = owned(id, userId, version);
      }
      const guidance = input.guidance === "full" ? "full" : "hints";
      if (
        guidance === "full" &&
        (Number(row.hint_count) < REQUIRED_HINTS || !!row.needs_clarification)
      ) {
        // Persist the new empty session so a locked reply can continue safely by id.
        return { locked: state(row) } as unknown as TutorTurnLease;
      }
      if (Number(row.revision) >= 100)
        throw new PlatformError("TUTOR_TURN_LIMIT", 409);
      if (row.pending_request && Number(row.pending_until) > now())
        throw new PlatformError("TUTOR_BUSY", 409);
      const turns = db
        .prepare(
          "SELECT * FROM tutor_turns WHERE session_id=? ORDER BY ordinal",
        )
        .all(String(row.id));
      const hints = turns
        .filter((t) => t.hint !== null && !t.needs_clarification)
        .map((t) => String(t.hint));
      const history = turns.slice(-8).flatMap((t) => [
        { role: "user" as const, text: String(t.student_text) },
        { role: "assistant" as const, text: String(t.assistant_text) },
      ]);
      const triedSolutions = [
        ...turns.map((t) => String(t.student_text)),
        input.question,
      ].flatMap(
        (answer) =>
          checkStudentAnswer(String(row.problem), answer)
            ?.candidates?.filter((candidate) => candidate.valid)
            .map((candidate) => candidate.value) || [],
      );
      db.prepare(
        "UPDATE tutor_sessions SET pending_request=?,pending_until=? WHERE id=?",
      ).run(requestId, now() + 70000, String(row.id));
      return {
        sessionId: String(row.id),
        requestId,
        userId,
        sessionVersion: version,
        revision: Number(row.revision),
        studentText: input.question,
        history,
        context: {
          problem: String(row.problem),
          hints,
          hintCount: Number(row.hint_count),
          triedSolutions: [...new Set(triedSolutions)],
          guidance,
          studentCheck:
            Number(row.revision) > 0
              ? checkStudentAnswer(String(row.problem), input.question)
              : undefined,
        },
      };
    });
  }
  function prepareTutorTurn(
    userId: string,
    version: number,
    input: AIInput,
    requestId: string,
  ): TutorTurnLease {
    const result = beginTutorTurn(
      userId,
      version,
      input,
      requestId,
    ) as TutorTurnLease & { locked?: TutorState };
    if (result.locked) throw new TutorLockedError(result.locked);
    return result;
  }
  /** Called ONLY inside settleUsage's existing write transaction. It must not open a nested transaction. */
  function commitTutorTurn(
    lease: TutorTurnLease,
    reply: TutorReply,
    assistant: string,
    metadata?: {
      references?: SourceReference[];
      verification?: MathVerification;
    },
  ): TutorState {
    const referencesJSON = JSON.stringify(
      (metadata?.references || []).slice(0, 4),
    );
    const verificationJSON = metadata?.verification
      ? JSON.stringify(metadata.verification)
      : null;
    if (referencesJSON.length > 8192 || (verificationJSON?.length || 0) > 8192)
      throw new AIError("INVALID_TUTOR_METADATA", 502);
    const row = owned(lease.sessionId, lease.userId, lease.sessionVersion);
    if (
      row.pending_request !== lease.requestId ||
      Number(row.pending_until) <= now() ||
      Number(row.revision) !== lease.revision
    )
      throw new PlatformError("TUTOR_TURN_STALE", 409);
    if (
      !assistant.trim() ||
      assistant.length > 24000 ||
      (lease.context.guidance === "hints" &&
        (!reply.hint || repeatedHint(reply.hint, lease.context.hints)))
    )
      throw new AIError("INVALID_TUTOR_OUTPUT", 502);
    db.prepare(
      "INSERT INTO tutor_turns(id,session_id,request_id,ordinal,student_text,assistant_text,hint,question,misconception,step,guidance,created_at,references_json,verification_json,needs_clarification) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      randomUUID(),
      lease.sessionId,
      lease.requestId,
      lease.revision + 1,
      lease.studentText,
      assistant,
      reply.hint || null,
      reply.question || null,
      reply.misconception || null,
      reply.step || null,
      lease.context.guidance,
      stamp(),
      referencesJSON,
      verificationJSON,
      reply.needsClarification ? 1 : 0,
    );
    db.prepare(
      "UPDATE tutor_sessions SET hint_count=hint_count+?,revision=revision+1,pending_request=NULL,pending_until=NULL,updated_at=?,needs_clarification=? WHERE id=?",
    ).run(
      lease.context.guidance === "hints" && !reply.needsClarification ? 1 : 0,
      stamp(),
      reply.needsClarification ? 1 : 0,
      lease.sessionId,
    );
    return state(
      owned(lease.sessionId, lease.userId, lease.sessionVersion),
      lease.context.guidance,
    );
  }
  function abortTutorTurn(lease: TutorTurnLease) {
    db.prepare(
      "UPDATE tutor_sessions SET pending_request=NULL,pending_until=NULL WHERE id=? AND user_id=? AND pending_request=?",
    ).run(lease.sessionId, lease.userId, lease.requestId);
  }
  function deleteTutorSessions(userId: string, version: number, id?: string) {
    current(userId, version);
    sweep();
    return transaction(() => {
      current(userId, version);
      if (id) owned(id, userId, version);
      const result = id
        ? db
            .prepare("DELETE FROM tutor_sessions WHERE id=? AND user_id=?")
            .run(id, userId)
        : db.prepare("DELETE FROM tutor_sessions WHERE user_id=?").run(userId);
      return {
        deleted: Number(result.changes),
        content: "tutor_sessions_only" as const,
      };
    });
  }
  return {
    prepareTutorTurn,
    commitTutorTurn,
    abortTutorTurn,
    getTutorSession,
    deleteTutorSessions,
  };
}
