import { json, errorResponse } from "../../../lib/server/access";
import { adminActor } from "../../../lib/server/admin-access";
import { adminSnapshot } from "../../../lib/server/admin-snapshot";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    return json(adminSnapshot(await adminActor(req)));
  } catch (error) {
    return errorResponse(error);
  }
}
