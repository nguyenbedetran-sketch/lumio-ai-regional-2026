import { providerStatus } from "../../../lib/lumio/auth";
import { aiStatus } from "../../../lib/ai/router";
import { getStore, isFeatureEnabled } from "../../../lib/server/store";
import { safeStorageStatus } from "../../../lib/lumio/storage-status";
import { PlatformError } from "../../../lib/server/types";
import { errorResponse } from "../../../lib/server/access";
import { demoAPIResponse } from "../../../lib/server/public-demo";
import { isCompetitionPreview } from "../../../lib/server/competition-preview";
import {
  desktopConfig,
  isDesktopPreview,
} from "../../../lib/server/desktop-mode";
export const dynamic = "force-dynamic";
export function GET() {
  if (isDesktopPreview())
    return Response.json(desktopConfig(), {
      headers: { "Cache-Control": "no-store" },
    });
  const demo = demoAPIResponse("/api/config", "GET");
  if (demo) return demo;
  try {
    const store = getStore();
    const storage = safeStorageStatus(
      store.databaseMode,
      store.databaseAvailable(),
    );
    if (!storage) throw new PlatformError("DATABASE_UNAVAILABLE", 503);
    const ai = aiStatus();
    const enabled = ai.enabled && isFeatureEnabled("ai.enabled");
    const voice = enabled && isFeatureEnabled("ai.voice");
    return Response.json(
      {
        ...providerStatus(),
        storage,
        competitionPreview: isCompetitionPreview(),
        ai: enabled && (ai.openai || ai.gemini),
        capabilities: {
          tutor: enabled && ai.openai,
          summary: enabled && ai.gemini,
          media: enabled && ai.gemini,
          transcription: voice && ai.xai && !!process.env.XAI_STT_MODEL,
          speech: voice && ai.xai,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
