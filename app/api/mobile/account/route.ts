import { json, errorResponse } from "../../../../lib/server/access";
import { requireMobile } from "../../../../lib/server/mobile-access";
import { getStore } from "../../../../lib/server/store";
import { aiStatus } from "../../../../lib/ai/router";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const { user, expiresAt } = requireMobile(req),
      store = getStore();
    const configured = aiStatus();
    const ai = configured.enabled && store.isFeatureEnabled("ai.enabled");
    const voice = ai && store.isFeatureEnabled("ai.voice") && configured.xai;
    return json({
      user: { id: user.id, name: user.name, email: user.email },
      expiresAt,
      capabilities: {
        ai: ai && (configured.openai || configured.gemini),
        tutor: ai && configured.openai,
        summary: ai && configured.gemini,
        voice,
        transcription: voice && !!process.env.XAI_STT_MODEL,
        speech: voice,
      },
      credits: store.getBillingSnapshot(user.id, user.sessionVersion).account,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(req: Request) {
  try {
    const { user, deviceId } = requireMobile(req);
    getStore().revokeMobileSession(user.id, user.sessionVersion, deviceId);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
