import {
  assertSameOrigin,
  errorResponse,
  json,
  readJSON,
  requireAdmin,
} from "../../../../lib/server/access";
import { getStore } from "../../../../lib/server/store";
import { PlatformError } from "../../../../lib/server/types";
import type { PlanId } from "../../../../lib/server/billing-types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireAdmin("features.update");
    return json({
      catalog: getStore().getBillingCatalog(),
      sandboxEnabled: process.env.NODE_ENV === "development",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const body = await readJSON(req);
    const actor = await requireAdmin("features.update");
    if (body.action === "sandbox_grant") {
      if (
        body.confirmSandbox !== true ||
        typeof body.userId !== "string" ||
        typeof body.requestId !== "string" ||
        typeof body.planId !== "string" ||
        typeof body.credits !== "number" ||
        typeof body.days !== "number" ||
        typeof body.reason !== "string"
      )
        throw new PlatformError("INVALID_SANDBOX_GRANT");
      return json(
        getStore().adminGrant({
          actorId: actor.user.id,
          sessionVersion: actor.user.sessionVersion,
          userId: body.userId,
          requestId: body.requestId,
          planId: body.planId as PlanId,
          credits: body.credits,
          days: body.days,
          reason: body.reason,
        }),
      );
    }
    if (body.action === "catalog_update") {
      if (
        typeof body.itemId !== "string" ||
        ![body.monthlyPriceMinor, body.yearlyPriceMinor, body.credits].every(
          (value) => value === null || typeof value === "number",
        )
      )
        throw new PlatformError("INVALID_BILLING_AMOUNT");
      return json(
        getStore().updateBillingCatalog({
          actorId: actor.user.id,
          sessionVersion: actor.user.sessionVersion,
          itemId: body.itemId,
          monthlyPriceMinor: body.monthlyPriceMinor as number | null,
          yearlyPriceMinor: body.yearlyPriceMinor as number | null,
          credits: body.credits as number | null,
        }),
      );
    }
    throw new PlatformError("INVALID_BILLING_ACTION");
  } catch (error) {
    return errorResponse(error);
  }
}
