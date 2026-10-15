import { AIError } from "../ai/contracts";
import { authorizeStoredAI, type AILease } from "../ai/guard";
import { getStore } from "./store";
import { executeSummaryInput } from "./summary-execution";
import { PlatformError } from "./types";
type WorkerGlobals = {
  active: Map<string, Promise<void>>;
  timers: Map<string, ReturnType<typeof setTimeout>>;
  controllers: Map<string, AbortController>;
};
const root = globalThis as typeof globalThis & {
  __lumioSummaryWorkers?: WorkerGlobals;
};
const state = (root.__lumioSummaryWorkers ||= {
  active: new Map(),
  timers: new Map(),
  controllers: new Map(),
});
/** Finalization remains available after account revocation so held credits can be released. */
export function reconcileSummaryJobs(userId: string) {
  const store = getStore();
  for (const reservation of store.summaryJobRefunds(userId))
    store.failUsage(reservation);
  store.recoverSummaryJobs(userId);
}
export function abortSummaryJob(jobId: string) {
  state.controllers.get(jobId)?.abort();
}
/** One bounded step, also used by the integration harness; no public worker token exists. */
export async function runSummaryJobStep(
  userId: string,
  sessionVersion: number,
): Promise<boolean> {
  const store = getStore();
  reconcileSummaryJobs(userId);
  const lease = store.claimSummaryJob(userId, sessionVersion);
  if (!lease) return false;
  const controller = new AbortController();
  state.controllers.set(lease.jobId, controller);
  let release: AILease | undefined;
  try {
    // Identity is loaded from the owned persisted job, never an HTTP body.
    release = authorizeStoredAI(lease.userId, lease.sessionVersion);
    await executeSummaryInput(lease.input, lease, {
      requestId: lease.requestId,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]),
      onReserved: (reservation) =>
        store.startSummaryJobAttempt(lease, reservation.reservationId),
      commit: (result) => store.completeSummaryJobPart(lease, result),
    });
  } catch (error) {
    const code =
      error instanceof AIError || error instanceof PlatformError
        ? error.code
        : "PROVIDER_UNAVAILABLE";
    try {
      store.failSummaryJobPart(lease, code);
    } catch {
      console.warn("[lumio] JOB_RECOVERY_REQUIRED");
    }
  } finally {
    state.controllers.delete(lease.jobId);
    release?.();
  }
  return true;
}
/** Warm-process worker. The persisted queue resumes when its owner next opens jobs after a restart. */
export function kickSummaryJobs(userId: string, sessionVersion: number) {
  if (process.env.LUMIO_BACKGROUND_JOBS_DISABLED === "true") return;
  const key = `${userId}:${sessionVersion}`;
  if (state.active.has(key)) return;
  const timer = state.timers.get(key);
  if (timer) {
    clearTimeout(timer);
    state.timers.delete(key);
  }
  const work = (async () => {
    // At most 36 parts across three bounded jobs per warm run; yield thereafter.
    for (let n = 0; n < 36; n++)
      if (!(await runSummaryJobStep(userId, sessionVersion))) break;
  })()
    .catch(() => {
      console.warn("[lumio] JOB_WORKER_UNAVAILABLE");
    })
    .finally(() => {
      state.active.delete(key);
      try {
        const user = getStore().getUser(userId);
        if (!user || user.disabled || user.sessionVersion !== sessionVersion)
          return;
        const next = getStore().nextSummaryJobWake(userId, sessionVersion);
        if (next === null) return;
        const timer = setTimeout(
          () => {
            state.timers.delete(key);
            kickSummaryJobs(userId, sessionVersion);
          },
          Math.max(1000, Math.min(60000, next - Date.now())),
        );
        timer.unref?.();
        state.timers.set(key, timer);
      } catch {
        /* Next authenticated access can restart maintenance. */
      }
    });
  state.active.set(key, work);
}
