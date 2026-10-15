import { getServerSession } from "next-auth";
import { authOptions, providerStatus } from "../../../../lib/lumio/auth";
import { createLinkIntent, getUser } from "../../../../lib/server/store";
import { PlatformError } from "../../../../lib/server/types";
import { assertSameOrigin, readJSON } from "../../../../lib/server/access";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const expected = process.env.NEXTAUTH_URL;
    assertSameOrigin(req);
    const session = (await getServerSession(authOptions())) as {
      userId?: string;
      sessionVersion?: number;
      authenticatedAt?: number;
    } | null;
    const user = session?.userId ? getUser(session.userId) : null;
    if (
      !user ||
      user.disabled ||
      user.sessionVersion !== session?.sessionVersion
    )
      throw new PlatformError("SIGN_IN_REQUIRED", 401);
    if (Date.now() - (session.authenticatedAt || 0) > 3600000)
      throw new PlatformError("REAUTHENTICATION_REQUIRED", 401);
    const body = await readJSON(req, 1000);
    const provider = (body as { provider?: unknown })?.provider;
    if (provider !== "google" && provider !== "facebook")
      throw new PlatformError("INVALID_PROVIDER");
    if (!providerStatus()[provider])
      throw new PlatformError("PROVIDER_NOT_CONFIGURED", 503);
    const intent = createLinkIntent(user.id, provider, session.sessionVersion);
    return Response.json(
      { success: true, provider },
      {
        headers: {
          "Cache-Control": "no-store",
          "Set-Cookie": `lumio-link-intent=${intent.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${expected?.startsWith("https:") ? "; Secure" : ""}`,
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof PlatformError ? error.code : "INVALID_REQUEST",
      },
      {
        status: error instanceof PlatformError ? error.status : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
