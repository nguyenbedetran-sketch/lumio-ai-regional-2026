import { teacherActor } from "../../../../lib/server/teacher-access";
import { json, errorResponse } from "../../../../lib/server/access";
import { getStore } from "../../../../lib/server/store";
import { identifier, teachingError } from "../../../../lib/teaching/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const { user } = await teacherActor(req),
      p = new URL(req.url).searchParams;
    if (
      [...p.keys()].some(
        (k) =>
          !["orgId", "submissionId", "limit", "cursor"].includes(k) ||
          p.getAll(k).length !== 1,
      )
    )
      teachingError("INVALID_TEACHING_DATA");
    const orgId = identifier(p.get("orgId")),
      submissionId = identifier(p.get("submissionId"));
    if (p.has("limit") && !/^[1-9]\d?$/.test(p.get("limit")!))
      teachingError("INVALID_TEACHING_DATA");
    return json(
      getStore().readTeachingGradeHistory(user.id, user.sessionVersion, {
        orgId,
        submissionId,
        ...(p.has("limit") ? { limit: Number(p.get("limit")) } : {}),
        ...(p.has("cursor") ? { cursor: p.get("cursor")! } : {}),
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
