import {
  assertSameOrigin,
  requireActor,
  readJSON,
  json,
  errorResponse,
} from "../../../lib/server/access";
import { requireMobile } from "../../../lib/server/mobile-access";
import { PlatformError } from "../../../lib/server/types";
import { getStore } from "../../../lib/server/store";
import {
  abortSummaryJob,
  kickSummaryJobs,
  reconcileSummaryJobs,
} from "../../../lib/server/job-worker";
import { SUMMARY_JOB_LIMITS } from "../../../lib/jobs/contracts";
import { AIError } from "../../../lib/ai/contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function actor(req: Request) {
  const native = req.headers.has("authorization");
  if (!native) {
    if (req.method !== "GET") assertSameOrigin(req);
    else if (
      ["cross-site", "same-site"].includes(
        req.headers.get("sec-fetch-site") || "",
      )
    )
      throw new PlatformError("INVALID_ORIGIN", 403);
  }
  const result = native ? requireMobile(req) : await requireActor();
  if (
    native
      ? req.headers.get("x-lumio-user") !== result.user.id
      : req.headers.get("x-lumio-account") !== result.user.storageKey
  )
    throw new PlatformError("SESSION_REVOKED", 401);
  reconcileSummaryJobs(result.user.id);
  return result;
}
const error = (e: unknown) =>
  e instanceof AIError
    ? json({ error: e.code, requestId: crypto.randomUUID() }, e.status)
    : errorResponse(e);
export async function GET(req: Request) {
  try {
    const { user } = await actor(req),
      jobId = new URL(req.url).searchParams.get("jobId"),
      store = getStore();
    const data = jobId
      ? store.readSummaryJob(user.id, user.sessionVersion, jobId)
      : {
          jobs: store.listSummaryJobs(user.id, user.sessionVersion),
          limits: SUMMARY_JOB_LIMITS,
        };
    kickSummaryJobs(user.id, user.sessionVersion);
    return json(data);
  } catch (e) {
    return error(e);
  }
}
export async function POST(req: Request) {
  try {
    const { user } = await actor(req),
      body = await readJSON(req, 600000);
    if (body.consent !== true || typeof body.requestKey !== "string")
      throw new PlatformError("JOB_CONSENT_REQUIRED");
    const job = getStore().createSummaryJob(
      user.id,
      user.sessionVersion,
      body.requestKey,
      body.input,
    );
    kickSummaryJobs(user.id, user.sessionVersion);
    return json({ job }, 202);
  } catch (e) {
    return error(e);
  }
}
export async function PATCH(req: Request) {
  try {
    const { user } = await actor(req),
      body = await readJSON(req);
    if (
      typeof body.jobId !== "string" ||
      typeof body.action !== "string" ||
      !["cancel", "resume", "delete"].includes(body.action)
    )
      throw new PlatformError("INVALID_JOB_ACTION");
    const result = getStore().controlSummaryJob(
      user.id,
      user.sessionVersion,
      body.jobId,
      body.action as "cancel" | "resume" | "delete",
    );
    if (body.action === "cancel") {
      abortSummaryJob(body.jobId);
      reconcileSummaryJobs(user.id);
    }
    kickSummaryJobs(user.id, user.sessionVersion);
    return json(result);
  } catch (e) {
    return error(e);
  }
}
