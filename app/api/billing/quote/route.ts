import { assertSameOrigin, errorResponse, json, readJSON, requireActor } from "../../../../lib/server/access";
import { getStore } from "../../../../lib/server/store";
import { PlatformError } from "../../../../lib/server/types";
import type { PaidUsageDimensions } from "../../../../lib/billing/paid-policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Read-only estimate. Request dimensions never authorize a provider call or alter a wallet. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const actor = await requireActor();
    if (req.headers.has("authorization") || req.headers.get("x-lumio-account") !== actor.user.storageKey) throw new PlatformError("SESSION_REVOKED", 401);
    const body = await readJSON(req), allowed = ["task", "mode", "kind", "duration", "sourceCharacters", "pricingFeature"];
    if (Object.keys(body).some(k => !allowed.includes(k)) || !["chat", "summary", "cards", "quiz", "speech", "transcription", "index"].includes(body.task as string) || !["quick", "tutor", "think", "deep"].includes((body.mode ?? "tutor") as string) || !["text", "image", "pdf", "audio", "video"].includes(body.kind as string)) throw new PlatformError("INVALID_BILLING_USAGE");
    return json({ quote: getStore().getPaidUsageQuote(actor.user.id, actor.user.sessionVersion, body as unknown as PaidUsageDimensions), changesBalance: false, providerCostKnown: false });
  } catch (error) { return errorResponse(error); }
}
