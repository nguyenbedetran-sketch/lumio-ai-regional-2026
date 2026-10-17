import { adminActor } from "../../../../lib/server/admin-access";
import { errorResponse, json, readJSON } from "../../../../lib/server/access";
import { getStore } from "../../../../lib/server/store";
import { PlatformError } from "../../../../lib/server/types";
import type { PaidPlanId } from "../../../../lib/billing/paid-policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try { await adminActor(req, "features.read"); return json(getStore().getPaidPlanPolicies()); }
  catch (error) { return errorResponse(error); }
}
export async function POST(req: Request) {
  try {
    const actor = await adminActor(req, "features.update"), body = await readJSON(req, 16384);
    if (Object.keys(body).sort().join() !== "config,expectedRevision,planId,reason" || typeof body.planId !== "string" || typeof body.expectedRevision !== "number" || typeof body.reason !== "string") throw new PlatformError("INVALID_PAID_POLICY");
    return json(getStore().updatePaidPlanPolicy({ actorId: actor.user.id, sessionVersion: actor.user.sessionVersion, planId: body.planId as PaidPlanId, expectedRevision: body.expectedRevision, reason: body.reason, config: body.config }));
  } catch (error) { return errorResponse(error); }
}
