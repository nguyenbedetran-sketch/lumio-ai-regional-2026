import { authorizeStoredAI, failure, type AILease } from "../../../../lib/ai/guard";
import { readJSON, json } from "../../../../lib/server/access";
import { teacherActor } from "../../../../lib/server/teacher-access";
import { getStore } from "../../../../lib/server/store";
import { executeTeachingGeneration } from "../../../../lib/server/teaching-ai";
import { parseTeachingGenerationRequest } from "../../../../lib/teaching/content-qa";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let lease: AILease | undefined;
  try {
    const actor = await teacherActor(req);
    const input = parseTeachingGenerationRequest(await readJSON(req, 16 * 1024));
    const context = getStore().getTeachingGenerationContext(actor.user.id, actor.user.sessionVersion, input.orgId, input.sourceIds);
    lease = authorizeStoredAI(actor.user.id, actor.user.sessionVersion);
    const result = await executeTeachingGeneration(input, context, { requestId: input.requestId, signal: req.signal });
    return json(result);
  } catch (error) { return failure(error); }
  finally { lease?.(); }
}
