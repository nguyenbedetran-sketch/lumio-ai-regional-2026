import { readJSON, json, errorResponse } from "../../../../lib/server/access";
import { requireBoundAIActor } from "../../../../lib/ai/guard";
import { getStore } from "../../../../lib/server/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Free, closed-category feedback on the owner's recorded turn, never model training or a correctness verdict. */
export async function POST(req: Request) {
  try {
    const actor = await requireBoundAIActor(req);
    return json(
      getStore().mutateTutorFeedback(
        actor.userId,
        actor.sessionVersion,
        await readJSON(req, 2048),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
