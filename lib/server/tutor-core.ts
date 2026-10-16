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
  TUTOR_INTENTS,
  type TutorIntent,
  type TutorFeedback,
  type TutorTurnIdentity,
  type TutorSessionView,
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
        input.ragContext?.id,
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
  function feedbackState(turnId: string) {
    const row = db
      .prepare("SELECT * FROM tutor_feedback WHERE turn_id=?")
      .get(turnId);
    const revision = Number(
      db
        .prepare(
          "SELECT coalesce(max(result_revision),0) revision FROM tutor_feedback_actions WHERE turn_id=?",
        )
        .get(turnId)?.revision || 0,
    );
    const feedback: TutorFeedback | null = row
      ? {
          revision: Number(row.revision),
          usefulness: row.usefulness as TutorFeedback["usefulness"],
          correctness: row.correctness as TutorFeedback["correctness"],
          updatedAt: String(row.updated_at),
        }
      : null;
    return { revision, feedback };
  }
  function turnIdentity(row: Row): TutorTurnIdentity {
    const feedback = feedbackState(String(row.id));
    return {
      id: String(row.id),
      ordinal: Number(row.ordinal),
      intent: row.intent as TutorIntent,
      counted:
        row.guidance === "hints" &&
        row.intent === "progress" &&
        !row.needs_clarification,
      feedbackRevision: feedback.revision,
      feedback: feedback.feedback,
    };
  }
  function state(row: Row, guidance: "hints" | "full" = "hints"): TutorState {
    const latest = db
      .prepare(
        "SELECT * FROM tutor_turns WHERE session_id=? ORDER BY ordinal DESC LIMIT 1",
      )
      .get(String(row.id));
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
      ...(latest ? { latestTurn: turnIdentity(latest) } : {}),
    };
  }
  function getTutorSession(
    userId: string,
    version: number,
    id: string,
  ): TutorSessionView {
    current(userId, version);
    sweep();
    return transaction(() => {
      const row = owned(id, userId, version);
      const turns = db
        .prepare(
          "SELECT * FROM tutor_turns WHERE session_id=? ORDER BY ordinal",
        )
        .all(id);
      return {
        ...state(row),
        problem: String(row.problem),
        turns: turns.map((t) => ({
          ...turnIdentity(t),
          student: String(t.student_text),
          assistant: String(t.assistant_text),
          hint: t.hint === null ? undefined : String(t.hint),
          question: t.question === null ? undefined : String(t.question),
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
        retentionDays: 7 as const,
        continuity: {
          lastQuestion: turns.at(-1)?.question
            ? String(turns.at(-1)!.question)
            : null,
          lastStudentAttempt: turns.at(-1)?.student_text
            ? String(turns.at(-1)!.student_text)
            : null,
          lastStep: turns.at(-1)?.step ? String(turns.at(-1)!.step) : null,
          note: "recorded-not-verified" as const,
        },
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
      const intent = input.tutorIntent || "progress";
      if (!TUTOR_INTENTS.includes(intent))
        throw new AIError("INVALID_TUTOR_INTENT");
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
        .filter(
          (t) =>
            t.hint !== null &&
            !t.needs_clarification &&
            t.intent === "progress",
        )
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
          intent,
          previousQuestion: turns.at(-1)?.question
            ? String(turns.at(-1)!.question)
            : undefined,
          previousStudentAttempt: turns.at(-1)?.student_text
            ? String(turns.at(-1)!.student_text)
            : undefined,
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
        (!reply.hint ||
          ((lease.context.intent || "progress") === "progress" &&
            repeatedHint(reply.hint, lease.context.hints))))
    )
      throw new AIError("INVALID_TUTOR_OUTPUT", 502);
    db.prepare(
      "INSERT INTO tutor_turns(id,session_id,request_id,ordinal,student_text,assistant_text,hint,question,misconception,step,guidance,created_at,references_json,verification_json,needs_clarification,intent) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
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
      lease.context.intent || "progress",
    );
    db.prepare(
      "UPDATE tutor_sessions SET hint_count=hint_count+?,revision=revision+1,pending_request=NULL,pending_until=NULL,updated_at=?,needs_clarification=? WHERE id=?",
    ).run(
      lease.context.guidance === "hints" &&
        (lease.context.intent || "progress") === "progress" &&
        !reply.needsClarification
        ? 1
        : 0,
      stamp(),
      reply.needsClarification ||
        ((lease.context.intent || "progress") !== "progress" &&
          row.needs_clarification)
        ? 1
        : 0,
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
  function mutateTutorFeedback(userId: string, version: number, raw: unknown) {
    current(userId, version);
    sweep();
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new PlatformError("INVALID_TUTOR_FEEDBACK");
    const b = raw as Record<string, unknown>;
    if (
      Object.keys(b).some(
        (k) =>
          ![
            "sessionId",
            "turnId",
            "requestId",
            "expectedRevision",
            "action",
            "usefulness",
            "correctness",
          ].includes(k),
      )
    )
      throw new PlatformError("INVALID_TUTOR_FEEDBACK");
    const uuid = (v: unknown) =>
      typeof v === "string" &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
    if (
      !uuid(b.sessionId) ||
      !uuid(b.turnId) ||
      !uuid(b.requestId) ||
      !Number.isSafeInteger(b.expectedRevision) ||
      Number(b.expectedRevision) < 0 ||
      typeof b.action !== "string" ||
      !["set", "delete"].includes(b.action)
    )
      throw new PlatformError("INVALID_TUTOR_FEEDBACK");
    const usefulness = b.usefulness ?? null,
      correctness = b.correctness ?? null;
    if (
      (usefulness !== null &&
        (typeof usefulness !== "string" ||
          !["helpful", "not_helpful"].includes(usefulness))) ||
      (correctness !== null &&
        (typeof correctness !== "string" ||
          !["possible_error", "not_sure"].includes(correctness))) ||
      (b.action === "set" && usefulness === null && correctness === null) ||
      (b.action === "delete" &&
        (b.usefulness !== undefined || b.correctness !== undefined))
    )
      throw new PlatformError("INVALID_TUTOR_FEEDBACK");
    const sessionId = String(b.sessionId),
      turnId = String(b.turnId),
      requestId = String(b.requestId);
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify([
          sessionId,
          turnId,
          b.expectedRevision,
          b.action,
          usefulness,
          correctness,
        ]),
      )
      .digest("hex");
    return transaction(() => {
      owned(sessionId, userId, version);
      const turn = db
        .prepare("SELECT id FROM tutor_turns WHERE id=? AND session_id=?")
        .get(turnId, sessionId);
      if (!turn) throw new PlatformError("TUTOR_TURN_NOT_FOUND", 404);
      const prior = db
        .prepare(
          "SELECT * FROM tutor_feedback_actions WHERE user_id=? AND request_id=?",
        )
        .get(userId, requestId);
      const state = feedbackState(turnId);
      if (prior) {
        if (prior.fingerprint !== fingerprint || prior.turn_id !== turnId)
          throw new PlatformError("TUTOR_FEEDBACK_KEY_REUSED", 409);
        return {
          ...state,
          deleted: state.feedback === null,
          replayed: true,
          appliedRevision: Number(prior.result_revision),
        };
      }
      if (state.revision !== b.expectedRevision)
        throw new PlatformError("TUTOR_FEEDBACK_CONFLICT", 409);
      // An already empty feedback has nothing to erase or retain.
      if (b.action === "delete" && !state.feedback)
        return {
          ...state,
          deleted: true,
          replayed: false,
          appliedRevision: state.revision,
        };
      const turnActions = Number(
        db
          .prepare(
            "SELECT count(*) n FROM tutor_feedback_actions WHERE turn_id=?",
          )
          .get(turnId)?.n || 0,
      );
      const userActions = Number(
        db
          .prepare(
            "SELECT count(*) n FROM tutor_feedback_actions WHERE user_id=?",
          )
          .get(userId)?.n || 0,
      );
      if (b.action === "set" && (turnActions >= 50 || userActions >= 10000))
        throw new PlatformError("TUTOR_FEEDBACK_LIMIT", 429);
      const revision = state.revision + 1;
      if (b.action === "delete")
        db.prepare("DELETE FROM tutor_feedback WHERE turn_id=?").run(turnId);
      else
        db.prepare(
          "INSERT INTO tutor_feedback(turn_id,session_id,revision,usefulness,correctness,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(turn_id) DO UPDATE SET revision=excluded.revision,usefulness=excluded.usefulness,correctness=excluded.correctness,updated_at=excluded.updated_at",
        ).run(
          turnId,
          sessionId,
          revision,
          usefulness as string | null,
          correctness as string | null,
          stamp(),
        );
      db.prepare(
        "INSERT INTO tutor_feedback_actions(user_id,request_id,session_id,turn_id,fingerprint,result_revision,deleted,created_at) VALUES(?,?,?,?,?,?,?,?)",
      ).run(
        userId,
        requestId,
        sessionId,
        turnId,
        fingerprint,
        revision,
        b.action === "delete" ? 1 : 0,
        stamp(),
      );
      return {
        ...feedbackState(turnId),
        deleted: b.action === "delete",
        replayed: false,
        appliedRevision: revision,
      };
    });
  }
  return {
    prepareTutorTurn,
    commitTutorTurn,
    abortTutorTurn,
    getTutorSession,
    deleteTutorSessions,
    mutateTutorFeedback,
  };
}
