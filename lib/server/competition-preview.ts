import { AIError } from "../ai/contracts";

/** Explicit, limited regional-competition mode. This is not durable production storage. */
export function isCompetitionPreview() {
  return process.env.LUMIO_COMPETITION_PREVIEW === "true" &&
    process.env.LUMIO_PUBLIC_DEMO !== "true" && process.env.LUMIO_DESKTOP !== "true";
}

export function createCompetitionQuota(now: () => number = Date.now) {
  let day = "", attempts = 0, active = 0;
  return {
    acquire() {
      const today = new Date(now()).toISOString().slice(0, 10);
      if (day !== today) { day = today; attempts = 0; }
      // One Render instance, bounded paid exposure even if many accounts are created.
      // Counters reset on a server restart; this limitation is disclosed in preview.
      if (attempts >= 200 || active >= 3) throw new AIError("COMPETITION_RATE_LIMIT", 429);
      attempts++; active++;
      let released = false;
      return () => { if (!released) { released = true; active = Math.max(0, active - 1); } };
    },
    snapshot: () => ({day, attempts, active}),
  };
}
const root = globalThis as typeof globalThis & { __lumioCompetitionQuota?: ReturnType<typeof createCompetitionQuota> };
export function acquireCompetitionQuota() {
  if (!isCompetitionPreview()) return () => {};
  return (root.__lumioCompetitionQuota ??= createCompetitionQuota()).acquire();
}
