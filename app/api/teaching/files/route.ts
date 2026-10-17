import { teacherActor } from "../../../../lib/server/teacher-access";
import { readJSON, json, errorResponse } from "../../../../lib/server/access";
import { getStore } from "../../../../lib/server/store";
import { teachingFileLimits } from "../../../../lib/teaching/file-contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const { user } = await teacherActor(req);
    const body = await readJSON(req, teachingFileLimits.bodyBytes);
    return json(
      getStore().uploadTeachingFile(user.id, user.sessionVersion, body),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
