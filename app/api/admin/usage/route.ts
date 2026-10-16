import {
  requireAdmin,
  json,
  errorResponse,
} from "../../../../lib/server/access";
import { getStore } from "../../../../lib/server/store";
import { PlatformError } from "../../../../lib/server/types";
import type { UsageDimension } from "../../../../lib/server/usage-report";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const actor = await requireAdmin("ai.usage.read");
    if (req.headers.get("x-lumio-account") !== actor.user.storageKey)
      throw new PlatformError("SESSION_REVOKED", 401);
    const params = new URL(req.url).searchParams;
    if (params.has("summary")) {
      if (
        [...params.keys()].some(
          (key) =>
            !["summary", "dimension", "days", "scope"].includes(key) ||
            params.getAll(key).length !== 1,
        ) ||
        params.get("summary") !== "1"
      )
        throw new PlatformError("INVALID_USAGE_QUERY");
      const dimension = params.get("dimension") || "model";
      const scope = params.get("scope") || "outcomes";
      if (!["outcomes", "attempts"].includes(scope))
        throw new PlatformError("INVALID_USAGE_QUERY");
      const dayText = params.get("days") || "7";
      if (!["model", "task", "user"].includes(dimension))
        throw new PlatformError("INVALID_USAGE_DIMENSION");
      if (!/^(?:[1-9]|[12][0-9]|3[01])$/.test(dayText))
        throw new PlatformError("INVALID_USAGE_WINDOW");
      return json(
        scope === "attempts"
          ? getStore().getProviderAttemptBreakdown(
              dimension as UsageDimension,
              Number(dayText),
            )
          : getStore().getUsageBreakdown(
              dimension as UsageDimension,
              Number(dayText),
            ),
      );
    }
    if (params.has("scope")) throw new PlatformError("INVALID_USAGE_QUERY");
    const offset = Number(params.get("offset") || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000)
      throw new PlatformError("INVALID_PAGE");
    return json({ events: getStore().listUsage(30, offset) });
  } catch (error) {
    return errorResponse(error);
  }
}
