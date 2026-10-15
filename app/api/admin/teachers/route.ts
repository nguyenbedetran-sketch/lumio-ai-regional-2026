import { teacherActor } from "../../../../lib/server/teacher-access";
import { readJSON, json, errorResponse } from "../../../../lib/server/access";
import { getStore } from "../../../../lib/server/store";
import { PlatformError } from "../../../../lib/server/types";
import type { TeacherListQuery } from "../../../../lib/teachers/contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const { user } = await teacherActor(req, "teachers.read"),
      p = new URL(req.url).searchParams;
    if (
      [...p.keys()].some(
        (key) =>
          !["status", "q", "sort", "offset"].includes(key) ||
          p.getAll(key).length !== 1,
      )
    )
      throw new PlatformError("INVALID_TEACHER_REQUEST");
    const rawOffset = p.get("offset");
    if (rawOffset !== null && !/^\d{1,7}$/.test(rawOffset))
      throw new PlatformError("INVALID_TEACHER_REQUEST");
    return json(
      getStore().listTeacherApplications(user.id, user.sessionVersion, {
        status: (p.get("status") ?? "pending") as TeacherListQuery["status"],
        q: p.get("q") ?? "",
        sort: (p.get("sort") ?? "newest") as TeacherListQuery["sort"],
        offset: Number(rawOffset ?? 0),
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(req: Request) {
  try {
    const { user } = await teacherActor(req, "teachers.review"),
      body = await readJSON(req, 4096);
    return json(
      getStore().reviewTeacherApplication(user.id, user.sessionVersion, body),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
