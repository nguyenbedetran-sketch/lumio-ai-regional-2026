import { getStore } from "../../../lib/server/store";
import { isCompetitionPreview } from "../../../lib/server/competition-preview";
import { isPublicDemo } from "../../../lib/server/public-demo";
import packageInfo from "../../../package.json";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Readiness only: never calls providers or returns users, usage, keys or paths. */
export function GET() {
  let ready = false;
  try {
    ready = isPublicDemo() || getStore().runtimeHealth().ready;
  } catch {}
  return Response.json(
    {
      status: ready ? "ready" : "unavailable",
      version: packageInfo.version,
      mode: isPublicDemo()
        ? "ui-demo"
        : isCompetitionPreview()
          ? "competition-preview"
          : "standard",
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
