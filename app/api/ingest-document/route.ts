import {
  extractDocument,
  DOCUMENT_LIMITS,
} from "../../../lib/ingestion/documents";
import { signSourceEvidence } from "../../../lib/server/source-evidence";
import {
  assertSameOrigin,
  requireActor,
  readJSON,
  json,
  errorResponse,
} from "../../../lib/server/access";
import { AIError } from "../../../lib/ai/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const limits = new Map<
  string,
  { start: number; count: number; active: boolean }
>();
// The free hosting process must not allocate one PDF worker for every guest account.
let activeExtractions = 0;
export async function POST(req: Request) {
  let release: (() => void) | undefined;
  try {
    assertSameOrigin(req);
    const actor = await requireActor(),
      now = Date.now();
    if (limits.size > 1000)
      for (const [k, v] of limits)
        if (!v.active && now - v.start > 60000) limits.delete(k);
    const limit = limits.get(actor.user.id) || {
      start: now,
      count: 0,
      active: false,
    };
    if (now - limit.start > 60000) {
      limit.start = now;
      limit.count = 0;
    }
    if (limit.active || limit.count >= 4 || activeExtractions >= 1)
      throw new AIError("LOCAL_RATE_LIMIT", 429);
    activeExtractions++;
    limit.active = true;
    limit.count++;
    limits.set(actor.user.id, limit);
    release = () => {
      limit.active = false;
      activeExtractions--;
    };
    const body = await readJSON(req, 9 * 1024 * 1024);
    if (
      typeof body.filename !== "string" ||
      !body.filename.trim() ||
      body.filename.length > 250 ||
      /[\u0000-\u001f]/.test(body.filename) ||
      typeof body.data !== "string" ||
      body.data.length > 8 * 1024 * 1024 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(body.data) ||
      body.data.length % 4
    )
      throw new AIError("INVALID_DOCUMENT");
    const bytes = Buffer.from(body.data, "base64");
    if (bytes.byteLength > DOCUMENT_LIMITS.bytes)
      throw new AIError("INVALID_DOCUMENT", 413);
    const filename = body.filename.replace(/^.*[\\/]/, "");
    const extracted = await extractDocument(bytes, filename, req.signal);
    const evidence = signSourceEvidence(
      { ...extracted, filename },
      actor.user.id,
    );
    return json({
      text: extracted.text,
      sourceEvidence: evidence,
      fetchedAt: new Date().toISOString(),
      kind: "document",
    });
  } catch (error) {
    if (error instanceof AIError)
      return json({ error: error.code }, error.status);
    return errorResponse(error);
  } finally {
    release?.();
  }
}
