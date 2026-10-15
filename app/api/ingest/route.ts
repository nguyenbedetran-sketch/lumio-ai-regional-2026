import { AIError } from "../../../lib/ai/contracts";
import { boundedBytes } from "../../../lib/ai/guard";
import { extractWebsite } from "../../../lib/ingestion/website";
import { youtubeURL } from "../../../lib/ingestion/youtube";
import {
  requireActor,
  assertSameOrigin,
  errorResponse,
} from "../../../lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const limits = new Map<
  string,
  { started: number; count: number; active: boolean }
>();
export async function POST(req: Request) {
  let release: (() => void) | undefined;
  try {
    assertSameOrigin(req);
    const actor = await requireActor();
    const now = Date.now();
    if (limits.size > 1000)
      for (const [key, value] of limits)
        if (now - value.started > 60000 && !value.active) limits.delete(key);
    const limit = limits.get(actor.user.id) || {
      started: now,
      count: 0,
      active: false,
    };
    if (now - limit.started > 60000) {
      limit.started = now;
      limit.count = 0;
    }
    if (limit.count >= 8 || limit.active)
      throw new AIError("LOCAL_RATE_LIMIT", 429);
    limit.count++;
    limit.active = true;
    limits.set(actor.user.id, limit);
    release = () => {
      limit.active = false;
    };
    if (!req.headers.get("content-type")?.includes("application/json"))
      throw new AIError("INVALID_CONTENT_TYPE", 415);
    let body: { url?: unknown };
    try {
      body = JSON.parse(
        new TextDecoder().decode(await boundedBytes(req, 6000)),
      );
    } catch {
      throw new AIError("INVALID_JSON");
    }
    if (!body || typeof body.url !== "string") throw new AIError("INVALID_URL");
    if (youtubeURL(body.url)) throw new AIError("VIDEO_USE_TUTOR", 400);
    const result = await extractWebsite(body.url);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AIError)
      return Response.json(
        { error: error.code },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    return errorResponse(error);
  } finally {
    release?.();
  }
}
