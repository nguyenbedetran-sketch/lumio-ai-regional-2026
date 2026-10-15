import { errorResponse, json } from "../../../../lib/server/access";
import { getStore } from "../../../../lib/server/store";
import { demoAPIResponse } from "../../../../lib/server/public-demo";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const demo = demoAPIResponse("/api/billing/catalog", "GET");
  if (demo) return demo;
  try {
    return json(getStore().getBillingCatalog());
  } catch (error) {
    return errorResponse(error);
  }
}
