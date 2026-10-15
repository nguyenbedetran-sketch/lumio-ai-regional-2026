import { requireAdmin, json, errorResponse } from "../../../lib/server/access";
import { adminSnapshot } from "../../../lib/server/admin-snapshot";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return json(adminSnapshot(await requireAdmin()));
  } catch (error) {
    return errorResponse(error);
  }
}
