import type { TutorSessionView } from "../tutor/types";
import type { VoiceTurn } from "./client";
/** Pointer identity only. Never stores transcript/source/audio in browser storage. */
export async function voiceSessionSlot(
  account: string,
  language: string,
  source: string,
  materialId = "",
  evidenceProof = "",
) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify([source, materialId, evidenceProof]),
    ),
  );
  return `lumio-voice-v2:${account}:${language}:${Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join("")}`;
}
export function restoreVoiceTurns(session: TutorSessionView): VoiceTurn[] {
  return session.turns.slice(-100).flatMap((turn) => [
    { id: `${turn.id}:user`, role: "user" as const, text: turn.student },
    {
      id: turn.id,
      role: "assistant" as const,
      text: turn.assistant,
      turn,
      references: turn.references,
      verification: turn.verification,
    },
  ]);
}
