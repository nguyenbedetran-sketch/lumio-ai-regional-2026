import { teacherActor } from "../../../../lib/server/teacher-access";
import { errorResponse } from "../../../../lib/server/access";
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
          !["orgId", "classId", "format"].includes(k) ||
          p.getAll(k).length !== 1,
      )
    )
      teachingError("INVALID_TEACHING_DATA");
    const format = p.get("format") ?? "csv";
    if (!["csv", "json"].includes(format))
      teachingError("INVALID_TEACHING_DATA");
    const result = getStore().exportTeaching(user.id, user.sessionVersion, {
      orgId: identifier(p.get("orgId")),
      classId: p.has("classId") ? identifier(p.get("classId")) : undefined,
      format: format as "csv" | "json",
    });
    return new Response(result.content, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
