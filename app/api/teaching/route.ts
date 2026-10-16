import { teacherActor } from "../../../lib/server/teacher-access";
import { readJSON, json, errorResponse } from "../../../lib/server/access";
import { getStore } from "../../../lib/server/store";
import {
  identifier,
  str,
  teachingError,
} from "../../../lib/teaching/validation";
import { teachingLimits } from "../../../lib/teaching/contracts";
import { AssessmentShortageError } from "../../../lib/teaching/assessment-plan";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const { user } = await teacherActor(req),
      p = new URL(req.url).searchParams;
    if (
      [...p.keys()].some(
        (k) =>
          !["orgId", "classId", "q"].includes(k) || p.getAll(k).length !== 1,
      )
    )
      teachingError("INVALID_TEACHING_DATA");
    const orgId = p.has("orgId") ? identifier(p.get("orgId")) : undefined,
      classId = p.has("classId") ? identifier(p.get("classId")) : undefined,
      q = p.has("q") ? str(p.get("q"), 100, 0) : undefined;
    if (classId && !orgId) teachingError("INVALID_TEACHING_DATA");
    return json(
      getStore().readTeaching(user.id, user.sessionVersion, {
        orgId,
        classId,
        q,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(req: Request) {
  try {
    const { user } = await teacherActor(req),
      body = await readJSON(req, teachingLimits.bodyBytes);
    return json(getStore().mutateTeaching(user.id, user.sessionVersion, body));
  } catch (error) {
    if (error instanceof AssessmentShortageError)
      return json(
        { error: error.code, shortages: error.shortages },
        error.status,
      );
    return errorResponse(error);
  }
}
