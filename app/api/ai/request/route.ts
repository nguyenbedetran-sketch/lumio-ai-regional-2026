import { requireBoundAIActor, failure } from "../../../../lib/ai/guard";
import { aiHttpKey } from "../../../../lib/server/ai-http-core";
import { getStore } from "../../../../lib/server/store";
import { PlatformError } from "../../../../lib/server/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const p = await requireBoundAIActor(req),
      q = new URL(req.url).searchParams;
    if ([...q.keys()].some((k) => k !== "key") || q.getAll("key").length !== 1)
      throw new PlatformError("INVALID_IDEMPOTENCY_KEY");
    const receipt = getStore().readAIHttpRequest(
      p.userId,
      p.sessionVersion,
      aiHttpKey(q.get("key")),
    );
    return Response.json(
      { receipt },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
