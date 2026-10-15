import { teacherActor } from "../../../lib/server/teacher-access";
import { readJSON, json, errorResponse } from "../../../lib/server/access";
import { getStore } from "../../../lib/server/store";
import { PlatformError } from "../../../lib/server/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const { user } = await teacherActor(req);
    if (new URL(req.url).search)
      throw new PlatformError("INVALID_TEACHER_REQUEST");
    return json(
      getStore().readTeacherApplication(user.id, user.sessionVersion),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(req: Request) {
  try {
    const { user } = await teacherActor(req),
      body = await readJSON(req, 8192);
    return json(
      getStore().submitTeacherApplication(user.id, user.sessionVersion, body),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
