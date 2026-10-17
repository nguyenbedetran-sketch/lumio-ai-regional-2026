import { teacherActor } from "../../../../../lib/server/teacher-access";
import { json, errorResponse } from "../../../../../lib/server/access";
import { getStore } from "../../../../../lib/server/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, context: Context) {
  try {
    const { user } = await teacherActor(req),
      { id } = await context.params;
    const { file, bytes } = getStore().readTeachingFile(
      user.id,
      user.sessionVersion,
      id,
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": file.mime,
        "Content-Length": String(file.bytes),
        "Content-Disposition": `attachment; filename="download.${file.name.split(".").at(-1)!.toLowerCase()}"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(req: Request, context: Context) {
  try {
    const { user } = await teacherActor(req),
      { id } = await context.params;
    return json(
      getStore().deleteTeachingFile(user.id, user.sessionVersion, id),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
