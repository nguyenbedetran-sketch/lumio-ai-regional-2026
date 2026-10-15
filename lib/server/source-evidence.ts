import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  parseSourceEvidence,
  type SourceEvidence,
  type SourceUnit,
} from "../ai/grounding";
import { AIError } from "../ai/contracts";

function secret() {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value || value.length < 32)
    throw new AIError("SOURCE_SIGNING_UNAVAILABLE", 503);
  return value;
}
function payload(e: Omit<SourceEvidence, "proof">, userId: string) {
  return JSON.stringify([
    "lumio-source-evidence-v1",
    userId,
    e.version,
    e.kind,
    e.filename,
    e.digest,
    e.units.map((u) => [
      u.start,
      u.end,
      u.page ?? null,
      u.slide ?? null,
      u.heading ?? null,
    ]),
  ]);
}
export function signSourceEvidence(
  input: {
    kind: SourceEvidence["kind"];
    filename: string;
    text: string;
    units: SourceUnit[];
  },
  userId: string,
): SourceEvidence {
  const data = {
    version: 1 as const,
    kind: input.kind,
    filename: input.filename,
    digest: createHash("sha256").update(input.text).digest("hex"),
    units: input.units,
  };
  const proof = createHmac("sha256", secret())
    .update(payload(data, userId))
    .digest("hex");
  return parseSourceEvidence({ ...data, proof }, input.text);
}
export function verifySourceEvidence(
  raw: unknown,
  source: string,
  userId: string,
): SourceEvidence | undefined {
  if (raw === undefined) return undefined;
  try {
    const e = parseSourceEvidence(raw, source);
    const digest = createHash("sha256").update(source).digest("hex");
    const proof = createHmac("sha256", secret())
      .update(payload(e, userId))
      .digest("hex");
    if (
      e.digest !== digest ||
      !timingSafeEqual(Buffer.from(e.proof, "hex"), Buffer.from(proof, "hex"))
    )
      throw new Error();
    return e;
  } catch (error) {
    if (error instanceof AIError) throw error;
    throw new AIError("INVALID_SOURCE_EVIDENCE", 400);
  }
}
