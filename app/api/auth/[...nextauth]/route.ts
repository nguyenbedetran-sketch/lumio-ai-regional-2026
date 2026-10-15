import NextAuth from "next-auth";
import { authOptions, providerStatus } from "../../../../lib/lumio/auth";
import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { getUser } from "../../../../lib/server/store";
import { authFailureResponse } from "../../../../lib/server/auth-errors";
import { demoAPIResponse } from "../../../../lib/server/public-demo";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// No credentials means no session/authentication; never invent a logged-in profile.
async function route(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> },
) {
  const params = await context.params;
  const demo = demoAPIResponse(
    `/api/auth/${params.nextauth[0]}`,
    request.method,
  );
  if (demo) return demo;
  try {
    const status = providerStatus();
    if (
      !status.google &&
      !status.facebook &&
      request.method === "GET" &&
      ["session", "providers"].includes(params.nextauth[0])
    )
      return Response.json({}, { headers: { "Cache-Control": "no-store" } });
    if (!status.google && !status.facebook)
      return Response.json({ error: "AUTH_NOT_CONFIGURED" }, { status: 503 });
    const cookie = request.cookies.get("lumio-link-intent")?.value;
    let link: { token: string; userId: string } | undefined;
    let invalidLink = false;
    if (cookie && params.nextauth[0] === "callback") {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      });
      const user =
        typeof token?.userId === "string" ? getUser(token.userId) : null;
      if (
        user &&
        !user.disabled &&
        token?.sessionVersion === user.sessionVersion &&
        /^[\w-]{43}$/.test(cookie)
      )
        link = { token: cookie, userId: user.id };
      else invalidLink = true;
    }
    const response: Response = await NextAuth(
      authOptions({ link, invalidLink }),
    )(request, context);
    if (cookie && params.nextauth[0] === "callback")
      response.headers.append(
        "Set-Cookie",
        "lumio-link-intent=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" +
          (process.env.NEXTAUTH_URL?.startsWith("https:") ? "; Secure" : ""),
      );
    return response;
  } catch (error) {
    const response = authFailureResponse(
      request.method,
      params.nextauth[0],
      error,
    );
    if (
      ["callback", "signin", "signout", "error"].includes(params.nextauth[0])
    ) {
      // Clear a failed link flow too, so subsequent ordinary sign-ins can recover.
      response.headers.append(
        "Set-Cookie",
        "lumio-link-intent=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" +
          (process.env.NEXTAUTH_URL?.startsWith("https:") ? "; Secure" : ""),
      );
    }
    return response;
  }
}
export { route as GET, route as POST };
